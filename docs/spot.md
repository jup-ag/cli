# Spot Trading

Requires: an active key for swap and transfer commands. See [setup](setup.md).

## Token resolution

Anywhere a token is specified (`--from`, `--to`, `--token`, `--search`), you can use either:

- **Symbol** (e.g. `SOL`, `USDC`, `JUP`) — the CLI auto-resolves to the best-matching token
- **Mint address** (e.g. `So11111111111111111111111111111111111111112`) — exact match

Token resolution depends on the context:

- **Wallet-bound options** (`swap --from`, `transfer --token`, `reclaim --token`) resolve against the tokens in your wallet. This ensures the CLI matches the token you actually hold, not a different token with the same symbol. If the token is not found in your wallet, the command errors. If multiple tokens share the same symbol, the CLI asks you to use the mint address instead.
- **All other options** (`swap --to`, `quote --from`, `quote --to`, `tokens --search`, `history --token`) resolve via Jupiter's global token search, picking the top result.

## Commands

### Search tokens

```bash
jup spot tokens --search <query>
jup spot tokens --search <query> --limit 5
jup spot tokens --search <mint-address>
jup spot tokens --search "<mint1>,<mint2>"
```

### Get a swap quote

```bash
jup spot quote --from SOL --to USDC --amount 1
jup spot quote --from <mint> --to <mint> --raw-amount 1000000000
```

- `--amount` uses human-readable units (e.g. `1` SOL = 1 SOL)
- `--raw-amount` uses on-chain units (e.g. `1000000000` lamports = 1 SOL)
- Exactly one of `--amount` or `--raw-amount` is required

```js
// Example JSON response:
{
  "inputToken": { "id": "So11...1112", "symbol": "SOL", "decimals": 9 },
  "outputToken": { "id": "EPjF...USDC", "symbol": "USDC", "decimals": 6 },
  "inAmount": "1", // human-readable decimal amount
  "outAmount": "84.994059", // human-readable decimal amount
  "inUsdValue": 84.98, // USD value
  "outUsdValue": 84.99,
  "priceImpact": 0.005 // max value of 1; 0.005 means 0.5%
}
```

### Execute a swap

```bash
jup spot swap --from SOL --to USDC --amount 1
jup spot swap --from SOL --to USDC --amount 1 --key mykey
jup spot swap --from SOL --to USDC --amount 1 --slippage 50
jup spot swap --from SOL --to USDC --amount 1 --dry-run
```

- `--key` overrides the active key for this transaction
- `--slippage` sets max slippage in basis points (e.g. `50` = 0.5%). Recommended to be emtpy: Jupiter's Real-Time Slippage Estimation (RTSE) automatically picks an optimal value.
- `--dry-run` previews the swap without signing or submitting. The API still simulates the transaction, so errors like insufficient balance are caught. In JSON mode, the response includes the unsigned base64 `transaction` for external signing.

```js
// Example JSON response:
{
  "trader": "ABC1...xyz", // trader address
  "signature": "3dV98zG...", // tx signature viewable on an explorer
  "inputToken": { "id": "So11...1112", "symbol": "SOL", "decimals": 9 },
  "outputToken": { "id": "EPjF...USDC", "symbol": "USDC", "decimals": 6 },
  "inAmount": "1", // human-readable decimal amount
  "outAmount": "84.95", // human-readable decimal amount
  "inUsdValue": 84.98,
  "outUsdValue": 84.95,
  "priceImpact": 0.005, // max value of 1; 0.005 means 0.5%
  "networkFeeLamports": 5000 // divide by 10^9 for SOL fee
}
```

### View portfolio

```bash
jup spot portfolio
jup spot portfolio --key mykey
jup spot portfolio --address <wallet-address>
```

- With no options, uses the active key's wallet
- `--address` looks up any wallet without needing a key

