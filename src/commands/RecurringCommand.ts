import type { Base64EncodedBytes } from "@solana/kit";
import type { Command } from "commander";
import type { JupiterApi } from "jupiter-api-ts";

import { resolveToken } from "../lib/Asset.ts";
import { Config } from "../lib/Config.ts";
import { requireJupiterApiKey } from "../lib/JupiterApi.ts";
import { NumberConverter } from "../lib/NumberConverter.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";
import type { SolanaRpc } from "../lib/SolanaRpc.ts";
import { Swap } from "../lib/Swap.ts";

type Submission = {
  order: string | null;
  signature: string | null;
  serializedTransaction?: string;
  simulation?: Awaited<ReturnType<SolanaRpc["simulate"]>>;
};

export class RecurringCommand {
  public static register(
    program: Command,
    rpc: SolanaRpc,
    api: JupiterApi
  ): void {
    this.#rpc = rpc;
    this.#api = api;
    const dca = program.command("dca").description("Time-based DCA orders");
    dca
      .command("create")
      .description("Create a time-based DCA order")
      .requiredOption("--from <token>", "Input token (symbol or mint address)")
      .requiredOption("--to <token>", "Output token (symbol or mint address)")
      .option("--amount <n>", "Total input amount in human-readable units")
      .option("--raw-amount <n>", "Total input amount in on-chain units")
      .requiredOption("--interval <seconds>", "Seconds between orders")
      .requiredOption("--orders <n>", "Total number of orders")
      .option("--min-price <usd>", "Minimum USD price")
      .option("--max-price <usd>", "Maximum USD price")
      .option("--start-at <timestamp>", "UNIX timestamp to start at")
      .option("--key <name>", "Key to use for signing")
      .option("--dry-run", "Preview without submitting the transaction")
      .action((opts) => {
        Config.dryRun = Config.resolveDryRun(opts.dryRun);
        return this.create(opts);
      });
    dca
      .command("cancel")
      .description("Cancel an open DCA order")
      .requiredOption("--order <orderKey>", "Recurring order account")
      .option("--key <name>", "Key to use for signing")
      .option("--dry-run", "Preview without submitting the transaction")
      .action((opts) => {
        Config.dryRun = Config.resolveDryRun(opts.dryRun);
        return this.cancel(opts);
      });
    dca
      .command("list")
      .description("List time-based DCA orders")
      .option("--key <name>", "Key to use (overrides active key)")
      .option("--address <address>", "Wallet address to look up")
      .option("--status <status>", "Order status: active or history", "active")
      .option(
        "--token <token>",
        "Filter by input token (symbol or mint address)"
      )
      .option("--page <n>", "Pagination page number")
      .action((opts) => this.list(opts));
  }

  static #api: JupiterApi;
  static #rpc: SolanaRpc;

  private static async create(opts: {
    from: string;
    to: string;
    amount?: string;
    rawAmount?: string;
    interval: string;
    orders: string;
    minPrice?: string;
    maxPrice?: string;
    startAt?: string;
    key?: string;
  }): Promise<void> {
    requireJupiterApiKey();
    Swap.validateAmountOpts(opts);
    const interval = this.positiveInteger(opts.interval, "--interval");
    const numberOfOrders = this.positiveInteger(opts.orders, "--orders");
    const minPrice = this.optionalNumber(opts.minPrice, "--min-price");
    const maxPrice = this.optionalNumber(opts.maxPrice, "--max-price");
    const startAt = this.optionalInteger(opts.startAt, "--start-at");
    const signer = await Signer.load(opts.key ?? Config.load().activeKey);
    const [inputToken, outputToken] = await resolveToken(this.#api, [
      opts.from,
      opts.to,
    ]);
    const inAmount = Number(
      opts.rawAmount ??
        NumberConverter.toChainAmount(opts.amount!, inputToken!.decimals)
    );
    if (!Number.isSafeInteger(inAmount) || inAmount <= 0) {
      throw new Error(
        "--amount must resolve to a positive safe integer amount."
      );
    }

