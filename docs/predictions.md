# Prediction Markets

Requires: an active key for `open` and `close` commands. See [setup](setup.md).

## Commands

### Browse events

```bash
jup predictions events
jup predictions events --filter trending
jup predictions events --category crypto --sort volume
jup predictions events --category sports --sort recent
jup predictions events --search "bitcoin"
jup predictions events --id <eventId>
jup predictions events --limit 5 --offset 10
```

- `--filter`: `new`, `live`, `trending`
- `--sort`: `volume` (default), `recent`
- `--category`: `all` (default), `crypto`, `sports`, `politics`, `esports`, `culture`, `economics`, `tech`
- `--id` cannot be combined with `--search`, `--filter`, `--sort`, `--category`, or `--offset`
- `--search` cannot be combined with `--filter`, `--sort`, `--category`, or `--offset`

```js
// Example JSON response:
{
  "events": [
    {
      "eventId": "abc123",
      "title": "Will BTC hit $200k by end of 2026?",
      "category": "crypto",
      "isLive": true,
      "volumeUsd": 125000.50,
      "volume24hUsd": 123.32,
      "startsAt": "2026-01-01T00:00:00.000Z",
      "endsAt": "2026-12-31T23:59:59.000Z",
      "markets": [
        {
          "marketId": "mkt456",
          "title": "Yes / No",
          "status": "open",
          "yesPriceUsd": 0.65, // 65% implied probability
          "noPriceUsd": 0.35,
          "result": null // "yes" or "no" when resolved
        }
      ]
    }
  ],
  "next": 10 // pagination offset for next page; omitted when no more results
}
```

### View positions

```bash
jup predictions positions
jup predictions positions --key mykey
jup predictions positions --address <wallet-address>
jup predictions positions --position <pubkey>
```

- With no options, uses the active key's wallet
- `--position` looks up a single position by pubkey; cannot be combined with `--key` or `--address`

```js
// Example JSON response:
{
  "count": 2,
  "positions": [
    {
      "positionPubkey": "3qMZ...83tz",
      "event": "Will BTC hit $200k by end of 2026?",
      "market": "Yes / No",
      "side": "yes",
      "contracts": 10,
      "costUsd": 6.50,
      "valueUsd": 7.20,
      "pnlUsd": 0.70,
      "pnlPct": 10.77, // percentage; 10.77 means +10.77%
      "claimable": false // true when market resolved in your favor
    }
  ]
}
```

### Open a position

```bash
jup predictions open --market <marketId> --side yes --amount 10
jup predictions open --market <marketId> --side no --amount 5 --input USDC
jup predictions open --market <marketId> --side y --amount 10 --key mykey
jup predictions open --market <marketId> --side yes --amount 10 --dry-run
```

- `--market`: market ID from `jup predictions events`
- `--side`: `yes`, `no`, `y`, `n`
- `--amount`: input token amount (human-readable)
- `--input`: input token symbol or mint (default: `USDC`)
- `--dry-run` previews the order without signing, showing cost, fees, and payout. JSON response includes the unsigned base64 `transaction`.

```js
// Example JSON response:
{
  "action": "open",
  "marketId": "mkt456",
  "side": "yes",
  "contracts": 10,
  "costUsd": 6.50,
  "feeUsd": 0.07,
  "positionAvgPriceUsd": 0.65,
  "positionPayoutUsd": 10.00,
  "positionPubkey": "3qMZ...83tz",
  "signature": "2Goj...diEc"
}
```

### Close or claim a position

```bash
# Close a single position (sell back)
jup predictions close --position <pubkey>

# Claim a resolved position (market settled in your favor)
jup predictions close --position <pubkey>

# Close all positions
jup predictions close --position all

# Dry-run
jup predictions close --position <pubkey> --dry-run
```

- The CLI auto-detects whether to sell or claim based on the market result
- Claimable positions (market resolved in your favor) are claimed for the full payout
- Open positions on live markets are sold at the current market price
- `--dry-run` previews the close without signing. JSON response includes the unsigned base64 `transaction`.

```js
// Example JSON response (close):
{
  "action": "close",
  "event": "Will BTC hit $200k by end of 2026?",
  "market": "Yes / No",
  "side": "yes",
  "positionPubkey": "3qMZ...83tz",
  "contracts": 10,
  "costUsd": 6.50,
  "feeUsd": 0.07,
  "signature": "5YhT...9AKU"
}

// Example JSON response (claim):
{
  "action": "claim",
  "event": "Will BTC hit $200k by end of 2026?",
  "market": "Yes / No",
  "side": "yes",
  "positionPubkey": "3qMZ...83tz",
  "contracts": 10,
  "payoutUsd": 10.00,
  "signature": "4xK2...9zH1"
}

// Example JSON response (close all):
{
  "action": "close-all",
  "results": [
    {
      "action": "close", // or "claim"
      "positionPubkey": "3qMZ...83tz",
      "signature": "5YhT...9AKU"
    }
  ]
}
```

### View trade history

```bash
jup predictions history
jup predictions history --key mykey
jup predictions history --address <wallet-address>
jup predictions history --limit 5 --offset 10
```

- With no `--address` or `--key`, uses the active key's wallet
- `--limit` defaults to 10
- `--offset` is used for pagination; use the `next` value from the previous response to fetch the next page

```js
// Example JSON response:
{
  "count": 15,
  "history": [
    {
      "time": "2026-03-15T10:30:00.000Z",
      "event": "Will BTC hit $200k by end of 2026?",
      "market": "Yes / No",
      "type": "OrderFilled", // event type
      "side": "yes",
      "action": "buy", // or "sell"
      "contracts": 10,
      "avgPriceUsd": 0.65,
      "pnlUsd": 0.70, // null for buys
      "payoutUsd": 0,
      "positionPubkey": "3qMZ...83tz",
      "signature": "2Goj...diEc"
    }
  ],
  "next": 10 // pagination offset for next page; omitted when no more results
}
```

## Workflows

### Browse events then open a position

```bash
jup predictions events --category crypto
# Find the market ID from the output
jup predictions open --market <marketId> --side yes --amount 10
```

### Check positions then close

```bash
jup predictions positions
# Copy the positionPubkey
jup predictions close --position <pubkey>
```

### Claim resolved positions

```bash
jup predictions positions
# Positions with "claimable: true" can be claimed
jup predictions close --position <pubkey>
# Or claim all at once
jup predictions close --position all
```
