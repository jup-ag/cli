# Jupiter CLI

CLI for interacting with Jupiter's products on Solana: Spot, Perps, Lend, Prediction Markets and more.

## Install

Install via npm:

```bash
npm i -g @jup-ag/cli
```

Or use the install script to auto-detect the best method:

```bash
curl -fsSL https://raw.githubusercontent.com/jup-ag/cli/main/scripts/install.sh | bash
```

## Quick Start

```bash
# Generate a new private key called 'key1'
jup keys add key1
# Or import from a JSON file generated via `solana-keygen`
jup keys add key1 --file /path/to/solana-keygen.json
# Or import from a seed phrase
jup keys add key1 --seed-phrase "word1 word2 ..." --derivation-path "m/44'/501'/0'/0'" # optional, defaults to "m/44'/501'/0'/0'"
# Or import from a private key (accepts hex, base58, base64, or JSON byte array)
jup keys add key1 --private-key <key>

# View your spot portfolio
jup spot portfolio
# Swap 1 SOL to USDC
jup spot swap --from SOL --to USDC --amount 1

# Open a 3x long SOL position with $10 USDC
jup perps open --asset SOL --side long --amount 10 --input USDC --leverage 3
# View your perps positions
jup perps positions
```

## Docs

> [!NOTE]
> This CLI is designed to be LLM friendly and **all commands are non-interactive**. Set JSON output mode globally for structured responses `jup config set --output json`, or use `-f json` flag on individual commands.

See the [`/docs`](./docs/) directory for specific guides and workflows:

- [Setup](docs/setup.md): Installation of the CLI
- [Config](docs/config.md): CLI settings and configurations
- [Keys](docs/keys.md): Private key management
- [Spot](docs/spot.md): Spot trading, transfers, token and portfolio data
- [Perps](docs/perps.md): Perps trading (leveraged longs/shorts)
