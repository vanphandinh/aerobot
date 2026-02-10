/**
 * RPC Manager Service
 * 
 * Automatically fetches and updates Base RPC addresses from Aerodrome
 * - Fetches RPC on application startup
 * - Updates RPC when errors occur
 */

import https from 'https';
import http from 'http';
import { EventEmitter } from 'events';

interface RpcManagerConfig {
    maxRetries: number;
    retryDelayMs: number;
    timeout: number;
}

const DEFAULT_CONFIG: RpcManagerConfig = {
    maxRetries: 3,
    retryDelayMs: 5000,
    timeout: 10000,
};

export class RpcManager extends EventEmitter {
    private currentRpc: string | null = null;
    private allRpcAddresses: string[] = [];
    private currentRpcIndex: number = 0;
    private config: RpcManagerConfig;
    private isInitialized: boolean = false;
    private failureCount: Map<string, number> = new Map();

    constructor(config: Partial<RpcManagerConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize RPC Manager - fetch RPC on startup
     */
    async initialize(fallbackRpc: string): Promise<string> {
        console.log('🔌 Initializing RPC Manager...');
        
        try {
            // Try to fetch RPC from Aerodrome
            const rpcList = await this.fetchBaseRpc();
            
            if (rpcList && rpcList.length > 0) {
                this.allRpcAddresses = rpcList;
                this.currentRpc = rpcList[0];
                this.currentRpcIndex = 0;
                this.isInitialized = true;
                
                console.log(`✅ RPC Manager initialized with ${rpcList.length} address(es)`);
                console.log(`📡 Using RPC: ${this.currentRpc}`);
                
                this.emit('initialized', { rpc: this.currentRpc, count: rpcList.length });
                return this.currentRpc;
            }
        } catch (error) {
            console.warn('⚠️  Could not fetch RPC from Aerodrome, using fallback');
        }
        
        // Fallback RPC if unable to fetch
        this.currentRpc = fallbackRpc;
        this.allRpcAddresses = [fallbackRpc];
        this.isInitialized = true;
        
        this.emit('initialized-fallback', { rpc: fallbackRpc });
        return fallbackRpc;
    }

    /**
     * Get current RPC
     */
    getCurrentRpc(): string {
        if (!this.currentRpc) {
            throw new Error('RPC Manager not initialized');
        }
        return this.currentRpc;
    }

    /**
     * When RPC fails, automatically switch to next RPC or refresh
     */
    async handleRpcError(failedRpc: string): Promise<string> {
        console.error(`❌ RPC error detected: ${failedRpc}`);
        
        // Increment failure count
        const failureCount = (this.failureCount.get(failedRpc) || 0) + 1;
        this.failureCount.set(failedRpc, failureCount);
        
        // If current RPC failed, switch to next RPC
        if (failedRpc === this.currentRpc) {
            if (this.allRpcAddresses.length > 1) {
                // Switch to next RPC in list
                this.currentRpcIndex = (this.currentRpcIndex + 1) % this.allRpcAddresses.length;
                this.currentRpc = this.allRpcAddresses[this.currentRpcIndex];
                
                console.log(`🔄 Switched to RPC: ${this.currentRpc}`);
                this.emit('rpc-switched', { newRpc: this.currentRpc });
                
                return this.currentRpc;
            } else {
                // Only one RPC, try to refresh from Aerodrome
                console.log('🔄 Attempting to refresh RPC from Aerodrome...');
                return await this.refreshRpcNow();
            }
        }
        
        return this.currentRpc!;
    }

    /**
     * Refresh RPC immediately from Aerodrome
     */
    async refreshRpcNow(): Promise<string> {
        try {
            const rpcList = await this.fetchBaseRpc();
            
            if (rpcList && rpcList.length > 0) {
                this.allRpcAddresses = rpcList;
                this.currentRpcIndex = 0;
                this.currentRpc = rpcList[0];
                this.failureCount.clear();
                
                console.log(`✅ RPC refreshed: found ${rpcList.length} address(es)`);
                console.log(`📡 Using RPC: ${this.currentRpc}`);
                
                this.emit('rpc-refreshed', { rpc: this.currentRpc, count: rpcList.length });
                
                return this.currentRpc;
            }
        } catch (error) {
            console.error('⚠️  RPC refresh failed:', error);
        }
        
        // If refresh fails, keep current RPC
        return this.currentRpc!;
    }

    /**
     * Get list of all RPC addresses
     */
    getAllRpcAddresses(): string[] {
        return [...this.allRpcAddresses];
    }

    /**
     * Get failure count for an RPC
     */
    getFailureCount(rpc: string): number {
        return this.failureCount.get(rpc) || 0;
    }

    /**
     * Fetch RPC from Aerodrome
     */
    private async fetchBaseRpc(): Promise<string[] | null> {
        const baseUrl = 'https://aero.drome.eth.link';
        const allRpc: Set<string> = new Set();
        
        try {
            console.log(`📡 Fetching RPC from ${baseUrl}...`);
            
            // Load main HTML
            const html = await this.fetchUrl(baseUrl);
            if (!html) return null;
            
            console.log('✓ HTML loaded successfully');
            
            // Find JS files
            const jsFilePattern = /(?:src|href)=["']([^"']*\.js[^"']*?)["']/gi;
            const jsFiles: string[] = [];
            let match;
            
            while ((match = jsFilePattern.exec(html)) !== null) {
                jsFiles.push(match[1]);
            }
            
            console.log(`✓ Found ${jsFiles.length} JavaScript files\n`);
            
            // Check each JS file
            for (const jsFile of jsFiles) {
                if (jsFiles.length > 20) break; // Limit number of files to check
                
                let jsUrl: string;
                if (jsFile.startsWith('/')) {
                    jsUrl = `${baseUrl}${jsFile}`;
                } else if (jsFile.startsWith('http')) {
                    jsUrl = jsFile;
                } else {
                    jsUrl = `${baseUrl}/${jsFile}`;
                }
                
                const displayName = jsFile.split('/').pop() || jsFile;
                process.stdout.write(`  🔎 ${displayName.substring(0, 40)}... `);
                
                try {
                    const content = await this.fetchUrl(jsUrl);
                    
                    if (content) {
                        // Find RPC Base URL by regex
                        const rpcPattern = /https:\/\/lb\.drpc\.live\/base\/[a-zA-Z0-9_\-]+/g;
                        const rpcMatches = content.match(rpcPattern);
                        
                        if (rpcMatches) {
                            rpcMatches.forEach(rpc => allRpc.add(rpc));
                            console.log(`✅ Found ${rpcMatches.length}`);
                        } else {
                            console.log('⏭️  No RPC');
                        }
                    } else {
                        console.log('⏭️  Empty');
                    }
                } catch (error) {
                    console.log('✗ Error');
                }
            }
            
            if (allRpc.size > 0) {
                const rpcList = Array.from(allRpc);
                console.log(`\n✅ Found ${rpcList.length} RPC address(es):`);
                rpcList.forEach((rpc, idx) => {
                    console.log(`   ${idx + 1}. ${rpc}`);
                });
                return rpcList;
            } else {
                console.log('\n⚠️  No RPC found');
                return null;
            }
        } catch (error) {
            console.error('Error fetching RPC:', error);
            return null;
        }
    }

    /**
     * Fetch URL helper
     */
    private fetchUrl(url: string): Promise<string | null> {
        return new Promise((resolve) => {
            const isHttps = url.startsWith('https');
            const protocol = isHttps ? https : http;
            
            const timeoutId = setTimeout(() => {
                resolve(null);
            }, this.config.timeout);
            
            try {
                const request = protocol.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    }
                }, (response: any) => {
                    let data = '';
                    
                    response.on('data', (chunk: any) => {
                        data += chunk.toString('utf-8');
                    });
                    
                    response.on('end', () => {
                        clearTimeout(timeoutId);
                        resolve(data);
                    });
                });
                
                request.on('error', () => {
                    clearTimeout(timeoutId);
                    resolve(null);
                });
            } catch (error) {
                clearTimeout(timeoutId);
                resolve(null);
            }
        });
    }
}

// Singleton instance
let rpcManagerInstance: RpcManager | null = null;

export function getRpcManager(config?: Partial<RpcManagerConfig>): RpcManager {
    if (!rpcManagerInstance) {
        rpcManagerInstance = new RpcManager(config);
    }
    return rpcManagerInstance;
}
