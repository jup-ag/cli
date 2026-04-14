# Changelog

## v0.9.0

### Features

- Add `sign` command for signing `--dry-run` txs (#16)

### Improvements

- Show market rules in `predictions events` output (4bad927)

## v0.8.1

### Bug Fixes

- Update `predictions` market metadata handling for API changes (90d9ff7)
- Fix `predictions events --sort` handling (60f1f81)

## v0.8.0

### Features

- Add `vrfd check` and `vrfd submit` commands for Jupiter token verification (#15)

## v0.7.1

### Bug Fixes

- Update `@solana/kit` to fix `keys` issues (bc42d3d)

### Improvements

- Add Prettier formatting scripts and fix formatting (0c81498)
- Move `requireEnv` and `requireParam` into `KeychainConfig` as private static methods (08877ea)

## v0.7.0

### Features

- Add `solana-keychain` support with 10 remote/managed key backends (AWS KMS, CDP, Crossmint, Dfns, Fireblocks, GCP KMS, Para, Privy, Turnkey, Vault) (#13)

## v0.6.0

### Features

- Add `--dry-run` flag to all transacting commands (#11)
- Add `--slippage` param to `spot swap` (#5)

## v0.5.0

### Features

- Add `predictions` command for prediction markets (#10)
- Add `update` command for self-updating the CLI (#9)
- Resolve token arguments from user holdings for `swap --from`, `transfer --token`, and `reclaim --token` (#8)
- Add `spot reclaim` command to close empty ATAs and reclaim locked SOL rent (#7)

### Bug Fixes

- Improve `update` command and install script hardening (ca2d16e)

## v0.4.0

### Features

- Add `jup lend earn` commands: `tokens`, `positions`, `deposit`, `withdraw` (25e1814)

### Improvements

- Extract shared `Swap.execute()`, `Swap.validateAmountOpts()`, `Swap.getScaledUiMultiplier()`, and `DatapiClient.resolveToken()` utilities from `SpotCommand` (25e1814)
- Improve release skill (b783a2a)

## v0.3.0

### Features

- Add `spot history` command with token and date range filters (27a79a0)

### Improvements

- Use Node LTS for npm OIDC trusted publishing (8f66a47)
- Add changelog and release skill (06beeda)

## v0.2.2

### Features

- Add `perps history` command with filters for asset, side, action, and date range (609e24b)
- Consolidate `keys solana-import` into `keys add` (#6)

### Improvements

- Include `registry-url` in `release.yml` (0cdee60)
- Standardise docs and improve readability (fa8491c)
- Add `perps history` command to docs (1b6a338)

## v0.2.1

### Bug Fixes

- Fix `perps` API types (ae72b8c)

### Improvements

- Pin engines and fix CI (1363db7)

## v0.2.0

### Features

- Add `perps` command (#3)
- Add API key config (9e60e14)

### Improvements

- Add GitHub Actions release workflow (#2)

## v0.1.0

Initial release of the Jupiter CLI with core spot trading capabilities:

- Spot token search, quoting, swapping, portfolio view, and transfers
- Private key management (generate, import, edit, delete)
- Configurable output formats (table and JSON) for LLM-friendly usage
- Install via npm or standalone binary
