# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jupiter DEX CLI (`jup`) — a TypeScript CLI built on Bun for interacting with Jupiter swap aggregator on Solana. Uses Commander.js for command parsing, @solana/kit for transaction signing, and ky for HTTP requests. Published as `@jup-ag/cli` on npm.

**Distribution:** Deployed two ways — as an npm package (`npx @jup-ag/cli`) and as a standalone binary compiled via `bun build --compile`.

## Commands

```bash
# Run in development
bun run dev

# Compile to standalone binary
bun build src/index.ts --compile --outfile jup

# Format code
bunx prettier --write .

# Type-check
bun run typecheck

# Run tests
bun run test
```

## Architecture

**Entry point:** `src/index.ts` — initializes config, registers 3 command groups with Commander.

**Commands** (`src/commands/`): Static classes that register subcommands. Each delegates to library modules.

- `ConfigCommand` — `config list`, `config set`
- `KeysCommand` — `keys list/add/delete/use/solana-import`
- `SpotCommand` — `spot tokens/quote/swap`

**Libraries** (`src/lib/`):

- `Config` — manages `~/.config/jup/settings.json` (activeKey, output format)
- `Signer` — loads keypairs from `~/.config/jup/keys/{name}.json`, signs transactions
- `KeyPair` — generates/recovers keypairs (BIP39 mnemonics, BIP32 derivation)
- `Output` — renders data as table (via cli-table3) or JSON based on config; also provides display formatters (`formatDollar`, `formatBoolean`, `formatPercentageChange`)
- `NumberConverter` — converts between human-readable and on-chain decimal amounts

**API Clients** (`src/clients/`):

- `DatapiClient` — Jupiter token data/search API
- `UltraClient` — Jupiter Ultra swap API (quote + execute)

**Spot swap flow:** token search → UltraClient.getOrder → Signer.signTransaction → UltraClient.postExecute

## Code Style

- Prettier with default config (double quotes, semicolons, 80 char width, trailing commas in ES5 positions)
- TypeScript strict mode, ESNext target, bundler module resolution
- All core modules use static methods (no instantiation for Config, Output, NumberConverter, clients)
- Signer and KeyPair use instance methods with static factory constructors
