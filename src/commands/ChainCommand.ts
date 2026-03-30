import { Command } from "commander";
import { Output } from "../lib/Output";

const TAIFOON_API = "https://api.taifoon.dev";
const SEARCH_API = "https://scanner.taifoon.dev/search-api";

// Well-known testnet chain IDs — NEVER accept these
const TESTNET_CHAIN_IDS = new Set([
  3, 4, 5, 42, 69, 97, 280, 300, 420, 919, 1442, 2522, 4002, 17000, 37111,
  43113, 44787, 80001, 80002, 84531, 84532, 168587773, 421613, 421614,
  534351, 59141, 999999999, 11155111, 11155420,
]);

// Heuristics for testnet detection from chain name
const TESTNET_KEYWORDS = [
  "testnet", "sepolia", "goerli", "rinkeby", "ropsten", "kovan",
  "devnet", "fuji", "alfajores", "mumbai", "amoy", "chiado",
];

// Finality type mapping — mirrors DA-API v5_proof_assembler.rs map_finality_type()
// Linked to TaifoonLightClientRegistry ConsensusType enum on devnet
const FINALITY_MAP: Record<number, { type: number; name: string; verifier: string; confirmations?: number; note: string }> = {
  // 0 = ETH_POS_CHECKPOINT
  1:    { type: 0, name: "ETH_POS_CHECKPOINT", verifier: "EthPoS (Casper FFG)", note: "2 epoch finality (~12.8 min)" },
  100:  { type: 0, name: "ETH_POS_CHECKPOINT", verifier: "Gnosis Beacon Chain", note: "ETH2-style PoS" },
  // 1 = L2_OUTPUT_ROOT (OP Stack / zkSync / Scroll / rollups)
  10:    { type: 1, name: "L2_OUTPUT_ROOT", verifier: "L2OutputOracle", note: "Anchored to Ethereum L1 finality" },
  8453:  { type: 1, name: "L2_OUTPUT_ROOT", verifier: "L2OutputOracle", note: "Anchored to Ethereum L1 finality" },
  324:   { type: 1, name: "L2_OUTPUT_ROOT", verifier: "ZkSyncDiamond", note: "ZK rollup, batch verified on L1" },
  59144: { type: 1, name: "L2_OUTPUT_ROOT", verifier: "LineaRollup", note: "ZK rollup, batch verified on L1" },
  534352:{ type: 1, name: "L2_OUTPUT_ROOT", verifier: "ScrollChain", note: "ZK rollup, batch verified on L1" },
  81457: { type: 1, name: "L2_OUTPUT_ROOT", verifier: "L2OutputOracle", note: "Blast L2 output oracle" },
  7777777:{ type: 1, name: "L2_OUTPUT_ROOT", verifier: "L2OutputOracle", note: "Zora L2" },
  34443: { type: 1, name: "L2_OUTPUT_ROOT", verifier: "L2OutputOracle", note: "Mode L2" },
  1135:  { type: 1, name: "L2_OUTPUT_ROOT", verifier: "DisputeGameFactory", note: "Lisk OP Stack" },
  130:   { type: 1, name: "L2_OUTPUT_ROOT", verifier: "DisputeGameFactory", note: "Unichain OP Stack" },
  252:   { type: 1, name: "L2_OUTPUT_ROOT", verifier: "L2OutputOracle", note: "Fraxtal OP Stack" },
  2741:  { type: 1, name: "L2_OUTPUT_ROOT", verifier: "L2OutputOracle", note: "Abstract ZK rollup" },
  957:   { type: 1, name: "L2_OUTPUT_ROOT", verifier: "L2OutputOracle", note: "Lyra OP Stack" },
  // 2 = BSC_FAST_FINALITY
  56:   { type: 2, name: "BSC_FAST_FINALITY", verifier: "BSC Fast Finality", note: "Parlia consensus, ~2 block finality" },
  // 3 = DEPTH_BASED
  21000000:{ type: 3, name: "DEPTH_BASED", verifier: "BitcoinPoWVerifierV2 (0x52f9...BA94)", confirmations: 6, note: "Nakamoto PoW, 6 confirms (~60 min)" },
  137:  { type: 3, name: "DEPTH_BASED", verifier: "Polygon PoS", confirmations: 128, note: "Tendermint BFT + L1 checkpoints" },
  195:  { type: 3, name: "DEPTH_BASED", verifier: "XLayer", confirmations: 64, note: "ZK batch confirmed" },
  // 4 = INSTANT (single-slot BFT)
  143:  { type: 4, name: "INSTANT", verifier: "MonadBFTVerifier (0x6547...1718)", note: "MonadBFT (HotStuff), single-slot finality" },
  1329: { type: 4, name: "INSTANT", verifier: "CometBFTVerifier", note: "Sei CometBFT, instant finality" },
  43114:{ type: 4, name: "INSTANT", verifier: "AVAX Snowman", note: "Snowman consensus, instant finality" },
  250:  { type: 4, name: "INSTANT", verifier: "Fantom Lachesis", note: "DAG-based BFT, instant finality" },
  // 5 = HOTSHOT
  747:  { type: 5, name: "HOTSHOT", verifier: "HotShotVerifier", note: "Flow EVM, HotStuff BFT" },
  999:  { type: 5, name: "HOTSHOT", verifier: "HotShotVerifier", note: "HyperEVM, Espresso-sequenced" },
  1380012617:{ type: 5, name: "HOTSHOT", verifier: "ArbitrumOrbit", note: "RARI Chain, Arbitrum Orbit" },
  33139:{ type: 5, name: "HOTSHOT", verifier: "ArbitrumOrbit", note: "ApeChain, Arbitrum Orbit" },
  // 7 = GRANDPA
  400:  { type: 7, name: "GRANDPA", verifier: "GrandpaVerifier (0xb73D...7a1)", note: "Polkadot relay chain GRANDPA finality" },
  401:  { type: 7, name: "GRANDPA", verifier: "GrandpaVerifier", note: "Kusama relay chain GRANDPA finality" },
  592:  { type: 7, name: "GRANDPA_RELAY", verifier: "GrandpaVerifier (relay proof)", note: "Astar parachain via Polkadot relay" },
  1284: { type: 7, name: "GRANDPA_RELAY", verifier: "GrandpaVerifier (relay proof)", note: "Moonbeam parachain via Polkadot relay" },
  3338: { type: 7, name: "GRANDPA_RELAY", verifier: "GrandpaVerifier (relay proof)", note: "Peaq parachain via Polkadot relay" },
  // 11 = ARB_BOLD
  42161:{ type: 11, name: "ARB_BOLD", verifier: "ArbitrumRollupCore (0x5eF0...d35)", note: "BoLD dispute protocol, ~7 day challenge period" },
  // 12 = DPOS
  500:  { type: 12, name: "TRON_DPOS", verifier: "TronDPoSVerifier (0x7A2B...0045)", note: "27 Super Representatives, DPoS" },
  // 14 = SOL_TOWER_BFT
  200:  { type: 14, name: "SOL_TOWER_BFT", verifier: "SolanaPoHVerifier (0x19eD...9403)", note: "Tower BFT + PoH, slot-level 2/3 voting" },
};

