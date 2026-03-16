# Keys

A key is required for signing transactions (swaps, transfers). Keys are stored locally at `~/.config/jup/keys/`.

## Commands

### Add a new key

Generate a new key:

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

### List keys

```bash
jup keys list
```

```js
// Example JSON response:
[
  {
    "name": "key1",
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
jup keys edit <name> --seed-phrase "word1 word2 ..." --derivation-path "m/44'/501'/0'/0'" # optional, defaults to "m/44'/501'/0'/0'"
jup keys edit <name> --private-key <key>
```

Rename a key and/or replace its credentials. Options can be combined. `--seed-phrase` and `--private-key` are mutually exclusive.

### Delete a key

```bash
jup keys delete <name>
```
