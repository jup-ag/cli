# Update

Self-update the CLI to the latest version.

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
3. If a newer version is available, fetches and runs `install.sh` which handles the update (Volta → npm → standalone binary fallback)
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

// Updated
{
  "currentVersion": "0.4.0",
  "latestVersion": "0.4.0",
  "status": "updated"
}
```

## Notes

- Supported platforms: `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`.
