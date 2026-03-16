# Keys

A key is required for signing transactions (swaps, transfers). Keys are stored locally at `~/.config/jup/keys/`.

## Commands

### Generate a new key

```bash
jup keys add <name>
```

### Import a Solana CLI keypair

```bash
jup keys solana-import
jup keys solana-import --name mykey --path ~/.config/solana/id.json
```

### Recover from seed phrase or private key

```bash
jup keys add <name> --recover --seed-phrase "word1 word2 ..."
jup keys add <name> --recover --private-key <key>
```

`--private-key` accepts hex, base58, base64, or a JSON byte array.

### List keys

```bash
jup keys list
```

```js
// Example JSON response:
[
  {
    "name": "default",
    "address": "ABC1...xyz", // Solana wallet address
    "active": true // if true, key is used by default for signing transactions
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
jup keys edit <name> --private-key <key>
```

Rename a key and/or replace its credentials. Options can be combined. `--seed-phrase` and `--private-key` are mutually exclusive.

### Delete a key

```bash
jup keys delete <name>
```
