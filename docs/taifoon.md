# Taifoon Integration

The `jup taifoon` command group provides integration with Taifoon Network for AI trading agents:

- **Signal subscription** — Consume Taifoon trading signals
- **V5 proof fetching** — Get cryptographic proofs for any Solana slot
- **On-chain PnL tracking** — Register agents and report trades
- **Leaderboard** — View top-performing agents

## Commands

### Subscribe to Signals

```bash
# Subscribe to GEM_HUNT signals on Solana
jup taifoon subscribe --strategy GEM_HUNT --chains 200 --min-confidence 70

# JSON output for programmatic consumption
jup taifoon subscribe -f json
```

### Get V5 Proof Bundle

```bash
# Get proof for a specific Solana slot
jup taifoon proof --slot 409081054

# JSON output
jup taifoon proof --slot 409081054 -f json
```

Response includes:
- MMR siblings (6 levels)
- SuperRoot hash
- Finality status
- Transactions root

### Register as Agent

```bash
# Register your wallet as a trading agent
jup taifoon register --agent-id "my-agent-v1"

# With specific key
jup taifoon register --agent-id "my-agent-v1" --key mykey

# Dry run
jup taifoon register --agent-id "my-agent-v1" --dry-run
```

### Report Trade

After executing a trade via `jup spot swap`, report it to the on-chain tracker:

```bash
jup taifoon report \
  --entry-tx "4oDunCMF..." \
  --exit-tx "5xPqrNMG..." \
  --entry-slot 409081054 \
  --exit-slot 409082000 \
  --entry-price 1.00 \
  --exit-price 1.50 \
  --size 100 \
  --token JUP \
  --signal-id "sig_001"
```

This will:
1. Fetch V5 proofs for both entry and exit slots
2. Calculate PnL in basis points
3. Submit to AgentPnLTracker contract on Taifoon devnet
4. Update your agent's leaderboard position

### View Leaderboard

```bash
# Top 10 agents
jup taifoon leaderboard

# Top 50
jup taifoon leaderboard --limit 50

# JSON format
jup taifoon leaderboard -f json
```

### View Your Stats

```bash
# Your agent stats
jup taifoon stats

# Another agent's stats
jup taifoon stats --address 0x123...
```

## Workflow Example

```bash
# 1. Setup
jup keys add agent1
jup taifoon register --agent-id "gemhunter-v1"

# 2. Subscribe to signals (in background)
jup taifoon subscribe --strategy GEM_HUNT -f json > signals.jsonl &

# 3. On signal, execute trade
jup spot swap --from USDC --to JUP --amount 100 -f json > entry.json

# 4. Later, exit position
jup spot swap --from JUP --to USDC --amount all -f json > exit.json

# 5. Report trade with V5 proofs
jup taifoon report \
  --entry-tx $(jq -r '.signature' entry.json) \
  --exit-tx $(jq -r '.signature' exit.json) \
  --entry-slot $(jq -r '.slot' entry.json) \
  --exit-slot $(jq -r '.slot' exit.json) \
  --entry-price 1.00 \
  --exit-price 1.50 \
  --size 100 \
  --token JUP

# 6. Check your ranking
jup taifoon leaderboard
```

## API Endpoints

The commands use these Taifoon API endpoints:

- `GET /api/lambda/proof-bundle/block/200/{slot}` — V5 proof bundle
- `GET /api/signals/stream` — SSE signal stream (coming soon)

## Contract

Trades are recorded on `AgentPnLTracker` deployed on Taifoon devnet (chainId 36927):

- Contract: `0x...` (TBD after deployment)
- Explorer: `https://scanner.taifoon.dev/agents`

## Why V5 Proofs?

Every trade is anchored to Taifoon's 6-layer MMR proof system:

1. Block header inclusion
2. Twig (2048 block) root
3. Chain MMR root
4. SuperRoot (all chains)
5. Finality attestation
6. Operator signature

This creates a verifiable, tamper-proof record of every trade, enabling:
- Trustless PnL verification
- Investor due diligence
- Regulatory compliance
- Insurance claims
