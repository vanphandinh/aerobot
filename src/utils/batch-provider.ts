import { ethers, Interface } from 'ethers';
import { config } from '../config';

export interface BatchCall {
    target: string;
    abi: any[] | readonly any[];
    method: string;
    params: any[];
}

export interface BatchResult {
    success: boolean;
    data: any;
}

export class BatchProvider {
    private rpcUrl: string;

    constructor(rpcUrl: string = config.rpcUrl) {
        this.rpcUrl = rpcUrl;
    }

    /**
     * Execute a batch of calls using JSON-RPC batching
     * @param calls Array of contract calls
     * @param batchSize Max calls per HTTP request (default 100)
     */
    async execute(calls: BatchCall[], batchSize: number = 100): Promise<BatchResult[]> {
        const results: BatchResult[] = new Array(calls.length);

        // Process in chunks to avoid hitting payload limits
        for (let i = 0; i < calls.length; i += batchSize) {
            const chunk = calls.slice(i, i + batchSize);
            const chunkResults = await this.processChunk(chunk);

            // Assign results back to main array
            for (let j = 0; j < chunkResults.length; j++) {
                results[i + j] = chunkResults[j];
            }
        }

        return results;
    }

    private async processChunk(calls: BatchCall[]): Promise<BatchResult[]> {
        const interfaces = calls.map(call => new Interface(call.abi));

        // 1. Construct JSON-RPC Payload
        const payload = calls.map((call, index) => {
            const iface = interfaces[index];
            const data = iface.encodeFunctionData(call.method, call.params);

            return {
                jsonrpc: "2.0",
                id: index,
                method: "eth_call",
                params: [
                    {
                        to: call.target,
                        data: data
                    },
                    "latest"
                ]
            };
        });

        // 2. Send Request
        try {
            const response = await fetch(this.rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                // Return all failed for this chunk
                return calls.map(() => ({ success: false, data: new Error(`HTTP ${response.status}: ${response.statusText}`) }));
            }

            const jsonParams = await response.json();

            // API might return a single error object instead of array if the whole batch fails
            if (!Array.isArray(jsonParams)) {
                if ((jsonParams as any).error) {
                    return calls.map(() => ({ success: false, data: response })); // Propagate API error
                }
                // Unexpected format
                return calls.map(() => ({ success: false, data: new Error("Invalid batch response format") }));
            }

            // 3. Decode Results
            // Ensure response order matches (usually RPC preserves order, but IDs help)
            // We'll map by ID to be safe.
            const responseMap = new Map(jsonParams.map((r: any) => [r.id, r]));

            return calls.map((call, index) => {
                const res = responseMap.get(index);
                const iface = interfaces[index];

                if (!res) {
                    return { success: false, data: new Error("No response for call") };
                }

                if (res.error) {
                    return { success: false, data: new Error(res.error.message || "RPC Error") };
                }

                try {
                    const decoded = iface.decodeFunctionResult(call.method, res.result);
                    // Ethers returns Result object which is array-like. 
                    // If single return value, usually we want that value directly?
                    // But usually access by index or name is safer. We'll return the full result object.
                    return { success: true, data: decoded };
                } catch (err: any) {
                    return { success: false, data: err };
                }
            });

        } catch (error) {
            return calls.map(() => ({ success: false, data: error }));
        }
    }
}

export const batchProvider = new BatchProvider();
