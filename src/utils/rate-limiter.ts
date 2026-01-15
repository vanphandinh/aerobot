/**
 * Rate limiter with exponential backoff for RPC calls
 */
export class RateLimiter {
    private minDelayMs: number;
    private maxRetries: number;
    private backoffMultiplier: number;
    private lastCallTime: number = 0;

    constructor(
        minDelayMs: number = 100,
        maxRetries: number = 3,
        backoffMultiplier: number = 2
    ) {
        this.minDelayMs = minDelayMs;
        this.maxRetries = maxRetries;
        this.backoffMultiplier = backoffMultiplier;
    }

    private async delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async waitForNextSlot(): Promise<void> {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCallTime;
        if (timeSinceLastCall < this.minDelayMs) {
            await this.delay(this.minDelayMs - timeSinceLastCall);
        }
        this.lastCallTime = Date.now();
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        let lastError: Error | null = null;
        let currentDelay = this.minDelayMs;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                await this.waitForNextSlot();
                return await fn();
            } catch (error: any) {
                lastError = error;

                // Check for rate limit errors
                const isRateLimitError =
                    error.code === 'RATE_LIMIT' ||
                    error.code === 429 ||
                    error.message?.includes('rate limit') ||
                    error.message?.includes('Too Many Requests');

                if (isRateLimitError && attempt < this.maxRetries) {
                    console.log(
                        `⚠️ Rate limit hit, waiting ${currentDelay}ms before retry (attempt ${attempt + 1}/${this.maxRetries})`
                    );
                    await this.delay(currentDelay);
                    currentDelay *= this.backoffMultiplier;
                } else if (!isRateLimitError) {
                    // Non-rate-limit error, throw immediately
                    throw error;
                }
            }
        }

        throw lastError || new Error('Max retries exceeded');
    }
}

// Singleton instance
let _rateLimiter: RateLimiter | null = null;

export function getRateLimiter(minDelayMs?: number): RateLimiter {
    if (!_rateLimiter) {
        _rateLimiter = new RateLimiter(minDelayMs);
    }
    return _rateLimiter;
}