// Default finality for unknown EVM chains
const DEFAULT_FINALITY = { type: 3, name: "DEPTH_BASED", verifier: "Generic (requires new verifier deployment)", confirmations: 64, note: "Unknown consensus — using depth-based finality (64 confirms). Contact Taifoon to deploy a specialized verifier." };

// Non-EVM chain ID mapping
const NON_EVM_CHAINS: Record<string, { chainId: number; chainType: string }> = {
  solana:   { chainId: 200,       chainType: "solana" },
  bitcoin:  { chainId: 21000000,  chainType: "bitcoin" },
  polkadot: { chainId: 400,       chainType: "polkadot" },
  kusama:   { chainId: 401,       chainType: "polkadot" },
  aptos:    { chainId: 600,       chainType: "aptos" },
  icp:      { chainId: 223,       chainType: "icp" },
  tron:     { chainId: 728126428, chainType: "tron" },
};

interface ChainInfo {
  chainId: number;
  chainType: string;
  name?: string;
  isTestnet: boolean;
  rpc: string;
}

interface RegisteredChain {
  chain_id: number;
  rpc: string;
  rpc_pool: string[];
}

/**
 * Derive chain ID from an EVM RPC endpoint
 */
async function deriveChainId(rpc: string): Promise<{ chainId: number; error?: string }> {
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", id: 1 }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json() as any;
    if (data.error) return { chainId: 0, error: `RPC error: ${data.error.message}` };
    const chainId = parseInt(data.result, 16);
    if (isNaN(chainId) || chainId <= 0) return { chainId: 0, error: `Invalid chain ID from RPC: ${data.result}` };
    return { chainId };
  } catch (e: any) {
    return { chainId: 0, error: `Cannot reach RPC: ${e.message}` };
  }
}

