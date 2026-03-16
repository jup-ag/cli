# Spot Trading

Requires: an active key for swap and transfer commands. See [setup](setup.md).

## Token resolution

Anywhere a token is specified (`--from`, `--to`, `--token`, `--search`), you can use either:

- **Symbol** (e.g. `SOL`, `USDC`, `JUP`) — the CLI auto-resolves to the best-matching token
- **Mint address** (e.g. `So11111111111111111111111111111111111111112`) — exact match

When using a symbol, the CLI picks the top result from Jupiter's token search. Use a mint address when you need to target a specific token (e.g. to disambiguate tokens with the same symbol).

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
jup spot swap --from SOL --to USDC --amount 1 --slippage 100
```

- `--slippage <bps>` max slippage in basis points (default: 30 = 0.3%)
- `--key` overrides the active key for this transaction

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

### Transfer tokens

```bash
jup spot transfer --token SOL --to <recipient-address> --amount 1
jup spot transfer --token USDC --to <recipient-address> --amount 50
jup spot transfer --token <mint> --to <recipient-address> --raw-amount 1000000000
jup spot transfer --token SOL --to <recipient-address> --amount 1 --key mykey
```

- Works with both SOL and any SPL token
- `--token` accepts a symbol or mint address

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

### Check price then swap

```bash
jup spot quote --from SOL --to USDC --amount 1
# Review the quoted output and price impact
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
