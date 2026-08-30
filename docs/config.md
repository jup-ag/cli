# Config

Settings are stored at `~/.config/jup/settings.json`.

## Commands

### View current settings

```bash
jup config list
```

### Set output format

```bash
jup config set --output json
jup config set --output table
```

### Set active key

```bash
jup config set --active-key <name>
```

### Set API key

Use an API key from <https://portal.jup.ag/> for higher rate limits:

```bash
jup config set --api-key <key>

# Delete or unset the API key
jup config set --api-key
```

### Set an RPC URL

Signable commands use this RPC URL to simulate or submit transactions. It
defaults to `https://api.mainnet.solana.com` when no custom endpoint is set.

```bash
jup config set --rpc-url https://your-rpc.example.com

# Return to the mainnet default
jup config set --rpc-url
```
