# Plan: `jup perps` commands

Base URL: `https://perps-api.jup.ag/v1`

## Commands

### 1. `perps positions`

View open positions and pending limit orders.

```bash
jup perps positions
jup perps positions --key <key>
jup perps positions --address <wallet>   # look up any wallet
```

**API:** `GET /positions` + `GET /orders/limit` (in parallel) → displays open positions (asset, side, leverage, size, entry price, mark price, PnL, liquidation price, active TP/SL) and pending limit orders (asset, side, leverage, size, trigger price).

### 2. `perps markets`

List all perpetual markets with current prices and 24h stats.

```bash
jup perps markets
```

**API:** `GET /market-stats` for SOL, BTC, ETH (in parallel) → displays asset, price, 24h change, 24h high/low, 24h volume.

### 3. `perps open`

Open a new position via market order or limit order.

```bash
# Market order (by collateral amount)
jup perps open --asset SOL --side long --amount 1 --leverage 5
jup perps open --asset BTC --side short --amount 100 --input USDC --leverage 10 --tp 95000 --sl 105000

# Market order (by position size in USD)
jup perps open --asset SOL --side long --size 1000 --leverage 5

# Limit order
jup perps open --asset SOL --side long --amount 1 --leverage 5 --limit 120
```

**Options:**

- `--asset <SOL|BTC|ETH>` (required) — market to trade
- `--side <long|short (aliases: buy|sell)>` (required) — direction
- `--amount <number>` — input token amount (human-readable)
- `--size <usd>` — position size in USD
- `--input <SOL|BTC|ETH|USDC>` — input token, defaults to SOL
- `--leverage <number>` (required) — leverage multiplier
- `--limit <number>` — trigger price for limit order (must be omitted for market order)
- `--tp <price>` — set take-profit trigger price (market orders only)
- `--sl <price>` — set stop-loss trigger price (market orders only)
- `--slippage <bps>` — max slippage in basis points (default: 200)

**Validation:**

- Exactly one of `--amount` or `--size` is required.
- Error if `--limit` is combined with `--tp` or `--sl` (limit orders don't support atomic TP/SL; use `perps set` after fill).

**API:**

- New market order: `POST /positions/increase` with optional `tpsl` array. `--amount` uses `inputTokenAmount` + `leverage`; `--size` uses `sizeUsdDelta`.
- New limit order: `POST /orders/limit`. Same `--amount`/`--size` mapping.

### 4. `perps set`

Update TP/SL on a position or update a limit order's trigger price.

```bash
# Set/update TP/SL on an existing position
jup perps set --position <pubkey> --tp 200 --sl 100

# Update a limit order's trigger price
jup perps set --order <order-pubkey> --limit 130
```

**Options:**

- `--position <pubkey>` — position to set/update TP/SL on (requires `--tp` and/or `--sl`)
- `--order <order-pubkey>` — limit order to update (requires `--limit`)
- `--tp <price>` — set/update take-profit trigger price
- `--sl <price>` — set/update stop-loss trigger price
- `--limit <number>` — new trigger price for limit order

**Validation:**

- Exactly one of `--position` or `--order` is required.
- `--position` requires at least one of `--tp` or `--sl`.
- `--order` requires `--limit`.

**API:**

- Set/update TP/SL: Compare against existing `tpslRequests` from `GET /positions`. If exists, `PATCH /tpsl`; if not, `POST /tpsl`.
- Update limit order: `PATCH /orders/limit`.

### 5. `perps close`

Close a position, cancel a limit order, or cancel TP/SL.

```bash
# Close a position
jup perps close --position <pubkey> --receive USDC
jup perps close --position <pubkey> --size 500 --receive USDC
jup perps close --position all

# Cancel a limit order
jup perps close --order <order-pubkey>

# Cancel TP/SL on a position
jup perps close --tpsl <tpsl-pubkey>
```

**Options:**

- `--position <pubkey|all>` — position to close, or `all` to close all positions
- `--order <order-pubkey>` — cancel a limit order
- `--tpsl <tpsl-pubkey>` — cancel a TP/SL order
- `--size <usd>` — USD amount to reduce (omit to close entire position)
- `--receive <SOL|BTC|ETH|USDC>` — token to receive, defaults to SOL
- `--slippage <bps>` — max slippage in basis points (default: 200)

**Validation:** Exactly one of `--position`, `--order`, or `--tpsl` is required. `--size` and `--receive` only valid with `--position`.

**API:** `POST /positions/decrease` with `entirePosition: true`, `POST /positions/close-all` (when `all`), `DELETE /orders/limit`, or `DELETE /tpsl`.

## Not included (future)

Trade history, collateral management, JLP minting/burning, lending, leaderboard.