```js
// Example JSON response:
{
  "totalValue": 1250.50, // total USD net worth
  "tokens": [
    {
      "id": "So11...1112", // mint address
      "symbol": "SOL",
      "decimals": 9,
      "amount": 10.5, // human-readable decimal balance
      "rawAmount": "10500000000", // on-chain integer balance
      "value": 892.50, // USD value of holdings
      "price": 85.00, // current token USD price
      "priceChange": 0.032, // 24h price change; 0.032 means 3.2%
      "isVerified": true
    }
  ]
}
```

### Reclaim rent from ATA

```bash
jup spot reclaim
jup spot reclaim --key mykey
jup spot reclaim --token USDC
jup spot reclaim --dry-run
```

- With no options, reclaims rent from all empty Associated Token Accounts (ATA) owned by the active key's wallet
- `--dry-run` previews reclaimable amount without executing. JSON response includes the unsigned base64 `transactions` array.

```js
// Example JSON response:
{
  "totalLamportsReclaimed": 5000, // divide by 10^9 for total SOL reclaimed
  "totalValueReclaimed": 0.005, // USD value of reclaimed SOL
  "networkFeeLamports": 5000, // divide by 10^9 for SOL fee
  "signatures": [ // array of tx signatures for each batch of reclaim tx
    "3dV98zG...",
  ]
}
```

### View trade history

```bash
jup spot history --address <wallet-address>
jup spot history --key mykey
jup spot history --address <wallet-address> --token SOL
jup spot history --address <wallet-address> --after 2025-01-01 --before 2025-02-01
jup spot history --address <wallet-address> --limit 10 --offset 123
```

- With no `--address` or `--key`, uses the active key's wallet
- `--token` filters by token (symbol or mint address)
- `--after` / `--before` accept ISO 8601 dates or UNIX timestamps
- `--limit` defaults to 10, max 15
- `--offset` is used for pagination; use the `next` value from the previous response to fetch the next page of results

```js
// Example JSON response:
{
  "trades": [
    {
      "time": "2025-01-15T10:30:00.000Z", // ISO 8601 timestamp
      "inputToken": { "id": "So11...1112", "symbol": "SOL", "decimals": 9 },
      "outputToken": { "id": "EPjF...USDC", "symbol": "USDC", "decimals": 6 },
      "inAmount": "1", // human-readable decimal amount
      "outAmount": "84.994059", // human-readable decimal amount
      "inUsdValue": 84.98, // USD value
      "outUsdValue": 84.99,
      "signature": "3dV98zG..." // tx signature
    }
  ],
  "next": "123" // pagination offset for next page of results; use with --offset to fetch next page
}
```

### Transfer tokens

```bash
jup spot transfer --token SOL --to <recipient-address> --amount 1
jup spot transfer --token USDC --to <recipient-address> --amount 50
jup spot transfer --token <mint> --to <recipient-address> --raw-amount 1000000000
jup spot transfer --token SOL --to <recipient-address> --amount 1 --key mykey
jup spot transfer --token SOL --to <recipient-address> --amount 1 --dry-run
```

- Works with both SOL and any SPL token
- `--token` accepts a symbol or mint address
- `--dry-run` previews the transfer without signing. JSON response includes the unsigned base64 `transaction`.

```js
// Example JSON response:
{
  "sender": "ABC1...xyz", // sender address
  "recipient": "DEF2...abc",
  "token": { "id": "EPjF...USDC", "symbol": "USDC", "decimals": 6 },
  "amount": "50", // human-readable decimal amount
  "value": 50.00, // USD value of transfer
  "networkFeeLamports": 5000, // divide by 10^9 for SOL fee
  "signature": "4xK29zH..." // tx signature viewable on an explorer
}
```

## Workflows

### Dry-run then swap

```bash
jup spot swap --from SOL --to USDC --amount 1 --dry-run
# Review the output, fees, and simulation result
jup spot swap --from SOL --to USDC --amount 1
```

### Look up a token by mint address

```bash
jup spot tokens --search <mint-address>
```

### Check holdings then transfer

```bash
jup spot portfolio
jup spot transfer --token USDC --to <recipient-address> --amount 50
```
