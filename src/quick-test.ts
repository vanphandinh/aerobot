/**
 * Quick test script to verify contract interaction
 */
import { config } from './config';
import { fetchPositions, fetchPoolData, isConcentratedLiquidityPosition } from './services/sugar';
import { isPositionInRange } from './services/monitor';

async function main(): Promise<void> {
    console.log('🧪 Quick Contract Test');
    console.log('━'.repeat(50));
    console.log(`RPC: ${config.rpcUrl.replace(/\/v2\/.*$/, '/v2/***')}`);
    console.log(`Wallet: ${config.walletAddress}`);
    console.log('━'.repeat(50));

    try {
        console.log('\n1️⃣ Testing positions fetch...');
        const positions = await fetchPositions(config.walletAddress);
        console.log(`   ✅ Fetched ${positions.length} positions`);

        const clPositions = positions.filter(isConcentratedLiquidityPosition);
        console.log(`   ✅ ${clPositions.length} are concentrated liquidity positions`);

        if (clPositions.length > 0) {
            const firstCL = clPositions[0];
            console.log(`\n2️⃣ Testing pool data fetch for first CL position...`);
            console.log(`   Pool address: ${firstCL.lp}`);

            const pool = await fetchPoolData(firstCL.lp);
            console.log(`   ✅ Pool symbol: ${pool.symbol}`);
            console.log(`   ✅ Current tick: ${pool.tick}`);

            console.log(`\n3️⃣ Checking range status...`);
            const stakedStatus = firstCL.staked > 0n ? 'YES' : 'NO';
            console.log(`   Position ID: ${firstCL.id}`);
            console.log(`   Staked: ${stakedStatus}`);
            console.log(`   Tick range: [${firstCL.tick_lower}, ${firstCL.tick_upper}]`);

            const inRange = isPositionInRange(firstCL, pool);
            console.log(`   ✅ In range: ${inRange ? 'YES' : 'NO'}`);
        }

        console.log('\n✅ All tests passed!');
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

main();
