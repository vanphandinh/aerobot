# RPC Manager - Automatic RPC Management Feature

## Introduction

RPC Manager is a service that automatically fetches and updates Base RPC addresses from Aerodrome Finance on application startup and when errors occur.

## Features

### 1. Automatically fetch RPC on startup
- When the application starts, RPC Manager will:
  - Connect to Aerodrome page (`https://aero.drome.eth.link`)
  - Load HTML and JavaScript files
  - Search for all Base RPC addresses (`https://lb.drpc.live/base/xxx`)
  - Use the first RPC from the found list
  - If not found, use fallback RPC from `BASE_RPC_URL` variable

### 2. Automatically update when RPC fails
- When the service encounters an RPC-related error (network error, timeout, etc.):
  - Automatically switch to the next RPC in the list (if available)
  - If only 1 RPC exists, try to refresh the entire list from Aerodrome
  - Track failure count for each RPC
  - Retry the current request with the new RPC

## Usage

### Default configuration
```typescript
const rpcManager = getRpcManager();
await rpcManager.initialize(fallbackRpc);
```

### Custom configuration
```typescript
const rpcManager = getRpcManager({
  maxRetries: 3,              // Maximum retry attempts
  retryDelayMs: 5000,         // Delay between retries
  timeout: 10000              // HTTP request timeout
});

await rpcManager.initialize('https://mainnet.base.org');
```

### Listen to events
```typescript
rpcManager.on('initialized', (data) => {
  console.log(`RPC initialized: ${data.rpc}, ${data.count} addresses`);
});

rpcManager.on('rpc-switched', (data) => {
  console.log(`RPC switched to: ${data.newRpc}`);
});

rpcManager.on('rpc-refreshed', (data) => {
  console.log(`RPC refreshed: ${data.count} addresses found`);
});
```

### Get current RPC
```typescript
const currentRpc = rpcManager.getCurrentRpc();
console.log(`Using RPC: ${currentRpc}`);
```

### Handle RPC error
```typescript
// Automatically called in sugar.ts when error occurs
const newRpc = await rpcManager.handleRpcError(failedRpc);
```

### Get all RPC addresses
```typescript
const allRpcs = rpcManager.getAllRpcAddresses();
console.log(`Available RPC addresses: ${allRpcs.join(', ')}`);
```

### Stop RPC Manager
```typescript
// RPC Manager has no auto-refresh so no need to stop
// It only runs when called or when errors occur
```

## Example Logs

### Startup
```
🔌 Initializing RPC Manager...
📡 Fetching RPC from https://aero.drome.eth.link...
✓ HTML loaded successfully
✓ Found 25 JavaScript files

📂 Checking files...
  🔎 app.xyz123.js... ✅ Found 3
  🔎 chunk.456.js... ⏭️  No RPC
  ...

✅ Found 5 RPC address(es):
   1. https://lb.drpc.live/base/abc123xyz
   2. https://lb.drpc.live/base/def456abc
   3. https://lb.drpc.live/base/ghi789def
   4. https://lb.drpc.live/base/jkl012ghi
   5. https://lb.drpc.live/base/mno345jkl

✅ RPC Manager initialized with 5 address(es)
📡 Using RPC: https://lb.drpc.live/base/abc123xyz
```

### When RPC error occurs
```
❌ Error executing batch: NetworkError: ECONNREFUSED
🔄 RPC error detected, attempting to switch RPC...
🔄 Switched to RPC: https://lb.drpc.live/base/def456abc
🔄 Retrying with new RPC...
✅ Batch executed successfully with new RPC
```

### Auto-refresh (removed)
```
🔄 RPC Manager no longer has periodic auto-refresh.
Only refreshes when RPC error occurs.
```

## Environment Variables

No new required environment variables, but you can optionally use:
- `BASE_RPC_URL`: Fallback RPC if unable to fetch from Aerodrome (default: `https://mainnet.base.org`)

## Notes

1. **Timeout**: Each request has a maximum of 10 seconds. If exceeded, it's considered an error.
2. **File limit**: Check maximum 20 JavaScript files to avoid taking too long.
3. **Duplicates**: Automatically removes duplicate RPCs.
4. **Error Detection**: Detects errors:
   - Network error
   - Timeout
   - Connection refused
   - DNS not found

## Comparison with Python Script

| Feature | Python | TypeScript |
|---------|--------|-----------|
| Fetch RPC from Aerodrome | ✅ Once | ✅ On startup |
| Handle RPC errors | ❌ No | ✅ Auto-switch + Retry |
| Periodic auto-refresh | ❌ No | ❌ No (removed) |
| Event listeners | ❌ No | ✅ Yes |
| RPC list | ✅ Save file | ✅ In memory + Access methods |
| Graceful shutdown | ❌ No | ✅ Yes |