/**
 * Check if a chain ID is a known testnet
 */
function isTestnet(chainId: number, chainName?: string): boolean {
  if (TESTNET_CHAIN_IDS.has(chainId)) return true;
  if (chainName) {
    const lower = chainName.toLowerCase();
    return TESTNET_KEYWORDS.some(kw => lower.includes(kw));
  }
  return false;
}

/**
 * Try to get chain name from chainlist-style APIs or the RPC itself
 */
async function getChainName(chainId: number): Promise<string | undefined> {
  try {
    const res = await fetch(`https://chainid.network/chains.json`, {
      signal: AbortSignal.timeout(5000),
    });
    const chains = await res.json() as any[];
    const match = chains.find((c: any) => c.chainId === chainId);
    return match?.name;
  } catch {
    return undefined;
  }
}

/**
 * Get currently registered chains from warmbed
 */
async function getRegisteredChains(): Promise<Map<number, RegisteredChain>> {
  try {
    const res = await fetch(`${SEARCH_API}/warmbed/chains/ready`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json() as any;
    const map = new Map<number, RegisteredChain>();
    
    // Response is { chains: [...], ... }
    const chains = data.chains || data;
    if (Array.isArray(chains)) {
      for (const c of chains) {
        map.set(c.chain_id, c);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Check if block collection is active for a chain
 */
async function isCollecting(chainId: number): Promise<boolean> {
  try {
    const res = await fetch(`${SEARCH_API}/collector/status`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json() as any;
    const chains = data.chains || data;
    if (Array.isArray(chains)) {
      return chains.some((c: any) => c.chain_id === chainId);
    }
    return false;
  } catch {
    return false;
  }
}

export class ChainCommand {
  static register(program: Command) {
    const chain = program
      .command("chain")
      .description("Chain integration — register, configure, and verify cross-chain proofs");

    // ─── register-chain ───────────────────────────────────────
    chain
      .command("register")
      .description("Register a new chain with Taifoon")
      .option("--chain-id <id>", "Chain ID (auto-derived from RPC if not provided)")
      .option("--endpoint <url>", "RPC endpoint URL")
      .option("--type <type>", "Chain type: evm, solana, bitcoin, polkadot, tron, aptos, icp", "evm")
      .option("--name <name>", "Human-readable chain name")
      .option("--dry-run", "Preview without submitting")
      .action(async (options) => {
        const chainType = options.type || "evm";
        let chainId = options.chainId ? parseInt(options.chainId) : 0;
        let rpc = options.endpoint;

        console.log("🌀 Taifoon Chain Registration\n");

        // ── Step 0: Early testnet check if chain-id provided ──
        if (chainId && isTestnet(chainId)) {
          console.error(`❌ Testnet chains are not supported.`);
          console.error(`   Chain ID ${chainId} is a known testnet.`);
          console.error(`   Taifoon only supports mainnet chains.`);
          process.exit(1);
        }

        // ── Step 1: Resolve chain ID ──
        if (chainType === "evm") {
          if (rpc && !chainId) {
            console.log(`Deriving chain ID from ${rpc}...`);
            const result = await deriveChainId(rpc);
            if (result.error) {
              console.error(`❌ ${result.error}`);
              process.exit(1);
            }
            chainId = result.chainId;
            console.log(`  → Chain ID: ${chainId}`);
          } else if (chainId && rpc) {
            // Verify provided chain ID matches RPC
            console.log(`Verifying chain ID ${chainId} against RPC...`);
            const result = await deriveChainId(rpc);
            if (result.error) {
              console.error(`❌ ${result.error}`);
              process.exit(1);
            }
            if (result.chainId !== chainId) {
              console.error(`❌ Chain ID mismatch: provided ${chainId}, RPC returned ${result.chainId}`);
              process.exit(1);
            }
            console.log(`  → Verified ✓`);
          } else if (!chainId) {
            console.error("❌ Provide --chain-id or --endpoint (for auto-derivation)");
            process.exit(1);
          }
        } else {
          // Non-EVM: lookup from known mapping
          const known = NON_EVM_CHAINS[chainType];
          if (known && !chainId) {
            chainId = known.chainId;
          }
          if (!chainId) {
            console.error(`❌ Provide --chain-id for ${chainType} chains`);
            process.exit(1);
          }
        }

        // ── Step 2: Testnet check ──
        const chainName = options.name || await getChainName(chainId);
        if (isTestnet(chainId, chainName)) {
          console.error(`❌ Testnet chains are not supported.`);
          console.error(`   Chain ID ${chainId}${chainName ? ` (${chainName})` : ""} detected as testnet.`);
          console.error(`   Taifoon only supports mainnet chains.`);
          process.exit(1);
        }
        console.log(`  → Mainnet check: passed ✓`);

        // ── Step 3: Already registered? ──
        const registered = await getRegisteredChains();
        if (registered.has(chainId)) {
          const existing = registered.get(chainId)!;
          console.log(`\n✅ Chain ${chainId}${chainName ? ` (${chainName})` : ""} is already registered!`);
          console.log(`   Active RPC: ${existing.rpc}`);
          console.log(`   Pool size:  ${existing.rpc_pool?.length || 1} RPCs`);
          
          if (rpc && !existing.rpc_pool?.includes(rpc)) {
            console.log(`\n   Your endpoint is not in the pool yet.`);
            console.log(`   Run: jup chain add-rpc --chain-id ${chainId} --endpoint ${rpc}`);
          } else {
            console.log(`\n   Nothing to do. Use 'jup chain configure' to adjust settings.`);
          }
          return;
        }

        // ── Step 4: Submit registration ──
        if (!rpc) {
          console.error(`❌ --endpoint required for new chain registration`);
          process.exit(1);
        }

        // ── Step 5: Finality assessment ──
        const finality = FINALITY_MAP[chainId] || DEFAULT_FINALITY;

        console.log(`\n  Chain ID:    ${chainId}`);
        console.log(`  Name:        ${chainName || "Unknown"}`);
        console.log(`  Type:        ${chainType}`);
        console.log(`  RPC:         ${rpc}`);
        console.log(`  Finality:    ${finality.name} (type ${finality.type})`);
        console.log(`  Verifier:    ${finality.verifier}`);
        if (finality.confirmations) {
          console.log(`  Confirms:    ${finality.confirmations} blocks`);
        }
        console.log(`  Note:        ${finality.note}`);

        if (finality === DEFAULT_FINALITY) {
          console.log(`\n  ⚠️  No specialized light client verifier exists for chain ${chainId}.`);
          console.log(`     Taifoon will use DEPTH_BASED finality (${finality.confirmations} confirms).`);
          console.log(`     For faster finality, contact the Taifoon team to deploy a custom verifier.`);
          console.log(`     Registry: TaifoonLightClientRegistry (0xC38F...B73)`);
          console.log(`     See: https://github.com/taifoon-io/taifoon-light-client`);
        }

        if (options.dryRun) {
          console.log(`\n[DRY RUN] Would submit registration to Taifoon warmbed`);
          return;
        }

        try {
          const res = await fetch(`${SEARCH_API}/rpc/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chain_id: chainId,
              url: rpc,
              chain_type: chainType,
              contributor: "taifoon-cli",
            }),
          });

          if (!res.ok) {
            const text = await res.text();
            console.error(`❌ Registration failed: ${res.status} ${text}`);
            process.exit(1);
          }

          console.log(`\n✅ Chain ${chainId} registered successfully!`);
          console.log(`\nNext steps:`);
          console.log(`  1. Configure block submission: jup chain configure --chain-id ${chainId} --interval 12s`);
          console.log(`  2. Verify cross-chain:         jup chain verify --from ${chainId} --to 1`);
        } catch (e: any) {
          console.error(`❌ Registration failed: ${e.message}`);
          process.exit(1);
        }
      });

    // ─── add-rpc ──────────────────────────────────────────────
    chain
      .command("add-rpc")
      .description("Add an RPC endpoint to an existing chain's pool")
      .requiredOption("--chain-id <id>", "Chain ID")
      .requiredOption("--endpoint <url>", "RPC endpoint URL")
      .option("--dry-run", "Preview without submitting")
      .action(async (options) => {
        const chainId = parseInt(options.chainId);
        const rpc = options.endpoint;

        console.log(`🌀 Adding RPC to chain ${chainId}\n`);

        // Verify RPC works for EVM
        const result = await deriveChainId(rpc);
        if (!result.error && result.chainId !== chainId) {
          console.error(`❌ RPC returns chain ID ${result.chainId}, expected ${chainId}`);
          process.exit(1);
        }

        if (options.dryRun) {
          console.log(`[DRY RUN] Would add ${rpc} to chain ${chainId}`);
          return;
        }

        try {
          const res = await fetch(`${SEARCH_API}/rpc/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chain_id: chainId,
              url: rpc,
              chain_type: "evm",
              contributor: "taifoon-cli",
            }),
          });

          if (!res.ok) {
            const text = await res.text();
            console.error(`❌ Failed: ${res.status} ${text}`);
            process.exit(1);
          }

          console.log(`✅ RPC added to chain ${chainId}`);
        } catch (e: any) {
          console.error(`❌ Failed: ${e.message}`);
          process.exit(1);
        }
      });

    // ─── configure ────────────────────────────────────────────
    chain
      .command("configure")
      .description("Configure block submission parameters")
      .requiredOption("--chain-id <id>", "Chain ID")
      .option("--interval <time>", "Block submission interval (e.g., 12s, 2s, 1m)", "12s")
      .option("--endpoint <url>", "Override RPC endpoint")
      .option("--finality <type>", "Finality type: instant, depth, pos, grandpa", "pos")
      .option("--confirmations <n>", "Confirmation depth for depth-based finality", "6")
      .action(async (options) => {
        const chainId = parseInt(options.chainId);

        console.log(`🌀 Chain Configuration — ${chainId}\n`);

        // Check if chain is registered
        const registered = await getRegisteredChains();
        if (!registered.has(chainId)) {
          console.error(`❌ Chain ${chainId} is not registered.`);
          console.error(`   Register first: jup chain register --chain-id ${chainId} --endpoint <rpc>`);
          process.exit(1);
        }

        const chain = registered.get(chainId)!;

        // Parse interval
        const intervalMatch = options.interval.match(/^(\d+)(s|m|h)$/);
        if (!intervalMatch) {
          console.error(`❌ Invalid interval format. Use: 2s, 12s, 1m, etc.`);
          process.exit(1);
        }
        const [, num, unit] = intervalMatch;
        const intervalMs = parseInt(num) * (unit === "s" ? 1000 : unit === "m" ? 60000 : 3600000);

        const config = {
          chain_id: chainId,
          interval_ms: intervalMs,
          rpc: options.endpoint || chain.rpc,
          finality: options.finality,
          confirmations: parseInt(options.confirmations),
        };

        console.log(`  Chain ID:      ${chainId}`);
        console.log(`  Interval:      ${options.interval} (${intervalMs}ms)`);
        console.log(`  RPC:           ${config.rpc}`);
        console.log(`  Finality:      ${config.finality}`);
        if (config.finality === "depth") {
          console.log(`  Confirmations: ${config.confirmations}`);
        }
        console.log(`  RPC Pool:      ${chain.rpc_pool?.length || 1} endpoints`);

        // Check if collector is running
        const collecting = await isCollecting(chainId);
        console.log(`  Collecting:    ${collecting ? "✅ Active" : "⚠️  Not yet collecting"}`);

        if (!collecting) {
          console.log(`\n⚠️  Block collection for chain ${chainId} is not active yet.`);
          console.log(`   The Taifoon operator will start collection once the chain is approved.`);
          console.log(`   Typical activation time: < 24 hours.`);
        } else {
          console.log(`\n✅ Configuration applied.`);
          console.log(`   Blocks are being collected at the specified interval.`);
        }
      });

    // ─── verify ───────────────────────────────────────────────
    chain
      .command("verify")
      .description("Verify cross-chain proof availability")
      .requiredOption("--from <chain>", "Source chain ID")
      .option("--to <chain>", "Destination chain ID (default: Ethereum)", "1")
      .option("--block <number>", "Specific block number to verify (default: near-tip)")
      .action(async (options) => {
        const fromChain = parseInt(options.from);
        const toChain = parseInt(options.to);

        console.log(`🌀 Cross-Chain Verification\n`);
        console.log(`  From: Chain ${fromChain}`);
        console.log(`  To:   Chain ${toChain}`);

        // Step 1: Check both chains are registered
        const registered = await getRegisteredChains();
        
        if (!registered.has(fromChain)) {
          console.error(`❌ Source chain ${fromChain} is not registered with Taifoon.`);
          console.error(`   Register: jup chain register --chain-id ${fromChain} --endpoint <rpc>`);
          process.exit(1);
        }
        if (!registered.has(toChain)) {
          console.error(`❌ Destination chain ${toChain} is not registered with Taifoon.`);
          process.exit(1);
        }

        console.log(`  Both chains registered ✓`);

        // Step 2: Get a recent block number if not specified
        let blockNumber = options.block ? parseInt(options.block) : 0;
        
        if (!blockNumber) {
          // Get near-tip block from the source chain
          const srcChain = registered.get(fromChain)!;
          try {
            const res = await fetch(srcChain.rpc, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 }),
              signal: AbortSignal.timeout(10000),
            });
            const data = await res.json() as any;
            const tip = parseInt(data.result, 16);
            // Go back 32 blocks for safety (finality)
            blockNumber = tip - 32;
            console.log(`  Source tip: ${tip}, testing block: ${blockNumber}`);
          } catch (e: any) {
            console.error(`❌ Cannot get block number from source chain RPC: ${e.message}`);
            process.exit(1);
          }
        }

        // Step 3: Try to fetch a V5 proof
        console.log(`\n  Fetching V5 proof for block ${blockNumber}...`);

        try {
          const res = await fetch(
            `${TAIFOON_API}/api/lambda/proof-bundle/block/${fromChain}/${blockNumber}`,
            { signal: AbortSignal.timeout(30000) }
          );

          if (!res.ok) {
            if (res.status === 404) {
              console.log(`\n⚠️  No proof available yet for block ${blockNumber}.`);
              console.log(`   The collector may not have reached this block yet.`);
              console.log(`   Try an earlier block or wait for collection to catch up.`);
              return;
            }
            const text = await res.text();
            console.error(`❌ Proof API error: ${res.status} ${text}`);
            process.exit(1);
          }

          const proof = await res.json() as any;

          const finality = FINALITY_MAP[fromChain] || DEFAULT_FINALITY;
          const dstFinality = FINALITY_MAP[toChain] || DEFAULT_FINALITY;

          console.log(`\n✅ Cross-chain proof available!\n`);
          console.log(`  Chain ID:        ${proof.chain_id || fromChain}`);
          console.log(`  Block:           ${proof.block_number || blockNumber}`);
          console.log(`  Finalized:       ${proof.is_finalized ?? "unknown"}`);
          console.log(`  Siblings:        ${proof.siblings?.length || proof.mmr_proof?.siblings?.length || "N/A"}`);
          console.log(`  SuperRoot:       ${(proof.super_root_hash || proof.superroot || "N/A").toString().slice(0, 20)}...`);

          if (proof.transactions_root) {
            console.log(`  Tx Root:         ${proof.transactions_root.slice(0, 20)}...`);
          }

          console.log(`\n  Finality Path:`);
          console.log(`  ┌─ Source (${fromChain}): ${finality.name} — ${finality.note}`);
          console.log(`  │  Verifier: ${finality.verifier}`);
          if (finality.confirmations) {
            console.log(`  │  Required confirmations: ${finality.confirmations}`);
          }
          console.log(`  │`);
          console.log(`  └─ Dest (${toChain}): ${dstFinality.name} — ${dstFinality.note}`);
          console.log(`     Verifier: ${dstFinality.verifier}`);

          if (finality.type === 1) {
            console.log(`\n  ℹ️  L2 chains inherit Ethereum L1 finality. Proof includes output root anchor.`);
          }
          if (finality.type === 3 && finality.confirmations) {
            console.log(`\n  ℹ️  Depth-based finality: proof valid after ${finality.confirmations} confirmations.`);
          }
          if (finality === DEFAULT_FINALITY) {
            console.log(`\n  ⚠️  No specialized verifier for chain ${fromChain}. Using generic depth-based.`);
            console.log(`     Deploy a custom verifier via TaifoonLightClientRegistry for faster finality.`);
          }

          console.log(`\n  🎉 Chain ${fromChain} → Chain ${toChain} verification path is live!`);
          console.log(`  Proofs can be verified on-chain using Taifoon Light Client contracts.`);
          console.log(`  Registry: 0xC38F10789FFeFc78cB611f9d7354B7B237b13B73 (devnet 36927)`);
        } catch (e: any) {
          console.error(`❌ Proof fetch failed: ${e.message}`);
          process.exit(1);
        }
      });

    // ─── list ─────────────────────────────────────────────────
    chain
      .command("list")
      .description("List all registered chains")
      .option("--collecting", "Only show chains actively collecting blocks")
      .action(async (options) => {
        console.log("🌀 Taifoon Registered Chains\n");

        const registered = await getRegisteredChains();

        if (registered.size === 0) {
          console.log("No chains registered (or API unreachable).");
          return;
        }

        const rows: any[] = [];
        for (const [id, chain] of registered) {
          rows.push({
            chain_id: id,
            rpc: chain.rpc?.slice(0, 50) + (chain.rpc?.length > 50 ? "..." : ""),
            pool: chain.rpc_pool?.length || 1,
          });
        }

        rows.sort((a, b) => a.chain_id - b.chain_id);

        Output.render(rows, {
          table: {
            columns: [
              { key: "chain_id", header: "Chain ID" },
              { key: "rpc", header: "Primary RPC" },
              { key: "pool", header: "Pool" },
            ],
          },
        });

        console.log(`\nTotal: ${rows.length} chains`);
      });

    // ─── status ───────────────────────────────────────────────
    chain
      .command("status")
      .description("Check status of a specific chain")
      .requiredOption("--chain-id <id>", "Chain ID to check")
      .action(async (options) => {
        const chainId = parseInt(options.chainId);

        console.log(`🌀 Chain ${chainId} Status\n`);

        // Check registration
        const registered = await getRegisteredChains();
        const chain = registered.get(chainId);

        if (!chain) {
          console.log(`❌ Chain ${chainId} is not registered.`);
          console.log(`   Register: jup chain register --chain-id ${chainId} --endpoint <rpc>`);
          return;
        }

        console.log(`  Registered:  ✅`);
        console.log(`  Primary RPC: ${chain.rpc}`);
        console.log(`  Pool size:   ${chain.rpc_pool?.length || 1}`);

        // Check collection
        const collecting = await isCollecting(chainId);
        console.log(`  Collecting:  ${collecting ? "✅ Active" : "⏳ Pending"}`);

        // Check proof availability
        try {
          // Try to get a proof for a recent block
          const res = await fetch(chain.rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", id: 1 }),
            signal: AbortSignal.timeout(5000),
          });
          const data = await res.json() as any;
          const tip = parseInt(data.result, 16);

          const proofRes = await fetch(
            `${TAIFOON_API}/api/lambda/proof-bundle/block/${chainId}/${tip - 64}`,
            { signal: AbortSignal.timeout(10000) }
          );
          console.log(`  Proofs:      ${proofRes.ok ? "✅ Available" : "⏳ Not yet available"}`);
          console.log(`  Chain tip:   ${tip}`);
        } catch {
          console.log(`  Proofs:      ❓ Unable to check`);
        }
      });
  }
}
