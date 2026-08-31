# Spot Trading

Requires: an active key for swap and transfer commands. See [setup](setup.md).

## Token resolution

Anywhere a token is specified (`--from`, `--to`, `--token`, `--search`), you can use either:

- **Symbol** (e.g. `SOL`, `USDC`, `JUP`) — the CLI auto-resolves to the best-matching token
- **Mint address** (e.g. `So11111111111111111111111111111111111111112`) — exact match

Token arguments resolve through Jupiter's global token search, which picks the top
result. Use a mint address whenever a symbol might be ambiguous.

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
  "priceImpact": 0.005 // max value of 100; 0.005 means 0.005%
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
- `--slippage` sets max slippage in basis points (e.g. `50` = 0.5%). Omit it to use Jupiter's default.
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
  "priceImpact": 0.005, // max value of 100; 0.005 means 0.005%
  "networkFeeLamports": 5000 // divide by 10^9 for SOL fee
}
```

### View portfolio

```bash
jup portfolio
jup portfolio --key mykey
jup portfolio --address <wallet-address>
```

- With no options, uses the active key's wallet
- `--address` looks up any wallet without needing a signing key; the Portfolio API still requires a Jupiter API key

```js
// Example JSON response:
{
  "totalValue": 1250.50, // total USD net worth
  "positions": [
    {
      "platformId": "wallet",
      "label": "Wallet",
      "value": 892.50
    }
  ]
}
```

### Reclaim rent from token accounts

```bash
jup reclaim
jup reclaim --key mykey
jup reclaim --token USDC
jup reclaim --dry-run
```

- With no options, reclaims rent from every empty, non-frozen token account owned by the active key's wallet
- The command revalidates accounts via the configured RPC, constructs close-account transactions locally, and submits them directly to that RPC
- `--dry-run` signs and simulates every locally built transaction without submitting it. JSON response includes the signed serialized transactions and each simulation result.

```js
// Example JSON response:
{
  "totalLamportsReclaimed": "5000", // rent returned before transaction fees
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
jup transfer --token SOL --to <recipient-address> --amount 1
jup transfer --token USDC --to <recipient-address> --amount 50
jup transfer --token <mint> --to <recipient-address> --raw-amount 1000000000
jup transfer --token SOL --to <recipient-address> --amount 1 --key mykey
jup transfer --token SOL --to <recipient-address> --amount 1 --dry-run
```

- Works with both SOL and any SPL token. The CLI builds the System Program or SPL Token transaction locally and sends it through the configured RPC URL.
- `--token` accepts a symbol or mint address
- `--dry-run` signs and simulates the transfer without submitting it. JSON response includes the signed `serializedTransaction` and simulation result.

```js
// Example JSON response:
{
  "sender": "ABC1...xyz", // sender address
  "recipient": "DEF2...abc",
  "token": { "id": "EPjF...USDC", "symbol": "USDC", "decimals": 6 },
  "amount": "50", // human-readable decimal amount
  "value": 50.00, // USD value of transfer
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
jup portfolio
jup transfer --token USDC --to <recipient-address> --amount 50
```
