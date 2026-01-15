/**
 * Sugar contract service for interacting with Aerodrome LpSugar
 * and direct Pool/Token interactions where Sugar is insufficient.
 */
import { ethers, Contract, JsonRpcProvider } from 'ethers';
import { LP_SUGAR_ADDRESS, LP_SUGAR_ABI, Position, LpPool } from '../abis/lp-sugar';
import { Cache } from '../utils/cache';
import { getRateLimiter } from '../utils/rate-limiter';
import { config } from '../config';

// Pool data cache
const poolCache = new Cache<LpPool>(config.cacheTtlMs);
const rateLimiter = getRateLimiter(config.minRpcDelayMs);

let provider: JsonRpcProvider | null = null;
let lpSugarContract: Contract | null = null;

// Minimal ABIs for direct fetching
const CL_POOL_ABI = [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function tickSpacing() external view returns (int24)",
    "function liquidity() external view returns (uint128)"
];

const ERC20_ABI = [
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)"
];

function getProvider(): JsonRpcProvider {
    if (!provider) {
        provider = new JsonRpcProvider(config.rpcUrl);
    }
    return provider;
}

function getLpSugarContract(): Contract {
    if (!lpSugarContract) {
        lpSugarContract = new Contract(LP_SUGAR_ADDRESS, LP_SUGAR_ABI, getProvider());
    }
    return lpSugarContract;
}

/**
 * Parse position data from contract response
 */
function parsePosition(pos: any): Position {
    return {
        id: pos.id,
        lp: pos.lp,
        liquidity: pos.liquidity,
        staked: pos.staked,
        amount0: pos.amount0,
        amount1: pos.amount1,
        staked0: pos.staked0,
        staked1: pos.staked1,
        unstaked_earned0: pos.unstaked_earned0,
        unstaked_earned1: pos.unstaked_earned1,
        emissions_earned: pos.emissions_earned,
        tick_lower: Number(pos.tick_lower),
        tick_upper: Number(pos.tick_upper),
        sqrt_ratio_lower: pos.sqrt_ratio_lower,
        sqrt_ratio_upper: pos.sqrt_ratio_upper,
        locker: pos.locker,
        unlocks_at: BigInt(pos.unlocks_at),
        alm: pos.alm,
    };
}

/**
 * Fetch all positions for a given account
 * Loops through pools using limit/offset pagination to ensure all positions are found.
 */
export async function fetchPositions(account: string): Promise<Position[]> {
    const contract = getLpSugarContract();
    const allPositions: Position[] = [];

    const limit = 500;
    let maxPoolsToCheck = 25000; // Default fallback

    try {
        const countVal = await rateLimiter.execute(() => contract.count());
        maxPoolsToCheck = Number(countVal);
        console.log(`   ℹ️ Total pools in Sugar: ${maxPoolsToCheck}`);
    } catch (e) {
        console.warn(`   ⚠️ Could not fetch pool count, using default: ${maxPoolsToCheck}`);
    }

    // We scan somewhat greedily to be safe or just use the exact count
    // Since pagination is limit/offset, we loop until offset >= maxPoolsToCheck.

    console.log(`📊 Fetching positions for ${account} (Paginated)...`);
    console.log(`   Contract: ${LP_SUGAR_ADDRESS}`);

    // 1. Fetch from positions() 
    for (let offset = 0; offset < maxPoolsToCheck; offset += limit) {
        // if (offset % 5000 === 0) console.log(`   ...Scanning offset ${offset}`);
        try {
            const batch = await rateLimiter.execute(async () => {
                return contract.positions(limit, offset, account);
            });

            if (batch && batch.length > 0) {
                for (const pos of batch) {
                    if (pos.lp !== ethers.ZeroAddress && pos.lp !== '0x0000000000000000000000000000000000000000') {
                        if (pos.liquidity > 0n || pos.staked > 0n || pos.id > 0n) {
                            const p = parsePosition(pos);
                            if (!allPositions.some(existing => existing.id === p.id && existing.lp === p.lp)) {
                                allPositions.push(p);
                            }
                        }
                    }
                }
            }
        } catch (e: any) {
            console.warn(`   ⚠️ Error calling positions(offset=${offset}):`, e.message);
        }
    }

    console.log(`   Found ${allPositions.length} positions after scanning 'positions()'`);

    // 2. Fetch from positionsUnstakedConcentrated()
    for (let offset = 0; offset < maxPoolsToCheck; offset += limit) {
        try {
            const batch = await rateLimiter.execute(async () => {
                return contract.positionsUnstakedConcentrated(limit, offset, account);
            });

            if (batch && batch.length > 0) {
                for (const pos of batch) {
                    if (pos.lp !== ethers.ZeroAddress && pos.lp !== '0x0000000000000000000000000000000000000000') {
                        if (pos.liquidity > 0n || pos.staked > 0n || pos.id > 0n) {
                            const p = parsePosition(pos);
                            if (!allPositions.some(existing => existing.id === p.id && existing.lp === p.lp)) {
                                allPositions.push(p);
                            }
                        }
                    }
                }
            }
        } catch (e: any) {
            // console.warn(`   ⚠️ Error calling positionsUnstakedConcentrated(offset=${offset}):`, e.message);
        }
    }

    console.log(`   ✅ Total unique positions found: ${allPositions.length}`);
    return allPositions;
}

