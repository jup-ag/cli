# Lending

Requires: an active key for `deposit` and `withdraw` commands. See [setup](setup.md).

## Commands

### View available tokens

```bash
jup lend earn tokens
```

- Shows all tokens available for lending with APY, TVL, and withdrawable liquidity

```js
// Example JSON response:
{
  "tokens": [
    {
      "token": { "id": "EPjF...USDC", "symbol": "USDC", "decimals": 6 }, // underlying token
      "jlToken": { "id": "jl1U...xxx", "symbol": "jlUSDC", "decimals": 6 }, // lending token
      "apyPct": 5.97, // total APY; 5.97 means 5.97%
      "supplyApyPct": 4.50, // supply rate portion
      "rewardsApyPct": 1.47, // rewards rate portion
      "totalTvlUsd": 125000000, // total TVL in USD
      "withdrawableUsd": 80000000, // available withdrawable liquidity in USD
      "priceUsd": 1.00 // underlying token price
    }
  ]
}
```

### View positions

```bash
jup lend earn positions
jup lend earn positions --key mykey
jup lend earn positions --address <wallet-address>
jup lend earn positions --token USDC
```

- With no options, uses the active key's wallet
- `--address` looks up any wallet without needing a key
- `--token` filters by underlying token (symbol or mint address)

```js
// Example JSON response:
{
  "positions": [
    {
      "token": { "id": "EPjF...USDC", "symbol": "USDC", "decimals": 6 }, // underlying token
      "jlToken": { "id": "jl1U...xxx", "symbol": "jlUSDC", "decimals": 6 }, // derivative token
      "positionAmount": 1025.30, // current position value in underlying token units, including earnings
      "positionUsd": 1025.30, // current position value in USD
      "earningsAmount": 24.80, // accrued interest in underlying token units
      "earningsUsd": 24.80, // accrued interest in USD
      "apyPct": 5.97 // current APY; 5.97 means 5.97%
    }
  ]
}
```

### Deposit

```bash
jup lend earn deposit --token USDC --amount 100
jup lend earn deposit --token SOL --amount 1.5 --key mykey
jup lend earn deposit --token USDC --raw-amount 100000000
jup lend earn deposit --token USDC --amount 100 --dry-run
```

- `--token` (required) — underlying token to deposit (symbol or mint address)
- `--amount` uses human-readable units (e.g. `100` USDC = 100 USDC)
- `--raw-amount` uses on-chain units (e.g. `100000000` = 100 USDC)
- Exactly one of `--amount` or `--raw-amount` is required
- `--key` overrides the active key for this transaction
- `--dry-run` previews the deposit without signing. JSON response includes the unsigned base64 `transaction`.

```js
// Example JSON response:
{
  "token": { "id": "EPjF...USDC", "symbol": "USDC", "decimals": 6 },
  "depositedAmount": "100", // human-readable amount just deposited
  "depositedUsd": 100.00, // USD value of deposit
  "positionAmount": 1125.30, // total position after deposit
  "positionUsd": 1125.30, // total position USD value
  "apyPct": 5.97, // current APY; 5.97 means 5.97%
  "signature": "3dV9...8zG1" // tx signature
}
```

### Withdraw

```bash
jup lend earn withdraw --token USDC --amount 50
jup lend earn withdraw --token USDC                   # withdraw entire position
jup lend earn withdraw --token jlUSDC --amount 50     # also accepts jlToken directly
jup lend earn withdraw --token USDC --raw-amount 50000000
jup lend earn withdraw --token USDC --amount 50 --dry-run
```

- `--token` (required) — token to withdraw (accepts underlying symbol/address or jlToken symbol/address)
- `--amount` in human-readable units of the underlying token
- `--raw-amount` in on-chain units of the jlToken
- When neither `--amount` nor `--raw-amount` is provided, withdraws the entire position
- `--key` overrides the active key for this transaction
- `--dry-run` previews the withdrawal without signing. JSON response includes the unsigned base64 `transaction`.

```js
// Example JSON response:
{
  "token": { "id": "EPjF...USDC", "symbol": "USDC", "decimals": 6 },
  "withdrawnAmount": "50", // human-readable amount just withdrawn
  "withdrawnUsd": 50.00, // USD value of withdrawal
  "positionAmount": 975.30, // remaining position after withdrawal (0 if fully withdrawn)
  "positionUsd": 975.30, // remaining position USD value
  "apyPct": 5.97, // current APY; 5.97 means 5.97%
  "signature": "5YhT...9AKU" // tx signature
}
```

## Workflows

### Check available tokens then deposit

```bash
jup lend earn tokens
# Pick a token with good APY
jup lend earn deposit --token USDC --amount 100
```

### Check positions then withdraw

```bash
jup lend earn positions
# Review current value and earnings
jup lend earn withdraw --token USDC --amount 50
```

### Withdraw entire position

```bash
jup lend earn withdraw --token USDC
```
