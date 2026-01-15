import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export interface Config {
    walletAddress: string;
    rpcUrl: string;
    ntfyTopic: string;
    ntfyServer: string;
    pollIntervalMs: number;
    cacheTtlMs: number;
    minRpcDelayMs: number;
}

function getEnvVar(name: string, required: boolean = true): string {
    const value = process.env[name];
    if (required && !value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value || '';
}

function getEnvNumber(name: string, defaultValue: number): number {
    const value = process.env[name];
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new Error(`Invalid number for environment variable: ${name}`);
    }
    return parsed;
}

export function loadConfig(): Config {
    return {
        walletAddress: getEnvVar('WALLET_ADDRESS'),
        rpcUrl: getEnvVar('BASE_RPC_URL', false) || 'https://mainnet.base.org',
        ntfyTopic: getEnvVar('NTFY_TOPIC'),
        ntfyServer: getEnvVar('NTFY_SERVER', false) || 'https://ntfy.sh',
        pollIntervalMs: getEnvNumber('POLL_INTERVAL_MS', 60000),
        cacheTtlMs: getEnvNumber('CACHE_TTL_MS', 30000),
        minRpcDelayMs: getEnvNumber('MIN_RPC_DELAY_MS', 100),
    };
}

export const config = loadConfig();