    const response = await this.#api.recurring.createOrder({
      body: {
        inputMint: inputToken!.id,
        outputMint: outputToken!.id,
        user: signer.address,
        params: {
          time: {
            inAmount,
            interval,
            numberOfOrders,
            ...(minPrice === undefined ? {} : { minPrice }),
            ...(maxPrice === undefined ? {} : { maxPrice }),
            ...(startAt === undefined ? {} : { startAt }),
          },
        },
      },
    });
    if (response.error || !response.data) {
      throw new Error("Unable to build the DCA order.");
    }
    const submission = await this.submit(signer, response.data);
    this.outputSubmission("create", submission);
  }

  private static async cancel(opts: {
    order: string;
    key?: string;
  }): Promise<void> {
    requireJupiterApiKey();
    const signer = await Signer.load(opts.key ?? Config.load().activeKey);
    const response = await this.#api.recurring.cancelOrder({
      body: { order: opts.order, recurringType: "time", user: signer.address },
    });
    if (response.error || !response.data) {
      throw new Error("Unable to build the DCA cancellation.");
    }
    const submission = await this.submit(signer, response.data);
    this.outputSubmission("cancel", submission, opts.order);
  }

  private static async list(opts: {
    key?: string;
    address?: string;
    status: string;
    token?: string;
    page?: string;
  }): Promise<void> {
    requireJupiterApiKey();
    if (opts.address && opts.key) {
      throw new Error("Only one of --address or --key can be provided.");
    }
    if (opts.status !== "active" && opts.status !== "history") {
      throw new Error("--status must be active or history.");
    }
    const page =
      opts.page === undefined
        ? null
        : this.positiveInteger(opts.page, "--page");
    const user =
      opts.address ??
      (await Signer.loadAddress(opts.key ?? Config.load().activeKey));
    const mint = opts.token
      ? (await resolveToken(this.#api, [opts.token]))[0]!.id
      : null;
    const response = await this.#api.recurring.getRecurringV1GetRecurringOrders(
      {
        query: {
          user,
          recurringType: "time",
          orderStatus: opts.status,
          page,
          mint,
          includeFailedTx: false,
        },
      }
    );
    if (response.error || !response.data || !("time" in response.data)) {
      throw new Error("Unable to get DCA orders.");
    }
    const data = response.data;
    const orders = data.time.map((order) => ({
      orderKey: order.orderKey,
      inputMint: order.inputMint,
      outputMint: order.outputMint,
      inAmountPerCycle: order.inAmountPerCycle,
      inDeposited: order.inDeposited,
      inUsed: order.inUsed,
      inWithdrawn: order.inWithdrawn,
      cycleFrequency: order.cycleFrequency,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      userClosed: order.userClosed,
    }));
    if (Output.isJson()) {
      Output.json({
        user: data.user,
        status: data.orderStatus,
        page: data.page,
        totalPages: data.totalPages,
        orders,
      });
      return;
    }
    Output.table({
      type: "horizontal",
      headers: {
        orderKey: "Order",
        inputMint: "Input Mint",
        outputMint: "Output Mint",
        inAmountPerCycle: "Per Cycle",
        inDeposited: "Deposited",
        inUsed: "Used",
        cycleFrequency: "Interval",
        userClosed: "Closed",
      },
      rows: orders,
    });
    if (data.page < data.totalPages) {
      console.log(`\nNext page: ${data.page + 1}`);
    }
  }

  private static async submit(
    signer: Signer,
    build: { requestId: string; transaction: string }
  ): Promise<Submission> {
    if (!build.requestId || !build.transaction) {
      throw new Error("The DCA API did not return a transaction.");
    }
    const signedTransaction = await signer.signTransaction(
      build.transaction as Base64EncodedBytes
    );
    if (Config.dryRun) {
      return {
        order: null,
        signature: null,
        serializedTransaction: signedTransaction,
        simulation: await this.#rpc.simulate(signedTransaction),
      };
    }
    const response = await this.#api.recurring.execute({
      body: { requestId: build.requestId, signedTransaction },
    });
    if (response.error || !response.data) {
      throw new Error("Unable to execute the DCA transaction.");
    }
    if (response.data.status === "Failed") {
      throw new Error(
        response.data.error ?? "DCA transaction execution failed."
      );
    }
    return {
      order: response.data.order ?? null,
      signature: response.data.signature ?? null,
    };
  }

  private static outputSubmission(
    action: string,
    submission: Submission,
    order?: string
  ): void {
    if (Output.isJson()) {
      Output.json({
        ...(Config.dryRun ? { dryRun: true } : {}),
        action,
        order: submission.order ?? order ?? null,
        signature: submission.signature,
        ...(Config.dryRun
          ? {
              serializedTransaction: submission.serializedTransaction,
              simulation: submission.simulation,
            }
          : {}),
      });
      return;
    }
    if (Config.dryRun) {
      console.log(Output.DRY_RUN_LABEL);
    }
    Output.table({
      type: "vertical",
      rows: [
        { label: "Action", value: action },
        ...((submission.order ?? order)
          ? [{ label: "Order", value: submission.order ?? order! }]
          : []),
        ...(!Config.dryRun
          ? [{ label: "Tx Signature", value: submission.signature ?? "" }]
          : [
              {
                label: "Serialized Transaction",
                value: submission.serializedTransaction!,
              },
              {
                label: "Simulation",
                value: submission.simulation!.success ? "Success" : "Failed",
              },
              ...(submission.simulation!.error
                ? [
                    {
                      label: "Simulation Error",
                      value: submission.simulation!.error,
                    },
                  ]
                : []),
            ]),
      ],
    });
  }

  private static positiveInteger(value: string, option: string): number {
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result <= 0) {
      throw new Error(`${option} must be a positive integer.`);
    }
    return result;
  }

  private static optionalInteger(
    value: string | undefined,
    option: string
  ): number | undefined {
    return value === undefined
      ? undefined
      : this.positiveInteger(value, option);
  }

  private static optionalNumber(
    value: string | undefined,
    option: string
  ): number | undefined {
    if (value === undefined) {
      return undefined;
    }
    const result = Number(value);
    if (!Number.isFinite(result) || result < 0) {
      throw new Error(`${option} must be a non-negative number.`);
    }
    return result;
  }
}
