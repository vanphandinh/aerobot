/**
 * Aerodrome Liquidity Position Monitor
 */
import { config } from './config';
import { checkAndAlert, countOutOfRange, monitorPositions } from './services/monitor';
import { sendStartupNotification } from './services/notifier';
import { getRpcManager } from './services/rpc-manager';

let isShuttingDown = false;
let monitoringInterval: NodeJS.Timeout | null = null;
const rpcManager = getRpcManager();

async function runInitialCheck(): Promise<void> {
    console.log('🚀 Aerodrome Position Monitor');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Wallet: ${config.walletAddress}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Run the first check immediately (this will trigger alerts if needed)
    const statuses = await checkAndAlert();

    const clPositionsCount = statuses.length; // Approximate, as checkAndAlert returns statuses
    const outOfRangeCount = countOutOfRange(statuses);

    await sendStartupNotification(
        config.walletAddress,
        statuses.length,
        clPositionsCount,
        outOfRangeCount
    );

    if (outOfRangeCount > 0) {
        console.log(`\n⚠️ ${outOfRangeCount} position(s) are currently out of range`);
    }
}

async function startMonitoring(): Promise<void> {
    console.log(`\n🔄 Starting monitoring loop (every ${config.pollIntervalMs / 1000}s)...`);
    console.log('Press Ctrl+C to stop\n');

    monitoringInterval = setInterval(async () => {
        if (isShuttingDown) return;

        try {
            await checkAndAlert();
        } catch (error) {
            console.error('❌ Error during monitoring:', error);
        }
    }, config.pollIntervalMs);
}

function setupGracefulShutdown(): void {
    const shutdown = async () => {
        if (isShuttingDown) return;
        isShuttingDown = true;

        console.log('\n\n🛑 Shutting down gracefully...');

        if (monitoringInterval) {
            clearInterval(monitoringInterval);
        }

        console.log('👋 Goodbye!');
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

async function main(): Promise<void> {
    try {
        if (!config.walletAddress || config.walletAddress === '0xYourWalletAddress') {
            console.error('❌ Please set WALLET_ADDRESS in .env file');
            process.exit(1);
        }

        if (!config.ntfyTopic || config.ntfyTopic.includes('your-unique-id')) {
            console.error('❌ Please set NTFY_TOPIC in .env file');
            process.exit(1);
        }

        setupGracefulShutdown();
        
        // Initialize RPC Manager - automatically fetch RPC on startup
        console.log('\n');
        await rpcManager.initialize(config.rpcUrl);
        console.log('\n');
        
        // Setup RPC Manager event listeners
        rpcManager.on('rpc-switched', (data: any) => {
            console.log(`✅ RPC switched to: ${data.newRpc}`);
        });
        
        rpcManager.on('rpc-refreshed', (data: any) => {
            console.log(`✅ RPC refreshed: ${data.count} address(es) found`);
        });
        
        await runInitialCheck();
        await startMonitoring();
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

main();
