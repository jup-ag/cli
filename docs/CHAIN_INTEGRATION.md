# Chain Integration Guide

Connect your chain to Taifoon's multi-chain proof infrastructure in three steps.

## Prerequisites

```bash
# Install the Taifoon CLI (Jupiter fork with chain commands)
npm install -g @jup-ag/cli
# Or run directly:
npx tsx src/index.ts chain --help
```

## Step 1: Register Your Chain

```bash
# Auto-derives chain ID from your RPC endpoint
jup chain register --endpoint <your-rpc>

# Or specify chain ID explicitly
jup chain register --chain-id <id> --endpoint <your-rpc>

# Non-EVM chains
jup chain register --chain-id <id> --endpoint <rpc> --type solana
```

**What happens:**
1. CLI calls `eth_chainId` on your RPC to derive/verify chain ID
2. Validates: not a testnet, RPC is responsive, measures latency
3. Determines finality type and required light client verifier
4. Submits to Taifoon's chain queue (status: **PENDING**)
5. Taifoon team gets notified via Telegram with ✅/❌ buttons

**Testnet rejection:** Chain IDs like Sepolia (11155111), Goerli (5), Base Sepolia (84532), etc. are automatically blocked. Taifoon only supports mainnet.

## Step 2: Track Approval & Configure

```bash
# Check your submission status
jup chain submission --id <submission-id>

# List all pending submissions
jup chain submission --pending

# Once approved, configure block submission
jup chain configure --chain-id <id> --interval 12s --endpoint <your-rpc>
```

**Approval flow:**
- Submission enters `PENDING` state
- Taifoon team reviews via Telegram inline buttons
- On approval: chain added to warmbed RPC pool + RPC submissions enabled
- Typical approval: < 24 hours

## Step 3: Verify Cross-Chain Proofs

```bash
# Verify proof path from your chain to Ethereum
jup chain verify --from <your-chain> --to 1

# Verify specific block
jup chain verify --from <your-chain> --to 1 --block <number>
```

**Output includes:**
- V5 proof bundle (MMR siblings, super root, tx root)
- Full finality path: source consensus → destination consensus
- Light client verifier contract addresses

## Finality Types

Every chain maps to a consensus type in the `TaifoonLightClientRegistry`:

| Type | Name | Verifier | Chains |
|------|------|----------|--------|
| 0 | ETH_POS_CHECKPOINT | Casper FFG | Ethereum, Gnosis |
| 1 | L2_OUTPUT_ROOT | L2OutputOracle | OP, Base, Scroll, Linea, zkSync, Blast, Zora, Mode, Lisk, Unichain, Fraxtal, Abstract, Lyra |
| 2 | BSC_FAST_FINALITY | Parlia | BNB Smart Chain |
| 3 | DEPTH_BASED | N confirms | Bitcoin (6), Polygon (128), new chains (64 default) |
| 4 | INSTANT | Single-slot BFT | Monad, Sei, Avalanche, Fantom |
| 5 | HOTSHOT | HotStuff BFT | Flow, HyperEVM, ApeChain, RARI |
| 7 | GRANDPA | Relay finality | Polkadot, Kusama, Moonbeam, Astar, Peaq |
| 11 | ARB_BOLD | BoLD disputes | Arbitrum |
| 12 | TRON_DPOS | 27 SRs | Tron |
| 14 | SOL_TOWER_BFT | Tower BFT + PoH | Solana |

**Unknown chains** default to `DEPTH_BASED(64)`. Deploy a custom verifier for faster finality:
- Registry: `0xC38F10789FFeFc78cB611f9d7354B7B237b13B73` (Taifoon devnet 36927)
- Repo: [taifoon-io/taifoon-light-client](https://github.com/taifoon-io/taifoon-light-client)

## Other Commands

```bash
# List all registered chains
jup chain list

# Check chain status (registered, collecting, proofs available)
jup chain status --chain-id <id>

# Add additional RPC to existing chain pool
jup chain add-rpc --chain-id <id> --endpoint <rpc>
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chain/submit` | POST | Submit new chain for onboarding |
| `/chain/submissions` | GET | List submissions (filter: `?status=pending`) |
| `/chain/submission/:id` | GET | Get submission details |
| `/chain/approved` | GET | List all approved chains |
| `/chain/approve/:id` | POST | Approve chain (admin) |
| `/chain/reject/:id` | POST | Reject chain (admin) |

## Architecture

```
CLI (jup chain register)
    ↓ POST /chain/submit
Search API (taifoon-search)
    ↓ validates RPC, checks testnet, detects finality
    ↓ saves to chain-submissions.json
    ↓ sends Telegram notification to Chefs
    ↓
Team reviews → ✅ Approve / ❌ Reject
    ↓ POST /chain/approve/:id
    ↓ adds to CHAIN_META (RPC submissions now accepted)
    ↓ injects RPC into warmbed-collector
    ↓
Warmbed starts probing chain
    ↓
Spinner collector picks up chain
    ↓
DA-API generates V5 proofs
    ↓
jup chain verify → proof available!
```
