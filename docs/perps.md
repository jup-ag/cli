# Perpetual Futures Trading

Requires: an active key for all commands except `positions` (with `--address`) and `markets`. See [setup](setup.md).

## Markets

Three perpetual markets are available: **SOL**, **BTC**, and **ETH**. Collateral can be deposited in SOL, BTC, ETH, or USDC. Minimum collateral is $10 for new positions.

## Commands

### View positions

```bash
jup perps positions
jup perps positions --key mykey
jup perps positions --address <wallet-address>
```

- Shows open positions with TP/SL details, and pending limit orders
- With no options, uses the active key's wallet

```js
// Example JSON response:
{
  "positions": [
    {
      "positionPubkey": "3qMZ...83tz", // use this to close or set TP/SL
      "asset": "BTC",
      "side": "long",
      "leverage": 1.09,
      "sizeUsd": 10.98, // position size in USD
      "entryPriceUsd": 70522.85,
      "markPriceUsd": 70424.52,
      "pnlPct": -0.29, // percentage; -0.29 means -0.29%
      "liquidationPriceUsd": 6601.55,
      "tpsl": [
        {
          "pubkey": "7xKp...2mNq", // use this to cancel TP/SL
          "type": "tp",
          "triggerPriceUsd": 75000
        }
      ]
    }
  ],
  "limitOrders": [
    {
      "orderPubkey": "9fGh...4kLm", // use this to update or cancel
      "asset": "SOL",
      "side": "long",
      "sizeUsd": 50,
      "triggerPriceUsd": 80
    }
  ]
}
```

### List markets

```bash
jup perps markets
```

```js
// Example JSON response:
[
  {
    "asset": "SOL",
    "priceUsd": 86.74,
    "changePct24h": 2.35, // percentage; 2.35 means +2.35%
    "highUsd24h": 88.10,
    "lowUsd24h": 84.50,
    "volumeUsd24h": 1250000
  }
]
```

### Open a position

Two sizing modes — provide either `--leverage` or `--size`, not both:

- `--leverage`: position size = amount × leverage
- `--size`: explicit position size in USD, leverage is derived

```bash
# Market order with leverage
jup perps open --asset SOL --side long --amount 10 --input USDC --leverage 2

# Market order with explicit size
jup perps open --asset BTC --side short --amount 10 --input USDC --size 50

# Use SOL as collateral (default --input)
jup perps open --asset SOL --side long --amount 0.1 --leverage 5

# With take-profit and stop-loss
jup perps open --asset ETH --side long --amount 10 --input USDC --leverage 3 --tp 4000 --sl 3000

# Limit order (triggers when price reaches --limit)
jup perps open --asset BTC --side long --amount 10 --input USDC --leverage 2 --limit 65000
```

- `--side` accepts `long`, `short`, `buy` (= long), or `sell` (= short)
- `--input` defaults to SOL; accepts SOL, BTC, ETH, or USDC
- `--slippage` defaults to 200 (2%); set in basis points
- `--tp` and `--sl` cannot be combined with `--limit`

```js
// Example JSON response (market order):
{
  "type": "market-order",
  "positionPubkey": "A7SQ...q96c",
  "asset": "SOL",
  "side": "long",
  "entryPriceUsd": 86.74,
  "sizeUsd": 10.97,
  "leverage": 1.09,
  "liquidationPriceUsd": 8.12,
  "openFeeUsd": 0.0066,
  "signature": "2Goj...diEc"
}

// Example JSON response (limit order):
{
  "type": "limit-order",
  "positionPubkey": "B8TR...p23d",
  "asset": "BTC",
  "side": "long",
  "triggerPriceUsd": 65000,
  "sizeUsd": 20,
  "leverage": 2,
  "signature": "4xK2...9zH1"
}
```

### Update TP/SL or limit order

```bash
# Set or update take-profit on a position
jup perps set --position <pubkey> --tp 100

# Set or update stop-loss on a position
jup perps set --position <pubkey> --sl 70

# Set both TP and SL
jup perps set --position <pubkey> --tp 100 --sl 70

# Update a limit order's trigger price
jup perps set --order <pubkey> --limit 64000
```

- Get the `positionPubkey` or `orderPubkey` from `jup perps positions`

```js
// Example JSON response (update limit order):
{
  "action": "update-limit-order",
  "triggerPriceUsd": 64000,
  "signature": "5tPb...qdCD"
}

// Example JSON response (set TP/SL):
{
  "action": "set-tpsl",
  "updates": [
    {
      "type": "tp",
      "action": "created", // or "updated"
      "triggerPriceUsd": 100,
      "signature": "3dV9...8zG1"
    },
    {
      "type": "sl",
      "action": "created",
      "triggerPriceUsd": 70,
      "signature": "7kM2...4pQ3"
    }
  ]
}
```

### Close a position or cancel an order

```bash
# Close entire position (receive collateral token by default)
jup perps close --position <pubkey>

# Close entire position, receive USDC
jup perps close --position <pubkey> --receive USDC

# Partial close (reduce by $5)
jup perps close --position <pubkey> --size 5

# Close all positions
jup perps close --position all

# Cancel a limit order
jup perps close --order <pubkey>

# Cancel a TP/SL order
jup perps close --tpsl <pubkey>
```

- `--receive` defaults to the position's collateral token; must be USDC or the market token (e.g. BTC for a BTC position)
- `--size` for partial close; omit to close entirely

```js
// Example JSON response (close/decrease position):
{
  "action": "close-position", // or "decrease-position" for partial
  "positionPubkey": "3qMZ...83tz",
  "sizeReducedUsd": 10.98,
  "pnlUsd": 0.15,
  "pnlPct": 1.37, // percentage; 1.37 means +1.37%
  "received": "0.00015 BTC",
  "receivedUsd": 10.50,
  "feesUsd": 0.007,
  "signature": "5YhT...9AKU"
}

// Example JSON response (close all):
{
  "action": "close-all",
  "signatures": ["5YhT...9AKU", "3Cn8...diEc"]
}

// Example JSON response (cancel order):
{
  "action": "cancel-limit-order", // or "cancel-tpsl"
  "signature": "4wYb...drLf"
}
```

## Workflows

### Open a position with TP/SL

```bash
jup perps open --asset SOL --side long --amount 10 --input USDC --leverage 3 --tp 100 --sl 70
```

### Check positions then close

```bash
jup perps positions
# Copy the positionPubkey
jup perps close --position <pubkey>
```

### Add TP/SL to an existing position

```bash
jup perps positions
# Copy the positionPubkey
jup perps set --position <pubkey> --tp 100 --sl 70
```

### Place a limit order then update it

```bash
jup perps open --asset BTC --side long --amount 10 --input USDC --leverage 2 --limit 65000
jup perps positions
# Copy the orderPubkey
jup perps set --order <pubkey> --limit 64000
```

### Add collateral to reduce leverage

There is no dedicated deposit collateral command. Instead, open on the same asset/side with minimum leverage:

```bash
jup perps open --asset BTC --side long --amount 10 --input USDC --leverage 1.1
```
