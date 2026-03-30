# Keys

A key is required for signing transactions (swaps, transfers). Keys can be local keypairs stored at `~/.config/jup/keys/` or remote signers backed by [solana-keychain](https://github.com/solana-foundation/solana-keychain) (AWS KMS, CDP, Crossmint, Dfns, Fireblocks, GCP KMS, Para, Privy, Turnkey, Vault).

## Commands

### Add a new key

Generate a new local keypair:

```bash
jup keys add <name>
```

Import from a JSON file generated via `solana-keygen`:

```bash
jup keys add <name> --file /path/to/solana-keygen.json
```

Import from private key or seed phrase:

```bash
jup keys add <name> --seed-phrase "word1 word2 ..."
jup keys add <name> --seed-phrase "word1 word2 ..." --derivation-path "m/44'/501'/0'/0'" # optional, defaults to "m/44'/501'/0'/0'"
jup keys add <name> --private-key <key> # accepts hex, base58, base64, or a JSON byte array
```

### Add a keychain-backed key

Connect a remote signer using `--backend` and `--param`:

```bash
jup keys add <name> --backend <type> --param key1=value1 --param key2=value2
```

Secrets are read from environment variables (never stored in config files). Non-sensitive parameters are stored in `~/.config/jup/keys/<name>.keychain.json`.

#### Examples

```bash
# Privy (requires PRIVY_APP_SECRET env var)
jup keys add my-privy --backend privy --param appId=app_xxx --param walletId=wallet_xxx

# HashiCorp Vault (requires VAULT_TOKEN env var)
jup keys add my-vault --backend vault --param vaultAddr=https://vault.example.com --param keyName=solana-key --param publicKey=<base58-pubkey>

# AWS KMS (uses default AWS credential chain)
jup keys add my-kms --backend aws-kms --param keyId=arn:aws:kms:... --param publicKey=<base58-pubkey>

# Turnkey (requires TURNKEY_API_PRIVATE_KEY env var)
jup keys add my-turnkey --backend turnkey --param apiPublicKey=<hex> --param organizationId=<id> --param privateKeyId=<id> --param publicKey=<base58-pubkey>

# Coinbase CDP (requires CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET env vars)
jup keys add my-cdp --backend cdp --param address=<solana-address>

# Dfns (requires DFNS_AUTH_TOKEN and DFNS_PRIVATE_KEY_PEM env vars)
jup keys add my-dfns --backend dfns --param credId=<cred-id> --param walletId=<wallet-id>

# Fireblocks (requires FIREBLOCKS_API_KEY and FIREBLOCKS_PRIVATE_KEY_PEM env vars)
jup keys add my-fireblocks --backend fireblocks --param vaultAccountId=<id>

# GCP KMS (uses default GCP credentials)
jup keys add my-gcp --backend gcp-kms --param keyName=projects/.../cryptoKeyVersions/1 --param publicKey=<base58-pubkey>

# Para (requires PARA_API_KEY env var)
jup keys add my-para --backend para --param walletId=<uuid>

# Crossmint (requires CROSSMINT_API_KEY env var)
jup keys add my-crossmint --backend crossmint --param walletLocator=<locator>
```

### List keys

```bash
jup keys list
```

```js
// Example JSON response:
[
  {
    "name": "default",
    "address": "ABC1...xyz",
    "type": "keypair", // "keypair" for local keys, or the backend name (e.g. "privy", "vault")
    "active": true
  },
  {
    "name": "my-vault",
    "address": "DEF2...uvw",
    "type": "vault",
    "active": false
  }
]
```

### Set the active key

```bash
jup keys use <name>
```

### Edit a key

```bash
jup keys edit <name> --name <new-name>
jup keys edit <name> --seed-phrase "word1 word2 ..."
jup keys edit <name> --seed-phrase "word1 word2 ..." --derivation-path "m/44'/501'/0'/0'" # optional, defaults to "m/44'/501'/0'/0'"
jup keys edit <name> --private-key <key>
```

Rename a key and/or replace its credentials. Options can be combined. `--seed-phrase` and `--private-key` are mutually exclusive and only apply to local keypairs. Keychain-backed keys only support `--name` (rename) — to change backend parameters, delete and re-add the key.

### Delete a key

```bash
jup keys delete <name>
```
