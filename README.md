# Jupiter CLI (`jup`)

CLI for interacting with Jupiter on Solana — swap, trade perps, lend, and more from the terminal.

## Install

```bash
npm i -g @jup-ag/cli
```

Or download a standalone binary from [GitHub Releases](https://github.com/jup-ag/cli/releases).

## Quick start

```bash
# Generate a key
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

## Commands

| Command | Description |
| --- | --- |
| `jup config list` | View current settings |
| `jup config set` | Update settings (output format, active key) |
| `jup keys add` | Generate or recover a keypair |
| `jup keys list` | List stored keys |
| `jup keys use` | Set the active signing key |
| `jup keys edit` | Rename or update a key's credentials |
| `jup keys delete` | Delete a key |
| `jup keys solana-import` | Import a Solana CLI keypair |
| `jup spot tokens` | Search for tokens |
| `jup spot quote` | Get a swap quote |
| `jup spot swap` | Execute a swap |
| `jup spot portfolio` | View wallet holdings |
| `jup spot transfer` | Transfer SOL or SPL tokens |

Use `--help` on any command for full options.

## For AI agents

This CLI is designed to be agent-friendly. Set JSON output mode for structured responses:

```bash
jup config set --output json
```

See [`llms.txt`](llms.txt) for the full agent guide, or jump directly to a skill:

- [Setup](docs/setup.md) — Install, configure, and manage keys
- [Spot Trading](docs/spot.md) — Token search, quotes, swaps, transfers, and portfolios

## License

ISC
