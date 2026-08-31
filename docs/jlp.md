# JLP

The `jlp` command shows Jupiter Liquidity Provider pool data and creates the
transactions needed to mint or burn JLP. Mint and burn transactions are signed
with the active key (or `--key`) and submitted through the configured RPC.

## Pool information

```bash
jup jlp info
```

Displays the pool AUM, JLP price and supply, APR/APY, and the current and
target weights for each custody token.

## Mint JLP

```bash
jup jlp mint --token SOL --amount 1
jup jlp mint --token USDC --amount 100 --key mykey
jup jlp mint --token USDC --raw-amount 100000000 --dry-run
```

`--token` accepts `SOL`, `WBTC`, `ETH`, or `USDC`. Provide exactly one of
`--amount` (human-readable units) or `--raw-amount` (on-chain units).

## Burn JLP

```bash
jup jlp burn --amount 10 --receive USDC
jup jlp burn --amount 10 --receive SOL --key mykey
jup jlp burn --raw-amount 10000000 --receive USDC --dry-run
```

`--receive` accepts `SOL`, `WBTC`, `ETH`, or `USDC`. JLP has six decimals, and
the amount must be supplied through exactly one of `--amount` or
`--raw-amount`.

## Dry runs

Use `--dry-run` to sign and simulate the transaction without broadcasting it.
The output includes the serialized signed transaction and simulation result.
