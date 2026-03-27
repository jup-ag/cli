# Token Verification

Submit express token verification requests on Jupiter. Costs 1 JUP per verification.

Requires: an active key for the `submit` command. See [setup](setup.md).

## Commands

### Check eligibility

```bash
jup vrfd check --token <mint-address>
```

- `--token` (required): token mint address to check

```js
// Example JSON response:
{
  "tokenExists": true,
  "isVerified": false,
  "canVerify": true,
  "canMetadata": true
}
```

### Submit express verification

```bash
jup vrfd submit --token <mint> --twitter @projecthandle --description "DeFi protocol on Solana"
jup vrfd submit --token <mint> --twitter @projecthandle --description "DEX aggregator" --key mykey
jup vrfd submit --token <mint> --twitter @projecthandle --description "Lending protocol" --sender-twitter @myhandle
jup vrfd submit --token <mint> --twitter @projecthandle --description "NFT marketplace" --metadata metadata.json
jup vrfd submit --token <mint> --twitter @projecthandle --description "Payment token" --dry-run
```

- `--token` (required): token mint address to verify
- `--twitter` (required): project's Twitter/X handle or URL
- `--description` (required): reason for verification request
- `--sender-twitter`: submitter's Twitter/X handle (optional)
- `--metadata`: path to a JSON file with token metadata to update alongside verification (optional)
- `--key`: key to use for signing (overrides active key)
- `--dry-run` previews the payment transaction without signing. JSON response includes the unsigned base64 `transaction`.

```js
// Example JSON response:
{
  "sender": "ABC1...xyz",
  "tokenId": "So11111111111111111111111111111111111111112",
  "status": "Success",
  "signature": "2Goj...diEc",
  "verificationCreated": true,
  "metadataCreated": false
}
```

### Metadata JSON file format

When using `--metadata`, provide a JSON file with any of these optional fields:

```json
{
  "tokenId": "<mint-address>",
  "name": "Token Name",
  "symbol": "TKN",
  "icon": "https://example.com/icon.png",
  "tokenDescription": "A brief description of the token",
  "website": "https://example.com",
  "twitter": "https://x.com/project",
  "telegram": "https://t.me/project",
  "discord": "https://discord.gg/project",
  "coingeckoCoinId": "token-name"
}
```

## Workflows

### Check eligibility then submit

```bash
jup vrfd check --token <mint>
# Confirm canVerify is true
jup vrfd submit --token <mint> --twitter @project --description "My token"
```

### Submit with metadata update

```bash
# Create a metadata.json file with token info
jup vrfd submit --token <mint> --twitter @project --description "My token" --metadata metadata.json
```

### Preview before submitting

```bash
jup vrfd submit --token <mint> --twitter @project --description "My token" --dry-run
# Review the details, then run without --dry-run
jup vrfd submit --token <mint> --twitter @project --description "My token"
```
