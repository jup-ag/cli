# Changelog

## v0.2.2

### Features

- Add `perps history` command with filters for asset, side, action, and date range (609e24b)
- Consolidate `keys solana-import` into `keys add` (b8cd247)

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

- Add `perps` command (f626769)
- Add API key config (9e60e14)

### Improvements

- Add GitHub Actions release workflow (7cdb113)

## v0.1.0

Initial release of the Jupiter CLI with core spot trading capabilities:

- Spot token search, quoting, swapping, portfolio view, and transfers
- Private key management (generate, import, edit, delete)
- Configurable output formats (table and JSON) for LLM-friendly usage
- Install via npm or standalone binary
