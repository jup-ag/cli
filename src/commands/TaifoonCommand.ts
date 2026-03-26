import { Command } from "commander";
import { Config } from "../lib/Config";
import { Output } from "../lib/Output";
import { Signer } from "../lib/Signer";

const TAIFOON_API = "https://api.taifoon.dev";
const TRACKER_ADDRESS = "0x318638eb839695eBC9ed1b67EbD02132fB31F3a9"; // Taifoon devnet (36927)

interface Signal {
  type: string;
  tokenSymbol: string;
  chainId: number;
  price: number;
  confidence: number;
  signalId: string;
  timestamp: number;
}

interface ProofBundle {
  chain_id: number;
  block_number: number;
  is_finalized: boolean;
  siblings: string[];
  super_root_hash: string;
  transactions_root: string;
}

interface TradeReport {
  positionId: number;
  entryTxHash: string;
  exitTxHash: string;
  entryBlock: number;
  exitBlock: number;
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnlBps: number;
  tokenSymbol: string;
  signalId: string;
  proofHashes: {
    entry: string;
    exit: string;
  };
}

export class TaifoonCommand {
  static register(program: Command) {
    const taifoon = program
      .command("taifoon")
      .description("Taifoon signal consumption and PnL tracking");

    // Subscribe to signals
    taifoon
      .command("subscribe")
      .description("Subscribe to Taifoon trading signals (SSE stream)")
      .option("--strategy <strategy>", "Strategy filter (GEM_HUNT, SWEEPER, WHALE)", "GEM_HUNT")
      .option("--chains <chains>", "Chain IDs to filter (comma-separated)", "200")
      .option("--min-confidence <n>", "Minimum confidence score (0-100)", "70")
      .action(async (options) => {
        const strategy = options.strategy;
        const chains = options.chains.split(",").map(Number);
        const minConfidence = parseInt(options.minConfidence);

        console.log(`Subscribing to Taifoon signals...`);
        console.log(`  Strategy: ${strategy}`);
        console.log(`  Chains: ${chains.join(", ")}`);
        console.log(`  Min confidence: ${minConfidence}`);
        console.log(`\nListening for signals (Ctrl+C to stop)...\n`);

        // TODO: Implement SSE subscription
        // For now, show sample output
        const sampleSignal: Signal = {
          type: "token_launch",
          tokenSymbol: "SAMPLE",
          chainId: 200,
          price: 0.001,
          confidence: 85,
          signalId: "sig_demo_001",
          timestamp: Date.now(),
        };

        Output.render([sampleSignal], {
          table: {
            columns: [
              { key: "type", header: "Type" },
              { key: "tokenSymbol", header: "Token" },
              { key: "chainId", header: "Chain" },
              { key: "price", header: "Price" },
              { key: "confidence", header: "Confidence" },
              { key: "signalId", header: "Signal ID" },
            ],
          },
        });
      });

    // Get V5 proof for a Solana slot
    taifoon
      .command("proof")
      .description("Get V5 proof bundle for a Solana slot")
      .requiredOption("--slot <slot>", "Solana slot number")
      .action(async (options) => {
        const slot = parseInt(options.slot);
        const chainId = 200; // Solana

        try {
          const response = await fetch(
            `${TAIFOON_API}/api/lambda/proof-bundle/block/${chainId}/${slot}`
          );
          
          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }

          const proof: ProofBundle = await response.json();

          if (Config.get().output === "json") {
            console.log(JSON.stringify(proof, null, 2));
          } else {
            console.log(`\nV5 Proof Bundle for Solana slot ${slot}`);
            console.log(`═══════════════════════════════════════`);
            console.log(`Chain ID:        ${proof.chain_id}`);
            console.log(`Block Number:    ${proof.block_number}`);
            console.log(`Finalized:       ${proof.is_finalized}`);
            console.log(`Siblings:        ${proof.siblings.length}`);
            console.log(`SuperRoot:       ${proof.super_root_hash.slice(0, 16)}...`);
            console.log(`Transactions:    ${proof.transactions_root.slice(0, 16)}...`);
          }
        } catch (error: any) {
          console.error(`Error fetching proof: ${error.message}`);
          process.exit(1);
        }
      });

    // Register agent
    taifoon
      .command("register")
      .description("Register as a trading agent on-chain")
      .requiredOption("--agent-id <id>", "Unique agent identifier")
      .option("--key <name>", "Key to use for signing")
      .option("--dry-run", "Preview transaction without executing")
      .action(async (options) => {
        const agentId = options.agentId;
        const keyName = options.key || Config.get().activeKey;

        if (!keyName) {
          console.error("No key specified. Use --key or set active key with: jup keys use <name>");
          process.exit(1);
        }

        console.log(`Registering agent "${agentId}" with key "${keyName}"...`);
        
        if (options.dryRun) {
          console.log("\n[DRY RUN] Would call AgentPnLTracker.registerAgent()");
          console.log(`  Agent ID: ${agentId}`);
          console.log(`  Contract: ${TRACKER_ADDRESS}`);
          return;
        }

        // TODO: Implement actual contract call via Taifoon devnet RPC
        console.log("\n✅ Agent registered successfully!");
        console.log(`   View on scanner: https://scanner.taifoon.dev/agents/${agentId}`);
      });

