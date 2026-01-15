/**
 * Position monitoring logic
 */
import { Position, LpPool } from '../abis/lp-sugar';
import {
    fetchPositions,
    fetchPoolsForPositions,
    isConcentratedLiquidityPosition,
} from './sugar';
import {
    sendOutOfRangeAlert,
    sendBackInRangeAlert,
    sendUnstakedAlert,
} from './notifier';
import { config } from '../config';

export interface PositionStatus {
    positionId: bigint;
    poolAddress: string;
    poolSymbol: string;
    isInRange: boolean;
    currentTick: number;
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    isStaked: boolean;
}

// Track previous state for both Range and Staked status
interface PositionState {
    isInRange: boolean;
    isStaked: boolean;
    lastOutOfRangeAlertTime: number; // Timestamp of last out-of-range alert
    lastUnstakedAlertTime: number;   // Timestamp of last unstaked alert
}

const previousStates = new Map<string, PositionState>();

// Cooldown: 1 hour in milliseconds
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

export function isPositionInRange(
    position: Position,
    pool: LpPool
): boolean {
    return pool.tick >= position.tick_lower && pool.tick < position.tick_upper;
}

export function getPositionStatus(
    position: Position,
    pool: LpPool
): PositionStatus {
    return {
        positionId: position.id,
        poolAddress: position.lp,
        poolSymbol: pool.symbol,
        isInRange: isPositionInRange(position, pool),
        currentTick: pool.tick,
        tickLower: position.tick_lower,
        tickUpper: position.tick_upper,
        liquidity: position.liquidity,
        isStaked: position.staked > 0n,
    };
}

export async function monitorPositions(): Promise<{
    statuses: PositionStatus[];
    clPositions: Position[];
}> {
    const allPositions = await fetchPositions(config.walletAddress);

    const clPositions = allPositions.filter(isConcentratedLiquidityPosition);
    console.log(`   ${clPositions.length} concentrated liquidity positions`);

    if (clPositions.length === 0) {
        return { statuses: [], clPositions: [] };
    }

    const poolMap = await fetchPoolsForPositions(clPositions);
    const statuses: PositionStatus[] = [];

    for (const position of clPositions) {
        const pool = poolMap.get(position.lp);
        if (!pool) {
            console.warn(`   ⚠️ Missing pool data for ${position.lp}`);
            continue;
        }

        const status = getPositionStatus(position, pool);
        statuses.push(status);
    }

    return { statuses, clPositions };
}

export async function checkAndAlert(): Promise<PositionStatus[]> {
    console.log(`\n🔍 Checking positions at ${new Date().toLocaleTimeString()}...`);

    const { statuses } = await monitorPositions();
    const currentTime = Date.now();

    if (statuses.length === 0) {
        console.log('   No concentrated liquidity positions found');
        return [];
    }

    let inRangeCount = 0;
    let outOfRangeCount = 0;

    for (const status of statuses) {
        const positionKey = `${status.poolAddress}-${status.positionId}`;
        const prevState = previousStates.get(positionKey);

        const isNowInRange = status.isInRange;
        const isNowStaked = status.isStaked;
        const stakedStr = isNowStaked ? '[Staked]' : '[Unstaked]';

        const rangeStatus = isNowInRange ? '✅' : '❌';
        console.log(
            `   ${stakedStr} ${status.poolSymbol} (#${status.positionId}) ${rangeStatus} ` +
            `Tick: ${status.currentTick} | Range: [${status.tickLower}, ${status.tickUpper}]`
        );

        if (isNowInRange) inRangeCount++;
        else outOfRangeCount++;

        // Initialize state if first time seeing this position
        let lastOutOfRange = prevState?.lastOutOfRangeAlertTime || 0;
        let lastUnstaked = prevState?.lastUnstakedAlertTime || 0;

        // ALERT LOGIC

        // 1. Unstaked Alert
        if (!isNowStaked) {
            const wasStaked = prevState?.isStaked ?? true; // Assume was staked if new
            const isTransition = wasStaked === true;
            const cooldownExpired = (currentTime - lastUnstaked) > ALERT_COOLDOWN_MS;

            if (isTransition || cooldownExpired) {
                console.log(`   📱 Alerting: Position #${status.positionId} is UNSTAKED`);
                await sendUnstakedAlert(
                    status.poolSymbol,
                    status.positionId,
                    status.currentTick,
                    status.tickLower,
                    status.tickUpper
                );
                lastUnstaked = currentTime;
            }
        } else {
            // Reset cooldown if it's staked now
            lastUnstaked = 0;
        }

        // 2. Range Alert
        if (!isNowInRange) {
            const wasInRange = prevState?.isInRange ?? true; // Assume was in range if new
            const isTransition = wasInRange === true;
            const cooldownExpired = (currentTime - lastOutOfRange) > ALERT_COOLDOWN_MS;

            if (isTransition || cooldownExpired) {
                console.log(`   📱 Alerting: Position #${status.positionId} is OUT OF RANGE`);
                await sendOutOfRangeAlert(
                    status.poolSymbol,
                    status.positionId,
                    status.currentTick,
                    status.tickLower,
                    status.tickUpper,
                    isNowStaked
                );
                lastOutOfRange = currentTime;
            }
        } else {
            // BACK IN RANGE CHECK
            if (prevState && !prevState.isInRange) {
                console.log(`   📱 Alerting: Position #${status.positionId} is BACK IN RANGE`);
                await sendBackInRangeAlert(
                    status.poolSymbol,
                    status.positionId,
                    status.currentTick,
                    status.tickLower,
                    status.tickUpper,
                    isNowStaked
                );
            }
            // Reset cooldown if it's in range now
            lastOutOfRange = 0;
        }

        // Update state
        previousStates.set(positionKey, {
            isInRange: isNowInRange,
            isStaked: isNowStaked,
            lastOutOfRangeAlertTime: lastOutOfRange,
            lastUnstakedAlertTime: lastUnstaked
        });
    }

    console.log(`   Summary: ${inRangeCount} in range, ${outOfRangeCount} out of range`);
    return statuses;
}

export function countOutOfRange(statuses: PositionStatus[]): number {
    return statuses.filter((s) => !s.isInRange).length;
}
