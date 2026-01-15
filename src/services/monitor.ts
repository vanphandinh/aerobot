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
}

const previousStates = new Map<string, PositionState>();

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

    const { statuses, clPositions } = await monitorPositions();

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

        // ALERT LOGIC

        // 1. Unstaked Check
        // Alert if:
        // - First time seeing position + It is Unstaked
        // - OR Position WAS Staked + NOW Unstaked
        const isUnstakedEvent = (!prevState && !isNowStaked) || (prevState && prevState.isStaked && !isNowStaked);

        if (isUnstakedEvent) {
            console.log(`   ⚠️ Alerting: Position #${status.positionId} is UNSTAKED`);
            await sendUnstakedAlert(
                status.poolSymbol,
                status.positionId,
                status.currentTick,
                status.tickLower,
                status.tickUpper
            );
        }

        // 2. Range Check
        if (prevState) {
            // State change
            if (prevState.isInRange !== isNowInRange) {
                if (isNowInRange) {
                    await sendBackInRangeAlert(
                        status.poolSymbol,
                        status.positionId,
                        status.currentTick,
                        status.tickLower,
                        status.tickUpper,
                        isNowStaked
                    );
                } else {
                    await sendOutOfRangeAlert(
                        status.poolSymbol,
                        status.positionId,
                        status.currentTick,
                        status.tickLower,
                        status.tickUpper,
                        isNowStaked
                    );
                }
            }
        } else {
            // New position found
            if (!isNowInRange) {
                await sendOutOfRangeAlert(
                    status.poolSymbol,
                    status.positionId,
                    status.currentTick,
                    status.tickLower,
                    status.tickUpper,
                    isNowStaked
                );
            }
        }

        // Update state
        previousStates.set(positionKey, {
            isInRange: isNowInRange,
            isStaked: isNowStaked
        });
    }

    console.log(`   Summary: ${inRangeCount} in range, ${outOfRangeCount} out of range`);
    return statuses;
}

export function countOutOfRange(statuses: PositionStatus[]): number {
    return statuses.filter((s) => !s.isInRange).length;
}
