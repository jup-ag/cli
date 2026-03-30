# Token Verification

Submit token verification requests on Jupiter. Costs 1 JUP per verification.

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

### Submit verification

```bash
jup vrfd submit --token <mint> --project-twitter @projecthandle --description "DeFi protocol on Solana"
jup vrfd submit --token <mint> --project-twitter @projecthandle --description "DEX aggregator" --key mykey
jup vrfd submit --token <mint> --project-twitter @projecthandle --description "Lending protocol" --sender-twitter @myhandle
jup vrfd submit --token <mint> --project-twitter @projecthandle --description "NFT marketplace" \
  --meta-name "Token Name" --meta-symbol "TKN" --meta-website "https://example.com"
jup vrfd submit --token <mint> --project-twitter @projecthandle --description "Payment token" --dry-run
```

- `--token` (required): token mint address to verify
- `--project-twitter` (required): project's Twitter/X handle or URL
- `--description` (required): reason for verification request
- `--sender-twitter`: submitter's Twitter/X handle (optional)
- `--meta-*`: inline token metadata fields (optional, see [metadata options](#metadata-options) below)
- `--key`: key to use for signing (overrides active key)
- `--dry-run` previews the payment transaction without signing. JSON response includes the unsigned base64 `transaction`.

```js
// Example JSON response:
{
  "sender": "ABC1...xyz",
  "tokenId": "So11111111111111111111111111111111111111112",
  "status": "Success",
  "signature": "2Goj...diEc",
  "paymentAmount": "1",
  "paymentMint": "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  "feeUsd": 0.85,
  "verificationCreated": true,
  "metadataCreated": false
}
```

### Metadata options

Pass token metadata inline with `--meta-` prefixed options. All are optional.

**String fields:**

- `--meta-name <name>`: Token name
- `--meta-symbol <symbol>`: Token symbol/ticker
- `--meta-icon <url>`: Token icon URL
- `--meta-description <text>`: Token description
- `--meta-website <url>`: Token website URL
- `--meta-twitter <url>`: Token Twitter/X URL (distinct from `--project-twitter`, which is the project handle for the verification request)
- `--meta-twitter-community <url>`: Twitter community URL
- `--meta-telegram <url>`: Telegram group URL
- `--meta-discord <url>`: Discord server URL
- `--meta-instagram <url>`: Instagram URL
- `--meta-tiktok <url>`: TikTok URL
- `--meta-circulating-supply <amount>`: Circulating supply value
- `--meta-coingecko-coin-id <id>`: CoinGecko coin identifier
- `--meta-circulating-supply-url <url>`: Circulating supply API URL
- `--meta-other-url <url>`: Additional URL

**Boolean flags** (no value needed):

- `--meta-use-circulating-supply`: Enable circulating supply
- `--meta-use-coingecko-coin-id`: Enable CoinGecko coin ID
- `--meta-use-circulating-supply-url`: Enable circulating supply URL

## Workflows

### Check eligibility then submit

```bash
jup vrfd check --token <mint>
# Confirm canVerify is true
jup vrfd submit --token <mint> --project-twitter @project --description "My token"
```

### Submit with metadata update

```bash
jup vrfd submit --token <mint> --project-twitter @project --description "My token" \
  --meta-name "Token Name" --meta-symbol "TKN" \
  --meta-website "https://example.com" --meta-twitter "https://x.com/token"
```

### Preview before submitting

```bash
jup vrfd submit --token <mint> --project-twitter @project --description "My token" --dry-run
# Review the details, then run without --dry-run
jup vrfd submit --token <mint> --project-twitter @project --description "My token"
```
