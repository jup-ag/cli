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

## Quick start

```bash
# Generate a new key called 'default'
jup keys add default

# Or import an existing Solana CLI keypair
jup keys solana-import

# Get a swap quote
jup spot quote --from SOL --to USDC --amount 1

# Execute a swap
jup spot swap --from SOL --to USDC --amount 1

# Check your portfolio
jup spot portfolio
```

## Docs

See the [`/docs`](./docs/) directory for specific guides and workflows:

- [Setup](docs/setup.md): Installation of the CLI
- [Config](docs/config.md): CLI settings and configurations
- [Keys](docs/keys.md): Private key management
- [Spot](docs/spot.md): Swaps, transfers, token and portfolio data

> This CLI is designed to be LLM friendly and all commands are non-interactive. Set JSON output mode for structured responses: `jup config set --output json`.
