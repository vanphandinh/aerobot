/**
 * LpSugar Contract ABI for Aerodrome on Base
 * Verified on BaseScan: 0x9DE6Eab7a910A288dE83a04b6A43B52Fd1246f1E
 */

export const LP_SUGAR_ADDRESS = '0x9DE6Eab7a910A288dE83a04b6A43B52Fd1246f1E';

export const LP_SUGAR_ABI = [
    // positions(uint256 _limit, uint256 _offset, address _account) -> Position[]
    {
        "name": "positions",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            { "name": "_limit", "type": "uint256" },
            { "name": "_offset", "type": "uint256" },
            { "name": "_account", "type": "address" }
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple[]",
                "components": [
                    { "name": "id", "type": "uint256" },
                    { "name": "lp", "type": "address" },
                    { "name": "liquidity", "type": "uint256" },
                    { "name": "staked", "type": "uint256" },
                    { "name": "amount0", "type": "uint256" },
                    { "name": "amount1", "type": "uint256" },
                    { "name": "staked0", "type": "uint256" },
                    { "name": "staked1", "type": "uint256" },
                    { "name": "unstaked_earned0", "type": "uint256" },
                    { "name": "unstaked_earned1", "type": "uint256" },
                    { "name": "emissions_earned", "type": "uint256" },
                    { "name": "tick_lower", "type": "int24" },
                    { "name": "tick_upper", "type": "int24" },
                    { "name": "sqrt_ratio_lower", "type": "uint160" },
                    { "name": "sqrt_ratio_upper", "type": "uint160" },
                    { "name": "locker", "type": "address" },
                    { "name": "unlocks_at", "type": "uint32" },
                    { "name": "alm", "type": "address" }
                ]
            }
        ]
    },
    // positionsUnstakedConcentrated(uint256 _limit, uint256 _offset, address _account) -> Position[]
    {
        "name": "positionsUnstakedConcentrated",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            { "name": "_limit", "type": "uint256" },
            { "name": "_offset", "type": "uint256" },
            { "name": "_account", "type": "address" }
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple[]",
                "components": [
                    { "name": "id", "type": "uint256" },
                    { "name": "lp", "type": "address" },
                    { "name": "liquidity", "type": "uint256" },
                    { "name": "staked", "type": "uint256" },
                    { "name": "amount0", "type": "uint256" },
                    { "name": "amount1", "type": "uint256" },
                    { "name": "staked0", "type": "uint256" },
                    { "name": "staked1", "type": "uint256" },
                    { "name": "unstaked_earned0", "type": "uint256" },
                    { "name": "unstaked_earned1", "type": "uint256" },
                    { "name": "emissions_earned", "type": "uint256" },
                    { "name": "tick_lower", "type": "int24" },
                    { "name": "tick_upper", "type": "int24" },
                    { "name": "sqrt_ratio_lower", "type": "uint160" },
                    { "name": "sqrt_ratio_upper", "type": "uint160" },
                    { "name": "locker", "type": "address" },
                    { "name": "unlocks_at", "type": "uint32" },
                    { "name": "alm", "type": "address" }
                ]
            }
        ]
    },
    // count() -> uint256
    {
        "name": "count",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [
            { "name": "", "type": "uint256" }
        ]
    },
    // byAddress(address _pool) -> Lp
    {
        "name": "byAddress",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            { "name": "_pool", "type": "address" }
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "components": [
                    { "name": "lp", "type": "address" },
                    { "name": "symbol", "type": "string" },
                    { "name": "decimals", "type": "uint8" },
                    { "name": "liquidity", "type": "uint256" },
                    { "name": "type_", "type": "int24" },
                    { "name": "tick", "type": "int24" },
                    { "name": "sqrt_ratio", "type": "uint160" },
                    { "name": "token0", "type": "address" },
                    { "name": "reserve0", "type": "uint256" },
                    { "name": "staked0", "type": "uint256" },
                    { "name": "token1", "type": "address" },
                    { "name": "reserve1", "type": "uint256" },
                    { "name": "staked1", "type": "uint256" },
                    { "name": "gauge", "type": "address" },
                    { "name": "gauge_liquidity", "type": "uint256" },
                    { "name": "gauge_alive", "type": "bool" },
                    { "name": "fee", "type": "address" },
                    { "name": "bribe", "type": "address" },
                    { "name": "factory", "type": "address" },
                    { "name": "emissions", "type": "uint256" },
                    { "name": "emissions_token", "type": "address" },
                    { "name": "emissions_cap", "type": "uint256" },
                    { "name": "pool_fee", "type": "uint256" },
                    { "name": "unstaked_fee", "type": "uint256" },
                    { "name": "token0_fees", "type": "uint256" },
                    { "name": "token1_fees", "type": "uint256" },
                    { "name": "locked", "type": "uint256" },
                    { "name": "emerging", "type": "bool" },
                    { "name": "created_at", "type": "uint256" },
                    { "name": "nfpm", "type": "address" },
                    { "name": "alm", "type": "address" },
                    { "name": "root", "type": "address" }
                ]
            }
        ]
    }
] as const;

export interface Position {
    id: bigint;
    lp: string;
    liquidity: bigint;
    staked: bigint;
    amount0: bigint;
    amount1: bigint;
    staked0: bigint;
    staked1: bigint;
    unstaked_earned0: bigint;
    unstaked_earned1: bigint;
    emissions_earned: bigint;
    tick_lower: number;
    tick_upper: number;
    sqrt_ratio_lower: bigint;
    sqrt_ratio_upper: bigint;
    locker: string;
    unlocks_at: bigint;
    alm: string;
}

export interface LpPool {
    lp: string;
    symbol: string;
    decimals: number;
    liquidity: bigint;
    type_: number;
    tick: number;
    sqrt_ratio: bigint;
    token0: string;
    reserve0: bigint;
    staked0: bigint;
    token1: string;
    reserve1: bigint;
    staked1: bigint;
    gauge: string;
    gauge_liquidity: bigint;
    gauge_alive: boolean;
    fee: string;
    bribe: string;
    factory: string;
    emissions: bigint;
    emissions_token: string;
    emissions_cap: bigint;
    pool_fee: bigint;
    unstaked_fee: bigint;
    token0_fees: bigint;
    token1_fees: bigint;
    locked: bigint;
    emerging: boolean;
    created_at: bigint;
    nfpm: string;
    alm: string;
    root: string;
}
