/**
 * Notification service using ntfy.sh
 */
import { config } from '../config';

export type Priority = 'min' | 'low' | 'default' | 'high' | 'urgent';

interface NtfyAction {
    action: 'view' | 'broadcast' | 'http';
    label: string;
    url?: string;
    clear?: boolean;
}

interface NtfyMessage {
    topic: string;
    title?: string;
    message: string;
    priority?: number;
    tags?: string[];
    markdown?: boolean;
    actions?: NtfyAction[];
}

const PRIORITY_MAP: Record<Priority, number> = {
    min: 1,
    low: 2,
    default: 3,
    high: 4,
    urgent: 5,
};

export async function sendNotification(
    message: string,
    title?: string,
    priority: Priority = 'default',
    tags: string[] = [],
    clickUrl?: string
): Promise<boolean> {
    try {
        // When sending JSON with a 'topic' field, we must POST to the root URL
        // e.g. https://ntfy.sh
        // If we POST to /topic, the body is interpreted as the message text.
        const url = config.ntfyServer;

        const body: NtfyMessage = {
            topic: config.ntfyTopic,
            message,
            title,
            priority: PRIORITY_MAP[priority],
            tags,
            markdown: true,
            actions: clickUrl ? [{
                action: 'view',
                label: 'View on BaseScan',
                url: clickUrl
            }] : undefined
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            console.error(`❌ Failed to send notification: ${response.status} ${response.statusText}`);
            return false;
        }

        console.log(`📱 Notification sent: ${title || message}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending notification:', error);
        return false;
    }
}

export async function sendOutOfRangeAlert(
    poolSymbol: string,
    positionId: number | bigint,
    currentTick: number,
    tickLower: number,
    tickUpper: number,
    isStaked: boolean
): Promise<boolean> {
    const direction = currentTick < tickLower ? 'below' : 'above';
    const stakeStatus = isStaked ? '✅ Staked' : '⚠️ Unstaked';

    // Markdown format
    const message =
        `**${poolSymbol}** #${positionId}\n` +
        `**Status:** ${stakeStatus}\n` +
        `**Current:** \`${currentTick}\`\n` +
        `**Range:** \`[${tickLower}, ${tickUpper}]\`\n` +
        `📉 Price moved **${direction}** range!`;

    return sendNotification(message, `⚠️ Position Out of Range`, 'high', ['warning', 'chart_with_downwards_trend']);
}

export async function sendBackInRangeAlert(
    poolSymbol: string,
    positionId: number | bigint,
    currentTick: number,
    tickLower: number,
    tickUpper: number,
    isStaked: boolean
): Promise<boolean> {
    const stakeStatus = isStaked ? '✅ Staked' : '⚠️ Unstaked';
    const message =
        `**${poolSymbol}** #${positionId}\n` +
        `**Status:** ${stakeStatus}\n` +
        `**Current:** \`${currentTick}\`\n` +
        `**Range:** \`[${tickLower}, ${tickUpper}]\`\n` +
        `💰 Earning fees again!`;

    return sendNotification(message, `✅ Position Back In Range`, 'default', ['white_check_mark', 'chart_with_upwards_trend']);
}

export async function sendUnstakedAlert(
    poolSymbol: string,
    positionId: number | bigint,
    currentTick: number,
    tickLower: number,
    tickUpper: number
): Promise<boolean> {
    const message =
        `**${poolSymbol}** #${positionId}\n` +
        `**Current:** \`${currentTick}\`\n` +
        `**Range:** \`[${tickLower}, ${tickUpper}]\`\n` +
        `ℹ️ This position is **not staked**.\n` +
        `Stake it now to earn AERO emissions!`;

    return sendNotification(message, `⚠️ Position Unstaked!`, 'high', ['money_with_wings', 'exclamation']);
}

export async function sendStartupNotification(
    walletAddress: string,
    totalPositions: number,
    clPositions: number,
    outOfRangeCount: number
): Promise<boolean> {
    const title = `🚀 Aerodrome Monitor Started`;
    const message =
        `Wallet: \`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\`\n` +
        `Total positions: **${totalPositions}**\n` +
        `CL positions: **${clPositions}**\n` +
        `Out of range: **${outOfRangeCount}**`;

    return sendNotification(message, title, 'low', ['rocket']);
}

export async function sendTestNotification(): Promise<boolean> {
    return sendNotification(
        'If you see this, **Markdown notifications** are working correctly!',
        '🧪 Test Notification',
        'default',
        ['test_tube']
    );
}
