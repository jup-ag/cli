# DCA Orders

Requires a Jupiter API key. Creating and cancelling orders also requires an
active key. See [setup](setup.md).

The `dca` command manages time-based recurring orders. It does not expose
deprecated price-based recurring orders.

## Create an order

```bash
jup dca create --from USDC --to SOL --amount 100 --interval 86400 --orders 10
jup dca create --from USDC --to SOL --raw-amount 100000000 --interval 86400 --orders 10 --key mykey
jup dca create --from USDC --to SOL --amount 100 --interval 86400 --orders 10 --dry-run
```

- `--from` and `--to` accept a token symbol or mint address.
- Provide exactly one of `--amount` (human-readable units) or `--raw-amount`
  (on-chain units). The amount is the total amount deposited for the order.
- `--interval` is the number of seconds between purchases, such as `86400` for
  one day. `--orders` is the total number of purchases.
- `--min-price` and `--max-price` optionally set USD price bounds.
- `--start-at` optionally sets a UNIX timestamp; otherwise the order begins
  immediately.
- `--key` overrides the active key.
- `--dry-run` signs and simulates the transaction with the configured RPC
  without submitting it.

## Cancel an order

```bash
jup dca cancel --order <orderKey>
jup dca cancel --order <orderKey> --key mykey
jup dca cancel --order <orderKey> --dry-run
```

Use the recurring order account returned by `jup dca list` as `--order`.

## List orders

```bash
jup dca list
jup dca list --key mykey
jup dca list --address <wallet-address>
jup dca list --status history --token USDC
jup dca list --page 2
```

With no wallet option, the command uses the active key's wallet. `--key` and
`--address` are mutually exclusive. `--status` is `active` by default and can
be set to `history`; `--token` filters by input token.
