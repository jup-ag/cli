# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jupiter CLI (`jup`) — a TypeScript CLI for interacting with Jupiter's products on Solana: Spot, Perps, Lend, Prediction Markets and more. Uses Commander.js for command parsing, @solana/kit for transaction signing, and ky for HTTP requests.

**Distribution:** See `.github/workflows/release.yml` — publishes to npm and creates GitHub releases with compiled binaries on version bump to `main`.

## Commands

```bash
# Run in development
bun run dev

# Compile to standalone binary
bun build src/index.ts --compile --outfile jup

# Format code
bunx prettier --write .

# Run all tests: lint, typecheck, tests
bun run ci
```

## Architecture

**Entry point:** `src/index.ts` — initializes config, registers 4 command groups with Commander.

**Commands** (`src/commands/`): Static classes that register subcommands. Each delegates to library modules.

- `ConfigCommand` — `config list`, `config set`
- `KeysCommand` — `keys list/add/delete/edit/use/solana-import`
- `PerpsCommand` — `perps positions/markets/open/set/close`
- `SpotCommand` — `spot tokens/quote/swap/portfolio/transfer`

**Libraries** (`src/lib/`):

- `Asset` — token metadata (mint addresses, decimals) for SOL, BTC, ETH, USDC; `resolveAsset()` for name lookup
- `Config` — manages `~/.config/jup/settings.json` (activeKey, output format, API key)
- `Signer` — loads keypairs from `~/.config/jup/keys/{name}.json`, signs transactions
- `KeyPair` — generates/recovers keypairs (BIP39 mnemonics, BIP32 derivation)
- `Output` — renders data as table (via cli-table3) or JSON based on config; also provides display formatters (`formatDollar`, `formatBoolean`, `formatPercentageChange`)
- `NumberConverter` — converts between human-readable and on-chain decimal amounts

**API Clients** (`src/clients/`):

- `DatapiClient` — Jupiter token data/search API
- `UltraClient` — Jupiter Ultra swap API (quote + execute)
- `PerpsClient` — Jupiter Perps API v2 (positions, orders, TP/SL)

**Spot swap flow:** token search → UltraClient.getOrder → Signer.signTransaction → UltraClient.postExecute

**Perps flow:** PerpsClient.post* → Signer.signTransaction → PerpsClient.postExecute

## Code Style

- Prettier with default config (double quotes, semicolons, 80 char width, trailing commas in ES5 positions)
- TypeScript strict mode, ESNext target, bundler module resolution
- All core modules use static methods (no instantiation for Config, Output, NumberConverter, clients)
- Signer and KeyPair use instance methods with static factory constructors
