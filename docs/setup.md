# Setup

## Install

### Option 1: npm (recommended if npm is available)

```bash
npm i -g @jup-ag/cli
```

### Option 2: Standalone binary

Download the latest binary from GitHub releases:

```bash
curl -fsSL https://github.com/jup-ag/cli/releases/latest/download/jup-linux-x64 -o jup
chmod +x jup
sudo mv jup /usr/local/bin/
```

Replace `jup-linux-x64` with the appropriate binary for your platform (`jup-darwin-arm64`, `jup-darwin-x64`, etc.).

### Option 3: Build from source

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/jup-ag/cli.git
cd cli
bun install
bun build src/index.ts --compile --outfile jup
sudo mv jup /usr/local/bin/
```

## Configuration

Settings are stored at `~/.config/jup/settings.json`.

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

## Key management

A key is required for signing transactions (swaps, transfers). Keys are stored locally at `~/.config/jup/keys/`.

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
