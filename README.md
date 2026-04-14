# Jupiter CLI

CLI for interacting with Jupiter's products on Solana: Spot, Perps, Lend, Prediction Markets, Token Verification and more.

> [!WARNING]
> This project is pre-v1 (early alpha) and should be considered unstable. Breaking changes may be introduced without warning. Please reach out to the team if you'd like to use or contribute to the CLI.

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

# Sign a base64 transaction returned from --dry-run
jup sign --tx <base64-transaction>

# View your spot portfolio
jup spot portfolio
# Swap 1 SOL to USDC
jup spot swap --from SOL --to USDC --amount 1
# Reclaim rent from empty token accounts
jup spot reclaim

# Open a 3x long SOL position with 10 USDC
jup perps open --asset SOL --side long --amount 10 --input USDC --leverage 3
# View your perps positions
jup perps positions

# View lending tokens and APY
jup lend earn tokens
# Deposit 100 USDC into lending
jup lend earn deposit --token USDC --amount 100
# View your lending positions
jup lend earn positions

# Browse prediction markets
jup predictions events --category crypto
# Open a prediction position with 10 USDC
jup predictions open --market <marketId> --side yes --amount 10
# View your prediction positions
jup predictions positions

# Check if a token is eligible for verification
jup vrfd check --token <mint-address>
# Submit a token verification request (costs 1000 JUP)
jup vrfd submit --token <mint-address> --project-twitter @projecthandle --description "DeFi protocol on Solana"
```

## Docs

> [!NOTE]
> This CLI is designed to be LLM friendly and **all commands are non-interactive**. Set JSON output mode globally for structured responses: `jup config set --output json`, or use `-f json` flag on individual commands.
>
> Use `--dry-run` on any transacting command to preview the result without signing or submitting on-chain. In JSON mode, the response includes the unsigned base64 `transaction`, which can be signed with the `sign` command.

[Read the docs](./docs/) for specific guides, examples, and workflows:

- [Setup](docs/setup.md): Installation of the CLI
- [Update](docs/update.md): Self-update the CLI
- [Config](docs/config.md): CLI settings and configurations
- [Keys](docs/keys.md): Private key management
- [Sign](docs/sign.md): Sign transactions from `--dry-run`
- [Spot](docs/spot.md): Spot trading, transfers, token search and portfolio data
- [Perps](docs/perps.md): Perps trading (leveraged longs/shorts)
- [Lend](docs/lend.md): Lending and yield farming
- [Predictions](docs/predictions.md): Prediction markets
- [Vrfd](docs/vrfd.md): Token verification

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a detailed release history.
