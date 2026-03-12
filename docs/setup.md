# Setup

## Install

### Option 1: npm (recommended if npm is available)

```bash
npm i -g @jup-ag/cli
```

### Option 2: Install script

Auto-detects the best install method (volta > npm > standalone binary):

```bash
curl -fsSL https://raw.githubusercontent.com/jup-ag/cli/main/scripts/install.sh | bash
```

### Option 3: Standalone binary

Download the latest binary from GitHub releases:

```bash
curl -fsSL https://github.com/jup-ag/cli/releases/latest/download/jup-linux-x64 -o jup
chmod +x jup
sudo mv jup /usr/local/bin/
```

Replace `jup-linux-x64` with the appropriate binary for your platform (`jup-darwin-arm64`, `jup-darwin-x64`, etc.).

### Option 4: Build from source

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/jup-ag/cli.git
cd cli
bun install
bun build src/index.ts --compile --outfile jup
sudo mv jup /usr/local/bin/
```
