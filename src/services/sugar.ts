/**
 * Sugar contract service for interacting with Aerodrome LpSugar
 * and direct Pool/Token interactions where Sugar is insufficient.
 */
import { ethers, Contract, JsonRpcProvider } from 'ethers';
import { LP_SUGAR_ADDRESS, LP_SUGAR_ABI, Position, LpPool } from '../abis/lp-sugar';
import { Cache } from '../utils/cache';
import { getRateLimiter } from '../utils/rate-limiter';
import { config } from '../config';
import { batchProvider, BatchCall } from '../utils/batch-provider';

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

function processPosition(pos: any, allPositions: Position[]) {
    if (pos.lp !== ethers.ZeroAddress && pos.lp !== '0x0000000000000000000000000000000000000000') {
        if (pos.liquidity > 0n || pos.staked > 0n || pos.id > 0n) {
            const p = parsePosition(pos);
            if (!allPositions.some(existing => existing.id === p.id && existing.lp === p.lp)) {
                allPositions.push(p);
            }
        }
    }
}

/**
 * Fetch all positions for a given account
 * Uses JSON-RPC batching to reduce HTTP requests.
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

    console.log(`📊 Fetching positions for ${account} (Batched)...`);

    // Prepare Call Batches
    const calls: BatchCall[] = [];

    for (let offset = 0; offset < maxPoolsToCheck; offset += limit) {
        calls.push({
            target: LP_SUGAR_ADDRESS,
            abi: LP_SUGAR_ABI,
            method: 'positions',
            params: [limit, offset, account]
        });

        calls.push({
            target: LP_SUGAR_ADDRESS,
            abi: LP_SUGAR_ABI,
            method: 'positionsUnstakedConcentrated',
            params: [limit, offset, account]
        });
    }

    console.log(`   🚀 Sending ${calls.length} RPC calls in batches...`);

    try {
        const results = await batchProvider.execute(calls);

        for (const res of results) {
            if (res.success && res.data && res.data.length > 0) {
                // Ethers decodeFunctionResult returns Result object (array-like)
                const batch = res.data[0];
                if (Array.isArray(batch)) {
                    for (const pos of batch) {
                        processPosition(pos, allPositions);
                    }
                }
            }
        }

    } catch (e: any) {
        console.error(`   ❌ Error executing batch:`, e);
    }

    console.log(`   Found ${allPositions.length} raw positions. Deduplicating...`);
    const uniquePositions = allPositions.filter((p, index, self) =>
        index === self.findIndex((t) => (t.id === p.id && t.lp === p.lp))
    );

    console.log(`   ✅ Total unique positions found: ${uniquePositions.length}`);
    return uniquePositions;
}

export async function fetchPoolData(poolAddress: string): Promise<LpPool> {
    // Check cache first
    const cached = poolCache.get(poolAddress);
    if (cached) return cached;

    // Fallback to single fetch (using dummy implementation or just reusing logic manually if needed)
    // But ideally we use batching. For single fetch, we can just use simple batch of 1 set of calls.
    // Let's implement it properly using standard provider for simple single call to avoid circle dep or complexity.
    // Actually, stick to original implementation for single fetch to be safe?
    // No, let's use the efficient batch fetch logic but just for one pool.

    const map = await fetchPoolsForPositions([{ lp: poolAddress } as any]);
    const res = map.get(poolAddress);
    if (!res) throw new Error("Failed to fetch pool data");
    return res;
}

/**
 * Fetch pool data for multiple pools using 2-stage Batching
 */
