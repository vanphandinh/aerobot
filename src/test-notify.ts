/**
 * Test notification script
 */
import { config } from './config';
import { sendTestNotification } from './services/notifier';

async function main(): Promise<void> {
    console.log('🧪 Testing ntfy.sh notification...');
    console.log(`   Server: ${config.ntfyServer}`);
    console.log(`   Topic: ${config.ntfyTopic}`);
    console.log('');

    if (!config.ntfyTopic || config.ntfyTopic.includes('your-unique-id')) {
        console.error('❌ Please set NTFY_TOPIC in .env file first');
        process.exit(1);
    }

    console.log(`📱 Sending test notification to ${config.ntfyServer}/${config.ntfyTopic}...`);
    const success = await sendTestNotification();

    if (success) {
        console.log('✅ Standard notification sent!');
    }

    console.log(`📱 Sending test UNSTAKED alert...`);
    // Simulate an unstaked alert
    // function sendUnstakedAlert(poolSymbol, positionId, currentTick, tickLower, tickUpper)
    const { sendUnstakedAlert } = require('./services/notifier');
    const successUnstaked = await sendUnstakedAlert('TEST-Token/USDC', 123456, 1000, 900, 1100);

    if (successUnstaked) {
        console.log('✅ Unstaked notification sent! Check your phone.');
    } else {
        console.log('❌ Failed to send notifications.');
    }
}

main().catch(console.error);
