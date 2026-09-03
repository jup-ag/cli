import type { Base64EncodedBytes } from "@solana/kit";
import type { Command } from "commander";
import type { JupiterPerpsApi } from "jupiter-api-ts";

import { Asset } from "../lib/Asset.ts";
import { Config } from "../lib/Config.ts";
import { NumberConverter } from "../lib/NumberConverter.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";
import type { SolanaRpc } from "../lib/SolanaRpc.ts";
import { Swap } from "../lib/Swap.ts";

const JLP_DECIMALS = 6;

type PoolToken = "SOL" | "WBTC" | "ETH" | "USDC";
type Submission = {
  signature?: string;
  serializedTransaction?: string;
  simulation?: Awaited<ReturnType<SolanaRpc["simulate"]>>;
};

export class JlpCommand {
  static #perps: JupiterPerpsApi;
  static #rpc: SolanaRpc;

  public static register(
    program: Command,
    perpsApi: JupiterPerpsApi,
    rpc: SolanaRpc
  ): void {
    this.#perps = perpsApi;
    this.#rpc = rpc;
    const jlp = program
      .command("jlp")
      .description("Jupiter Liquidity Provider token operations");
    jlp
      .command("info")
      .description("Show JLP pool statistics and custody weights")
      .action(() => this.info());
    jlp
      .command("mint")
      .description("Deposit a pool token to mint JLP")
      .requiredOption("--token <token>", "Deposit token (SOL, WBTC, ETH, USDC)")
      .option("--amount <n>", "Amount in human-readable units")
      .option("--raw-amount <n>", "Amount in on-chain units")
      .option("--key <name>", "Key to use for signing")
      .option("--dry-run", "Preview without submitting the transaction")
      .action((opts) => {
        Config.dryRun = Config.resolveDryRun(opts.dryRun);
        return this.mint(opts);
      });
    jlp
      .command("burn")
      .description("Burn JLP to receive a pool token")
      .option("--amount <n>", "Amount in human-readable units")
      .option("--raw-amount <n>", "Amount in on-chain units")
      .requiredOption(
        "--receive <token>",
        "Token to receive (SOL, WBTC, ETH, USDC)"
      )
      .option("--key <name>", "Key to use for signing")
      .option("--dry-run", "Preview without submitting the transaction")
      .action((opts) => {
        Config.dryRun = Config.resolveDryRun(opts.dryRun);
        return this.burn(opts);
      });
  }

  private static async info(): Promise<void> {
    const response = await this.#perps.getJlpInfo();
    if (response.error || !response.data) {
      throw new Error("Unable to get JLP pool information.");
    }
    const info = response.data;

    if (Output.isJson()) {
      Output.json(info);
      return;
    }

    Output.table({
      type: "vertical",
      rows: [
        { label: "AUM", value: info.aumUsdFormatted },
        { label: "AUM Limit", value: info.aumLimitUsdFormatted },
        { label: "JLP Price", value: info.jlpPriceUsdFormatted },
        { label: "JLP Supply", value: info.jlpTotalSupplyFormatted },
        { label: "APR", value: `${info.jlpAprPct}%` },
        { label: "APY", value: `${info.jlpApyPct}%` },
      ],
    });
    Output.table({
      type: "horizontal",
      headers: {
        symbol: "Token",
        aum: "AUM",
        amount: "Pool Amount",
        currentWeight: "Current Weight",
        targetWeight: "Target Weight",
        utilization: "Utilization",
      },
      rows: info.custodies.map((custody) => ({
        symbol: custody.symbol,
        aum: custody.aumUsdFormatted,
        amount: custody.aumTokenAmountFormatted,
        currentWeight: `${custody.currentWeightagePct}%`,
        targetWeight: `${custody.targetWeightagePct}%`,
        utilization: `${custody.utilizationPct}%`,
      })),
    });
  }

