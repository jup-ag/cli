# Update

Self-update the CLI to the latest version. Detects whether the CLI was installed via a package manager or as a standalone binary and acts accordingly.

## Usage

```bash
# Update to the latest version
jup update

# Check for updates without installing
jup update --check
```

## How it works

1. Checks the latest release on GitHub
2. Compares with the installed version
3. If a newer version is available:
   - **Package manager installs** — runs the appropriate update command (npm, pnpm, yarn, bun, or Volta)
   - **Binary installs** — downloads the new binary, verifies its SHA-256 checksum, and atomically replaces the current binary
4. Outputs the result

## JSON output

```js
// Up to date
{
  "currentVersion": "0.4.0",
  "latestVersion": "0.4.0",
  "status": "up_to_date"
}

// Update available (--check)
{
  "currentVersion": "0.3.0",
  "latestVersion": "0.4.0",
  "status": "update_available"
}

// Updated via package manager
{
  "currentVersion": "0.3.0",
  "latestVersion": "0.4.0",
  "status": "updated",
  "method": "npm"
}

// Updated via binary
{
  "currentVersion": "0.3.0",
  "latestVersion": "0.4.0",
  "status": "updated",
  "method": "binary"
}
```

## Notes

- Binary updates require write permission to the binary path. If you get a permission error, run `sudo jup update`.
- Binary builds are available for: `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`.