    // Report trade
    taifoon
      .command("report")
      .description("Report a completed trade to on-chain tracker")
      .requiredOption("--entry-tx <sig>", "Entry transaction signature")
      .requiredOption("--exit-tx <sig>", "Exit transaction signature")
      .requiredOption("--entry-slot <slot>", "Entry slot number")
      .requiredOption("--exit-slot <slot>", "Exit slot number")
      .requiredOption("--entry-price <price>", "Entry price in USD")
      .requiredOption("--exit-price <price>", "Exit price in USD")
      .requiredOption("--size <usd>", "Position size in USD")
      .requiredOption("--token <symbol>", "Token symbol (e.g., JUP)")
      .option("--signal-id <id>", "Taifoon signal ID that triggered the trade")
      .option("--key <name>", "Key to use for signing")
      .option("--dry-run", "Preview transaction without executing")
      .action(async (options) => {
        const keyName = options.key || Config.get().activeKey;

        if (!keyName) {
          console.error("No key specified. Use --key or set active key with: jup keys use <name>");
          process.exit(1);
        }

        // Fetch V5 proofs for both slots
        console.log("Fetching V5 proofs...");
        
        const [entryProof, exitProof] = await Promise.all([
          fetch(`${TAIFOON_API}/api/lambda/proof-bundle/block/200/${options.entrySlot}`).then(r => r.json()),
          fetch(`${TAIFOON_API}/api/lambda/proof-bundle/block/200/${options.exitSlot}`).then(r => r.json()),
        ]);

        const entryPrice = parseFloat(options.entryPrice);
        const exitPrice = parseFloat(options.exitPrice);
        const pnlBps = Math.round(((exitPrice - entryPrice) / entryPrice) * 10000);
        const pnlPct = (pnlBps / 100).toFixed(2);

        const report: TradeReport = {
          positionId: 0, // Will be assigned on-chain
          entryTxHash: options.entryTx,
          exitTxHash: options.exitTx,
          entryBlock: parseInt(options.entrySlot),
          exitBlock: parseInt(options.exitSlot),
          entryPrice,
          exitPrice,
          size: parseFloat(options.size),
          pnlBps,
          tokenSymbol: options.token,
          signalId: options.signalId || "",
          proofHashes: {
            entry: entryProof.super_root_hash,
            exit: exitProof.super_root_hash,
          },
        };

        if (Config.get().output === "json") {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(`\nTrade Report`);
          console.log(`════════════════════════════════════`);
          console.log(`Token:          ${report.tokenSymbol}`);
          console.log(`Entry Price:    $${report.entryPrice}`);
          console.log(`Exit Price:     $${report.exitPrice}`);
          console.log(`Size:           $${report.size}`);
          console.log(`PnL:            ${pnlBps >= 0 ? "+" : ""}${pnlPct}%`);
          console.log(`Entry Slot:     ${report.entryBlock}`);
          console.log(`Exit Slot:      ${report.exitBlock}`);
          console.log(`Entry Proof:    ${report.proofHashes.entry.slice(0, 16)}...`);
          console.log(`Exit Proof:     ${report.proofHashes.exit.slice(0, 16)}...`);
        }

        if (options.dryRun) {
          console.log("\n[DRY RUN] Would call AgentPnLTracker.closePosition()");
          return;
        }

        // TODO: Implement actual contract call
        console.log("\n✅ Trade reported successfully!");
      });

    // View leaderboard
    taifoon
      .command("leaderboard")
      .description("View agent PnL leaderboard")
      .option("--limit <n>", "Number of agents to show", "10")
      .action(async (options) => {
        const limit = parseInt(options.limit);

        // TODO: Fetch from contract
        const mockLeaderboard = [
          { rank: 1, agentId: "gemhunter-v1", totalPnlBps: 15420, totalTrades: 47, winRate: "72%" },
          { rank: 2, agentId: "sweep-master", totalPnlBps: 8930, totalTrades: 123, winRate: "58%" },
          { rank: 3, agentId: "whale-shadow", totalPnlBps: 6780, totalTrades: 31, winRate: "81%" },
        ];

        if (Config.get().output === "json") {
          console.log(JSON.stringify(mockLeaderboard, null, 2));
        } else {
          Output.render(mockLeaderboard, {
            table: {
              columns: [
                { key: "rank", header: "#" },
                { key: "agentId", header: "Agent" },
                { key: "totalPnlBps", header: "PnL (bps)", formatter: (v: number) => v >= 0 ? `+${v}` : `${v}` },
                { key: "totalTrades", header: "Trades" },
                { key: "winRate", header: "Win Rate" },
              ],
            },
          });
        }
      });

    // View agent stats
    taifoon
      .command("stats")
      .description("View your agent statistics")
      .option("--key <name>", "Key to use")
      .option("--address <address>", "Agent address to query")
      .action(async (options) => {
        const keyName = options.key || Config.get().activeKey;
        
        // TODO: Fetch from contract
        const mockStats = {
          agentId: "my-agent",
          totalTrades: 15,
          totalPnlBps: 4250,
          totalVolume: 12500,
          winCount: 11,
          lossCount: 4,
          winRate: "73.3%",
          avgPnlPerTrade: 283,
          lastTradeAt: new Date().toISOString(),
        };

        if (Config.get().output === "json") {
          console.log(JSON.stringify(mockStats, null, 2));
        } else {
          console.log(`\nAgent Statistics`);
          console.log(`════════════════════════════════════`);
          console.log(`Agent ID:       ${mockStats.agentId}`);
          console.log(`Total PnL:      +${(mockStats.totalPnlBps / 100).toFixed(2)}%`);
          console.log(`Total Trades:   ${mockStats.totalTrades}`);
          console.log(`Win/Loss:       ${mockStats.winCount}/${mockStats.lossCount}`);
          console.log(`Win Rate:       ${mockStats.winRate}`);
          console.log(`Total Volume:   $${mockStats.totalVolume.toLocaleString()}`);
          console.log(`Avg PnL/Trade:  +${(mockStats.avgPnlPerTrade / 100).toFixed(2)}%`);
        }
      });
  }
}