  private static async mint(opts: {
    token: string;
    amount?: string;
    rawAmount?: string;
    key?: string;
  }): Promise<void> {
    Swap.validateAmountOpts(opts);
    const token = this.poolToken(opts.token, "--token");
    const signer = await Signer.load(opts.key ?? Config.load().activeKey);
    const depositTokenAmount = this.amount(
      opts.amount,
      opts.rawAmount,
      this.asset(token).decimals
    );
    const response = await this.#perps.postJlpMint({
      body: {
        depositToken: token,
        depositTokenAmount,
        walletAddress: signer.address,
      },
    });
    if (response.error || !response.data?.serializedTxBase64) {
      throw new Error("Unable to build the JLP mint transaction.");
    }
    const submission = await this.submit(
      signer,
      response.data.serializedTxBase64
    );
    const depositedAmount = NumberConverter.fromChainAmount(
      depositTokenAmount,
      this.asset(token).decimals
    );
    const mintedAmount = NumberConverter.fromChainAmount(
      response.data.mintTokenAmount,
      JLP_DECIMALS
    );
    this.outputSubmission({
      action: "mint",
      deposited: `${depositedAmount} ${token}`,
      received: `${mintedAmount} JLP`,
      fee: `${response.data.mintFeePercent}%`,
      submission,
    });
  }

  private static async burn(opts: {
    receive: string;
    amount?: string;
    rawAmount?: string;
    key?: string;
  }): Promise<void> {
    Swap.validateAmountOpts(opts);
    const receive = this.poolToken(opts.receive, "--receive");
    const signer = await Signer.load(opts.key ?? Config.load().activeKey);
    const burnTokenAmount = this.amount(
      opts.amount,
      opts.rawAmount,
      JLP_DECIMALS
    );
    const response = await this.#perps.postJlpBurn({
      body: {
        burnTokenAmount,
        receiveToken: receive,
        walletAddress: signer.address,
      },
    });
    if (response.error || !response.data?.serializedTxBase64) {
      throw new Error("Unable to build the JLP burn transaction.");
    }
    const submission = await this.submit(
      signer,
      response.data.serializedTxBase64
    );
    const burnedAmount = NumberConverter.fromChainAmount(
      burnTokenAmount,
      JLP_DECIMALS
    );
    const receivedAmount = NumberConverter.fromChainAmount(
      response.data.receiveTokenAmount,
      this.asset(receive).decimals
    );
    this.outputSubmission({
      action: "burn",
      deposited: `${burnedAmount} JLP`,
      received: `${receivedAmount} ${receive}`,
      fee: `${response.data.burnFeePercent}%`,
      submission,
    });
  }

  private static async submit(
    signer: Signer,
    transaction: string
  ): Promise<Submission> {
    const serializedTransaction = await signer.signTransaction(
      transaction as Base64EncodedBytes
    );
    if (Config.dryRun) {
      return {
        serializedTransaction,
        simulation: await this.#rpc.simulate(serializedTransaction),
      };
    }
    return { signature: await this.#rpc.send(serializedTransaction) };
  }

  private static outputSubmission(opts: {
    action: "mint" | "burn";
    deposited: string;
    received: string;
    fee: string;
    submission: Submission;
  }): void {
    if (Output.isJson()) {
      Output.json({
        ...(Config.dryRun ? { dryRun: true } : {}),
        action: opts.action,
        deposited: opts.deposited,
        received: opts.received,
        fee: opts.fee,
        ...opts.submission,
      });
      return;
    }
    if (Config.dryRun) {
      console.log(Output.DRY_RUN_LABEL);
    }
    Output.table({
      type: "vertical",
      rows: [
        { label: "Action", value: opts.action },
        { label: "Deposited", value: opts.deposited },
        { label: "Received", value: opts.received },
        { label: "Fee", value: opts.fee },
        ...(!Config.dryRun
          ? [{ label: "Tx Signature", value: opts.submission.signature! }]
          : [
              {
                label: "Serialized Transaction",
                value: opts.submission.serializedTransaction!,
              },
              {
                label: "Simulation",
                value: opts.submission.simulation!.success
                  ? "Success"
                  : "Failed",
              },
              ...(opts.submission.simulation!.error
                ? [
                    {
                      label: "Simulation Error",
                      value: opts.submission.simulation!.error,
                    },
                  ]
                : []),
            ]),
      ],
    });
  }

  private static amount(
    amount: string | undefined,
    rawAmount: string | undefined,
    decimals: number
  ): string {
    const resolved =
      rawAmount ?? NumberConverter.toChainAmount(amount!, decimals);
    if (!/^[1-9]\d*$/.test(resolved)) {
      throw new Error("--amount must resolve to a positive integer amount.");
    }
    return resolved;
  }

  private static poolToken(value: string, option: string): PoolToken {
    const token = value.toUpperCase();
    if (
      token === "SOL" ||
      token === "WBTC" ||
      token === "ETH" ||
      token === "USDC"
    ) {
      return token;
    }
    throw new Error(`Invalid ${option}. Must be SOL, WBTC, ETH, or USDC.`);
  }

  private static asset(token: PoolToken) {
    return token === "WBTC" ? Asset.BTC : Asset[token];
  }
}
