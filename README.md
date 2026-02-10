# Aerodrome Position Monitor

Monitor tool for concentrated liquidity (CL) positions on Aerodrome and send alerts when positions go out of range.

## Quick Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure
# Edit .env file and change:
#   - WALLET_ADDRESS: your wallet address
#   - NTFY_TOPIC: unique topic name

# 3. Setup notifications
# - Install ntfy app on mobile (Android/iOS)
# - Subscribe to your topic

# 4. Test notifications
npm run test-notify

# 5. Run monitor
npm run dev
```

## Configuration

Edit `.env` file:

| Variable | Description |
|----------|-------------|
| `WALLET_ADDRESS` | Wallet address to monitor |
| `BASE_RPC_URL` | RPC endpoint (pre-configured with Alchemy) |
| `NTFY_TOPIC` | Topic name for notifications (create unique name) |
| `POLL_INTERVAL_MS` | Check interval (ms) |

## How It Works

1. **Fetch positions**: Use Sugar contract to get all CL positions for wallet
2. **Check range**: Compare current pool `tick` with position `tick_lower`/`tick_upper`
3. **Send alerts**: If position out of range, send notification via ntfy.sh
4. **Track changes**: Only send alert when status changes (avoid spam)

## Commands

```bash
npm run dev        # Run with ts-node (development)
npm run build      # Build TypeScript
npm run start      # Run production version
npm run test-notify # Test notifications
npm run test-notify # Test notifications
```

## Running with Docker 🐳

The project supports running on Docker with configuration mounted from outside.

1. **Build and Run**:
   ```bash
   docker-compose up -d --build
   ```
   This will build the image and run the container in detached mode.

2. **View Logs**:
   ```bash
   docker-compose logs -f
   ```

3. **Stop container**:
   ```bash
   docker-compose down
   ```

**Note:**
- Your `.env` file will be mounted inside the container.
- If you change configuration in `.env`, just restart the container: `docker-compose restart`.
- If you change code, you need to run the build command again (step 1).
