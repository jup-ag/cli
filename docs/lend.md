# Lending

Requires: an active key for `earn deposit`, `earn withdraw`, and `borrow operate`. See [setup](setup.md).

## Earn commands

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
  "address": "5vft...8Y2N", // active key wallet unless --address or --key is set
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
  "address": "5vft...8Y2N",
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
  "address": "5vft...8Y2N",
  "token": { "id": "EPjF...USDC", "symbol": "USDC", "decimals": 6 },
  "withdrawnAmount": "50", // human-readable amount just withdrawn
  "withdrawnUsd": 50.00, // USD value of withdrawal
  "positionAmount": 975.30, // remaining position after withdrawal (0 if fully withdrawn)
  "positionUsd": 975.30, // remaining position USD value
  "apyPct": 5.97, // current APY; 5.97 means 5.97%
  "signature": "5YhT...9AKU" // tx signature
}
```

## Borrow commands

Borrow uses a single `operate` transaction. Positive `--collateral` deposits, negative withdraws. Positive `--debt` borrows, negative repays. Use `all` to withdraw all collateral or repay all debt (including interest dust). `--position 0` (the default) opens a new position.

Vault IDs and position NFT IDs are scoped to a market. Pass the same `--market` to `vaults`, `positions`, and `operate`. Omitting it uses `main`.

### View vaults

```bash
jup lend borrow vaults
jup lend borrow vaults --market ethena
```

- Shows borrow vaults with LTV, borrow APY, and available borrow liquidity
- `--market` selects `main` (default) or `ethena`

```js
// Example JSON response:
{
  "market": "main",
  "vaults": [
    {
      "vaultId": 1, // pass to operate as --vault
      "address": "nMzV...nb1",
      "supplyToken": { "id": "So11...1112", "symbol": "SOL", "decimals": 9 },
      "borrowToken": { "id": "EPjF...USDC", "symbol": "USDC", "decimals": 6 },
      "ltvPct": 80, // max LTV; 80 means 80%
      "liquidationThresholdPct": 85,
      "supplyApyPct": 1.25, // 1.25 means 1.25%
      "borrowApyPct": 4.71,
      "totalSupplyUsd": 133600000,
      "totalBorrowUsd": 61780,
      "borrowableUsd": 50000000,
      "withdrawableUsd": 80000000,
      "minimumBorrowingAmount": 1,
      "totalPositions": 9071
    }
  ]
}
```

### View borrow positions

```bash
jup lend borrow positions
jup lend borrow positions --key mykey
jup lend borrow positions --address <wallet-address>
jup lend borrow positions --vault 1
jup lend borrow positions --market ethena
```

- With no options, uses the active key's wallet
- `--address` looks up any wallet without needing a key
- `--vault` filters by vault ID from `lend borrow vaults`
- `--market` selects `main` (default) or `ethena`

```js
// Example JSON response:
{
  "address": "5vft...8Y2N", // active key wallet unless --address or --key is set
  "market": "main",
  "positions": [
    {
      "positionId": 9062, // pass to operate as --position
      "positionPubkey": "7xKp...2mNq",
      "vaultId": 1,
      "supplyToken": { "id": "So11...1112", "symbol": "SOL", "decimals": 9 },
      "borrowToken": { "id": "EPjF...USDC", "symbol": "USDC", "decimals": 6 },
      "collateralAmount": 0.03,
      "collateralUsd": 2.05,
      "debtAmount": 1.1,
      "debtUsd": 1.1,
      "ltvPct": 53.66,
      "isLiquidated": false
    }
  ]
}
```

### Operate (deposit, borrow, repay, withdraw)

```bash
jup lend borrow operate --vault 1 --collateral 0.03
jup lend borrow operate --vault 1 --position 9062 --debt 1.1
jup lend borrow operate --vault 1 --position 9062 --collateral 0.03 --debt 1.1
jup lend borrow operate --vault 1 --position 9062 --debt=-1.1
jup lend borrow operate --vault 1 --position 9062 --debt all
jup lend borrow operate --vault 1 --position 9062 --collateral all
jup lend borrow operate --vault 1 --position 9062 --raw-debt 1100000
jup lend borrow operate --vault 1 --collateral 0.03 --dry-run
jup lend borrow operate --vault 1 --market ethena --collateral 0.03
```

- `--vault` (required) — vault ID from `lend borrow vaults`
- `--position` — position NFT ID. Defaults to `0`, which creates a new position
- `--collateral` — human-readable collateral delta of the supply token. Positive deposits, negative withdraws (`--collateral=-0.01`), `all` withdraws everything
- `--debt` — human-readable debt delta of the borrow token. Positive borrows, negative repays (`--debt=-1.1`), `all` repays everything including interest dust
- `--raw-collateral` / `--raw-debt` — on-chain units (signed integer strings)
- `--market` selects `main` (default) or `ethena`. Vault and position IDs are market-scoped
- Exactly one of `--collateral` or `--raw-collateral` may be set; same for `--debt` / `--raw-debt`
- At least one amount option is required
- `--key` overrides the active key for this transaction
- `--dry-run` signs and simulates without submitting. JSON includes `serializedTransaction`

Depositing WSOL collateral requires a funded WSOL token account. The API does not wrap native SOL. Borrowing or withdrawing WSOL credits a WSOL token account, not native SOL.

Repaying the exact displayed debt can leave interest dust. Use `--debt all` before withdrawing all collateral.

```js
// Example JSON response:
{
  "address": "5vft...8Y2N",
  "market": "main",
  "vaultId": 1,
  "positionId": 9062, // newly assigned when --position was 0
  "supplyToken": { "id": "So11...1112", "symbol": "SOL", "decimals": 9 },
  "borrowToken": { "id": "EPjF...USDC", "symbol": "USDC", "decimals": 6 },
  "collateralDelta": "0.03", // human-readable delta just applied, or "all"
  "debtDelta": "1.1",
  "collateralAmount": 0.03, // total collateral after the operation
  "collateralUsd": 2.05,
  "debtAmount": 1.1, // total debt after the operation
  "debtUsd": 1.1,
  "ltvPct": 53.66,
  "signature": "3dV9...8zG1"
}
```

## Earn workflows

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

### Withdraw entire earn position

```bash
jup lend earn withdraw --token USDC
```

## Borrow workflows

### Deposit collateral then borrow

```bash
jup lend borrow vaults
# Pick a vault ID
jup lend borrow operate --vault 1 --collateral 0.03
jup lend borrow positions
jup lend borrow operate --vault 1 --position 9062 --debt 1.1
```

### Repay and withdraw

```bash
jup lend borrow positions
jup lend borrow operate --vault 1 --position 9062 --debt all
jup lend borrow operate --vault 1 --position 9062 --collateral all
```
