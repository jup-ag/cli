# Sign

Sign an unsigned base64 Solana transaction produced by a `--dry-run` command.

Requires: an active key, unless `--key` is provided. See [setup](setup.md) and [keys](keys.md).

## Commands

### Sign a transaction

```bash
jup sign --tx <base64-transaction>
jup sign --tx <base64-transaction> --key mykey
```

- `--tx` (required) — unsigned base64 transaction bytes
- `--key` overrides the active key for this signing operation

```js
// Example JSON response:
{
  "signer": "ABC1...xyz", // signer wallet address
  "signedTransaction": "AQAB..." // signed base64 wire transaction
}
```

## Workflow

### Dry-run then sign

```bash
jup spot swap --from SOL --to USDC --amount 1 --dry-run
# Copy the `transaction` field from the response
jup sign --tx <base64-transaction>
```