export async function fetchPoolsForPositions(
    positions: Position[]
): Promise<Map<string, LpPool>> {
    const poolMap = new Map<string, LpPool>();
    const uniquePools = [...new Set(positions.map((p) => p.lp))].filter(addr => !poolCache.get(addr));

    // Fill from cache first
    positions.forEach(p => {
        const cached = poolCache.get(p.lp);
        if (cached) poolMap.set(p.lp, cached);
    });

    if (uniquePools.length === 0) return poolMap;

    console.log(`📊 Batch fetching data for ${uniquePools.length} new pools...`);

    // Stage 1: Fetch Pool Basics (Slot0, Tokens, Liquidity)
    const stage1Calls: BatchCall[] = [];
    uniquePools.forEach(poolAddr => {
        stage1Calls.push({ target: poolAddr, abi: CL_POOL_ABI, method: 'slot0', params: [] });
        stage1Calls.push({ target: poolAddr, abi: CL_POOL_ABI, method: 'token0', params: [] });
        stage1Calls.push({ target: poolAddr, abi: CL_POOL_ABI, method: 'token1', params: [] });
        stage1Calls.push({ target: poolAddr, abi: CL_POOL_ABI, method: 'liquidity', params: [] });
    });

    const stage1Results = await batchProvider.execute(stage1Calls);
    const tempPoolData: any[] = [];
    const tokenAddresses = new Set<string>();

    for (let i = 0; i < uniquePools.length; i++) {
        const base = i * 4;
        const rSlot0 = stage1Results[base];
        const rToken0 = stage1Results[base + 1];
        const rToken1 = stage1Results[base + 2];
        const rLiq = stage1Results[base + 3];

        if (rSlot0.success && rToken0.success && rToken1.success && rLiq.success) {
            const t0 = rToken0.data[0];
            const t1 = rToken1.data[0];
            tokenAddresses.add(t0);
            tokenAddresses.add(t1);

            tempPoolData.push({
                lp: uniquePools[i],
                slot0: rSlot0.data,
                token0: t0,
                token1: t1,
                netLiquidity: rLiq.data[0]
            });
        }
    }

    // Stage 2: Fetch Token Symbols/Decimals
    const uniqueTokenList = [...tokenAddresses];
    const stage2Calls: BatchCall[] = [];
    uniqueTokenList.forEach(tokenAddr => {
        stage2Calls.push({ target: tokenAddr, abi: ERC20_ABI, method: 'symbol', params: [] });
    });

    const stage2Results = await batchProvider.execute(stage2Calls);
    const tokenSymbolMap = new Map<string, string>();

    stage2Results.forEach((res, idx) => {
        if (res.success) {
            tokenSymbolMap.set(uniqueTokenList[idx], res.data[0]);
        }
    });

    // Assemble Final Objects
    for (const p of tempPoolData) {
        const s0 = tokenSymbolMap.get(p.token0) || '???';
        const s1 = tokenSymbolMap.get(p.token1) || '???';

        const poolData: LpPool = {
            lp: p.lp,
            symbol: `${s0}/${s1}`,
            decimals: 18,
            liquidity: p.netLiquidity,
            type_: 0,
            tick: Number(p.slot0.tick),
            sqrt_ratio: p.slot0.sqrtPriceX96,
            token0: p.token0,
            token1: p.token1,
            // Defaults
            reserve0: 0n, staked0: 0n, reserve1: 0n, staked1: 0n,
            gauge: ethers.ZeroAddress, gauge_liquidity: 0n, gauge_alive: true,
            fee: ethers.ZeroAddress, bribe: ethers.ZeroAddress, factory: ethers.ZeroAddress,
            emissions: 0n, emissions_token: ethers.ZeroAddress, emissions_cap: 0n,
            pool_fee: 0n, unstaked_fee: 0n, token0_fees: 0n, token1_fees: 0n,
            locked: 0n, emerging: false, created_at: 0n,
            nfpm: ethers.ZeroAddress, alm: ethers.ZeroAddress, root: ethers.ZeroAddress,
        };

        poolCache.set(p.lp, poolData);
        poolMap.set(p.lp, poolData);
    }

    return poolMap;
}

export function isConcentratedLiquidityPosition(position: Position): boolean {
    return position.id > 0n;
}