/**
 * Fetch pool data by address
 * Fallback to direct contract calls since LpSugar.byAddress is missing.
 */
export async function fetchPoolData(poolAddress: string): Promise<LpPool> {
    // Check cache first
    const cached = poolCache.get(poolAddress);
    if (cached) return cached;

    // Direct Contract Calls
    const provider = getProvider();
    const poolContract = new Contract(poolAddress, CL_POOL_ABI, provider);

    // console.log(`   Fetching details for pool: ${poolAddress}`);

    try {
        const [slot0, token0Addr, token1Addr, liquidity, tickSpacing] = await Promise.all([
            rateLimiter.execute(() => poolContract.slot0()),
            rateLimiter.execute(() => poolContract.token0()),
            rateLimiter.execute(() => poolContract.token1()),
            rateLimiter.execute(() => poolContract.liquidity()),
            rateLimiter.execute(() => poolContract.tickSpacing())
        ]);

        // Fetch Token Details
        const token0Contract = new Contract(token0Addr, ERC20_ABI, provider);
        const token1Contract = new Contract(token1Addr, ERC20_ABI, provider);

        const [symbol0, decimals0, symbol1, decimals1] = await Promise.all([
            rateLimiter.execute(() => token0Contract.symbol()),
            rateLimiter.execute(() => token0Contract.decimals()),
            rateLimiter.execute(() => token1Contract.symbol()),
            rateLimiter.execute(() => token1Contract.decimals())
        ]);

        const symbol = `${symbol0}/${symbol1}`; // Synthetic symbol

        const poolData: LpPool = {
            lp: poolAddress,
            symbol: symbol,
            decimals: 18, // Placeholder or aggregated
            liquidity: liquidity,
            type_: 0, // 0 for CL usually? Not critical for monitoring
            tick: Number(slot0.tick), // Current Tick!
            sqrt_ratio: slot0.sqrtPriceX96,
            token0: token0Addr,
            reserve0: 0n, // Not fetching reserves to save calls, not needed for range check
            staked0: 0n,
            token1: token1Addr,
            reserve1: 0n,
            staked1: 0n,
            gauge: ethers.ZeroAddress, // Don't know gauge from Pool
            gauge_liquidity: 0n,
            gauge_alive: true,
            fee: ethers.ZeroAddress,
            bribe: ethers.ZeroAddress,
            factory: ethers.ZeroAddress,
            emissions: 0n,
            emissions_token: ethers.ZeroAddress,
            emissions_cap: 0n,
            pool_fee: 0n,
            unstaked_fee: 0n,
            token0_fees: 0n,
            token1_fees: 0n,
            locked: 0n,
            emerging: false,
            created_at: 0n,
            nfpm: ethers.ZeroAddress,
            alm: ethers.ZeroAddress,
            root: ethers.ZeroAddress,
        };

        // Cache the result
        poolCache.set(poolAddress, poolData);
        return poolData;

    } catch (error: any) {
        console.error(`   ⚠️ Failed to fetch pool details direct: ${error.message}`);
        throw error;
    }
}

/**
 * Fetch pool data for multiple pools (deduplicated)
 */
export async function fetchPoolsForPositions(
    positions: Position[]
): Promise<Map<string, LpPool>> {
    const poolMap = new Map<string, LpPool>();
    const uniquePools = [...new Set(positions.map((p) => p.lp))];
    console.log(`📊 Fetching data for ${uniquePools.length} unique pools...`);

    for (const poolAddress of uniquePools) {
        try {
            const pool = await fetchPoolData(poolAddress);
            poolMap.set(poolAddress, pool);
        } catch (error) {
            console.error(`   ⚠️ Failed to fetch pool ${poolAddress}:`, error);
        }
    }

    return poolMap;
}

/**
 * Check if a position is a concentrated liquidity position
 */
export function isConcentratedLiquidityPosition(position: Position): boolean {
    return position.id > 0n;
}
