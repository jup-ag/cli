import type { Base64EncodedBytes } from "@solana/kit";
import chalk from "chalk";
import type { Command } from "commander";
import type {
  JupiterApi,
  JupiterApiTypes,
  JupiterDatapi,
} from "jupiter-api-ts";
import { resolveToken } from "../lib/Asset.ts";
import { Config } from "../lib/Config.ts";
import { requireJupiterApiKey } from "../lib/JupiterApi.ts";
import { NumberConverter } from "../lib/NumberConverter.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";
import type { SolanaRpc } from "../lib/SolanaRpc.ts";

type PredictionSubmission = {
  signature: string | null;
  serializedTransaction?: string;
  simulation?: Awaited<ReturnType<SolanaRpc["simulate"]>>;
};

export class PredictionsCommand {
  static #datapi: JupiterDatapi;
  static #api: JupiterApi;
  static #rpc: SolanaRpc;

  public static register(
    program: Command,
    datapi: JupiterDatapi,
    rpc: SolanaRpc,
    api: JupiterApi
  ): void {
    this.#datapi = datapi;
    this.#rpc = rpc;
    this.#api = api;
    const predictions = program
      .command("predictions")
      .description("Prediction markets");
    predictions
      .command("events")
      .description("Browse prediction events")
      .option("--id <eventId>", "Look up a single event by ID")
      .option("--search <query>", "Search events by title")
      .option("--filter <filter>", "Filter: new, live, trending")
      .option(
        "--sort <sort>",
        "Sort by: volume, volume24h, recent",
        "volume24h"
      )
      .option(
        "--category <category>",
        "Category: all, crypto, sports, politics, esports, culture, economics, tech",
        "all"
      )
      .option("--offset <n>", "Pagination offset", "0")
      .option("--limit <n>", "Max results", "10")
      .action((opts) => this.events(opts));
    predictions
      .command("positions")
      .description("View open prediction positions")
      .option("--position <pubkey>", "Look up a single position by pubkey")
      .option("--key <name>", "Key to use (overrides active key)")
      .option("--address <address>", "Wallet address to look up")
      .action((opts) => this.positions(opts));
    predictions
      .command("open")
      .description("Open a prediction position")
      .requiredOption(
        "--market <marketId>",
        "Market ID from predictions events"
      )
      .requiredOption("--side <side>", "Side: yes, no, y, n")
      .requiredOption(
        "--amount <number>",
        "Input token amount (human-readable)"
      )
      .option("--input <token>", "Input token (symbol or mint)", "USDC")
      .option("--key <name>", "Key to use for signing")
      .option("--dry-run", "Preview without submitting the transaction")
      .action((opts) => {
        Config.dryRun = Config.resolveDryRun(opts.dryRun);
        return this.open(opts);
      });
    predictions
      .command("close")
      .description("Close or claim a prediction position")
      .requiredOption(
        "--position <pubkey>",
        "Position pubkey to close, or 'all'"
      )
      .option(
        "--min-sell-price-slippage-bps <bps>",
        "Maximum close-all sell slippage in basis points",
        "200"
      )
      .option("--key <name>", "Key to use for signing")
      .option("--dry-run", "Preview without submitting the transaction")
      .action((opts) => {
        Config.dryRun = Config.resolveDryRun(opts.dryRun);
        return this.close(opts);
      });
    predictions
      .command("history")
      .description("View prediction trading history")
      .option("--key <name>", "Key to use (overrides active key)")
      .option("--address <address>", "Wallet address to look up")
      .option("--limit <n>", "Max results", "10")
      .option("--offset <n>", "Pagination offset", "0")
      .action((opts) => this.history(opts));
  }

  private static async events(opts: {
    id?: string;
    search?: string;
    filter?: string;
    sort: string;
    category: string;
    offset: string;
    limit: string;
  }): Promise<void> {
    requireJupiterApiKey();
    const hasListingOpts =
      opts.filter ||
      opts.sort !== "volume24h" ||
      opts.category !== "all" ||
      opts.offset !== "0";
    if (opts.id && (opts.search || hasListingOpts)) {
      throw new Error(
        "--id cannot be combined with --search, --filter, --sort, --category, or --offset."
      );
    }
    if (opts.search && hasListingOpts) {
      throw new Error(
        "--search cannot be combined with --filter, --sort, --category, or --offset."
      );
    }

    let data: JupiterApiTypes.PredictionEvent[];
    let hasNext = false;
    let nextOffset: number | undefined;

    if (opts.id) {
      const response = await this.#api.prediction.getPredictionV1EventsEventId({
        path: { eventId: opts.id },
        query: { includeMarkets: true },
      });
      if (response.error || !response.data) {
        throw new Error("Unable to get the prediction event.");
      }
      data = [response.data];
    } else if (opts.search) {
      const response = await this.#api.prediction.getPredictionV1EventsSearch({
        query: { query: opts.search, limit: Number(opts.limit) },
      });
      if (response.error || !response.data) {
        throw new Error("Unable to search prediction events.");
      }
      data = response.data.data;
    } else {
      const start = Number(opts.offset);
      const limit = Number(opts.limit);
      const end = start + limit;

      const { sortBy, sortDirection } = this.normalizeEventSort(opts.sort);

      const response = await this.#api.prediction.getPredictionV1Events({
        query: {
          includeMarkets: true,
          filter: this.normalizeEventFilter(opts.filter),
          sortBy,
          sortDirection,
          category: this.normalizeEventCategory(opts.category),
          start,
          end,
        },
      });
      if (response.error || !response.data) {
        throw new Error("Unable to get prediction events.");
      }
      data = response.data.data;
      hasNext = response.data.pagination.hasNext;
      nextOffset = response.data.pagination.end;
    }

    const events = data.map((e) => ({
      eventId: e.eventId,
      title: e.metadata?.title ?? "Unknown event",
      category: e.category ?? "",
      isLive: e.isLive,
      volumeUsd: NumberConverter.fromMicroUsd(e.volumeUsd ?? "0"),
      volume24hUsd: NumberConverter.fromMicroUsd(e.volume24hr ?? "0"),
      startsAt: e.beginAt
        ? new Date(Number(e.beginAt) * 1000).toISOString()
        : null,
      endsAt: e.metadata?.closeTime
        ? new Date(e.metadata.closeTime).toISOString()
        : null,
      markets: (e.markets ?? []).map((m) => ({
        marketId: m.marketId,
        title: m.title ?? "Unknown market",
        status: m.status ?? "",
        rulesPrimary: m.rulesPrimary ?? "",
        rulesSecondary: m.rulesSecondary ?? "",
        yesPriceUsd: m.pricing?.buyYesPriceUsd
          ? NumberConverter.fromMicroUsd(m.pricing.buyYesPriceUsd)
          : null,
        noPriceUsd: m.pricing?.buyNoPriceUsd
          ? NumberConverter.fromMicroUsd(m.pricing.buyNoPriceUsd)
          : null,
        result: m.result,
      })),
    }));

    if (Output.isJson()) {
      const json: Record<string, unknown> = { events };
      if (hasNext) {
        json.next = nextOffset;
      }
      Output.json(json);
      return;
    }

    if (events.length === 0) {
      console.log("No events found.");
      return;
    }

    for (const event of events) {
      const startsAt = event.startsAt ? this.formatDate(event.startsAt) : "???";
      const endsAt = event.endsAt ? this.formatDate(event.endsAt) : "???";
      const dateRange = ` (${startsAt} — ${endsAt})`;
      console.log(chalk.bold(event.title) + chalk.gray(dateRange));
      console.log(`Daily Vol: ${Output.formatDollar(event.volume24hUsd)}`);
      console.log(`Total Vol: ${Output.formatDollar(event.volumeUsd)}`);

      if (event.markets.length > 0) {
        Output.table({
          type: "horizontal",
          headers: {
            title: "Market",
            rules: "Rules",
            yes: "Yes",
            no: "No",
            marketId: "Market ID",
          },
          maxWidths: {
            rules: 60,
          },
          rows: event.markets.map((m) => ({
            title: m.title,
            rules:
              m.rulesPrimary +
              (m.rulesSecondary ? "\n\n" + chalk.gray(m.rulesSecondary) : ""),
            yes: this.formatPricePct(m.yesPriceUsd),
            no: this.formatPricePct(m.noPriceUsd),
            marketId: m.marketId,
          })),
        });
      }

      console.log();
    }

    if (hasNext) {
      console.log("Next offset:", nextOffset);
    }
  }

  private static normalizeEventSort(sort: string): {
    sortBy: "volume" | "beginAt";
    sortDirection?: "asc" | "desc";
  } {
    switch (sort) {
      case "volume":
        return { sortBy: "volume" };
      case "volume24h":
        return { sortBy: "volume" };
      case "recent":
        return { sortBy: "beginAt", sortDirection: "desc" };
      default:
        throw new Error(
          "Invalid --sort. Must be one of: volume, volume24h, recent."
        );
    }
  }

  private static normalizeEventFilter(
    filter?: string
  ): "new" | "live" | "trending" | "upcoming" | undefined {
    if (!filter) {
      return undefined;
    }
    if (["new", "live", "trending", "upcoming"].includes(filter)) {
      return filter as "new" | "live" | "trending" | "upcoming";
    }
    throw new Error(
      "Invalid --filter. Must be new, live, trending, or upcoming."
    );
  }

  private static normalizeEventCategory(
    category: string
  ):
    | "all"
    | "crypto"
    | "sports"
    | "politics"
    | "esports"
    | "culture"
    | "economics"
    | "tech" {
    if (
      [
        "all",
        "crypto",
        "sports",
        "politics",
        "esports",
        "culture",
        "economics",
        "tech",
      ].includes(category)
    ) {
      return category as
        | "all"
        | "crypto"
        | "sports"
        | "politics"
        | "esports"
        | "culture"
        | "economics"
        | "tech";
    }
    throw new Error("Invalid --category.");
  }

  private static normalizeSide(side: string): "yes" | "no" {
    const s = side.toLowerCase();
    if (s === "yes" || s === "y") {
      return "yes";
    }
    if (s === "no" || s === "n") {
      return "no";
    }
    throw new Error("Invalid --side. Must be yes, no, y, or n.");
  }

  private static async positions(opts: {
    position?: string;
    key?: string;
    address?: string;
  }): Promise<void> {
    requireJupiterApiKey();
    if (opts.position && (opts.key || opts.address)) {
      throw new Error("--position cannot be combined with --key or --address.");
    }
    if (opts.address && opts.key) {
      throw new Error("Only one of --address or --key can be provided.");
    }

    let data;
    if (opts.position) {
      const response =
        await this.#api.prediction.getPredictionV1PositionsPositionPubkey({
          path: { positionPubkey: opts.position },
        });
      if (response.error || !response.data) {
        throw new Error("Unable to get the prediction position.");
      }
      data = [response.data];
    } else {
      const address =
        opts.address ??
        (await Signer.loadAddress(opts.key ?? Config.load().activeKey));
      const response = await this.#api.prediction.getPredictionV1Positions({
        query: { ownerPubkey: address },
      });
      if (response.error || !response.data) {
        throw new Error("Unable to get prediction positions.");
      }
      data = response.data.data;
    }

    const positions = data.map((p) => ({
      positionPubkey: p.pubkey,
      event: p.eventMetadata.title ?? "Unknown event",
      market: p.marketMetadata.title ?? "Unknown market",
      side: p.isYes ? "yes" : "no",
      contracts: Number(p.contracts),
      costUsd: NumberConverter.fromMicroUsd(p.totalCostUsd),
      valueUsd: NumberConverter.fromMicroUsd(p.valueUsd ?? "0"),
      pnlUsd: NumberConverter.fromMicroUsd(p.pnlUsd ?? "0"),
      pnlPct: p.pnlUsdPercent,
      startsAt: p.marketMetadata.openTime
        ? new Date(p.marketMetadata.openTime * 1000).toISOString()
        : "",
      endsAt: p.marketMetadata.closeTime
        ? new Date(p.marketMetadata.closeTime * 1000).toISOString()
        : "",
      claimable: this.isClaimable(p),
    }));

    if (Output.isJson()) {
      Output.json({ count: positions.length, positions });
      return;
    }

    if (positions.length === 0) {
      console.log("No open positions.");
      return;
    }

    Output.table({
      type: "horizontal",
      headers: {
        event: "Event",
        market: "Market",
        dates: "Starts / Ends",
        side: "Side",
        costUsd: "Cost",
        valueUsd: "Value",
        pnl: "PnL",
        claimable: "Claimable",
        positionPubkey: "Position",
      },
      maxWidths: {
        event: 36,
      },
      rows: positions.map((p) => {
        const sideColor = p.side === "yes" ? chalk.green : chalk.red;
        return {
          event: p.event,
          market: p.market,
          dates: this.formatDate(p.startsAt) + "\n" + this.formatDate(p.endsAt),
          side: sideColor(p.side),
          costUsd: Output.formatDollar(p.costUsd),
          valueUsd: Output.formatDollar(p.valueUsd),
          pnl: `${Output.formatDollarChange(p.pnlUsd)} (${Output.formatPercentageChange(p.pnlPct ?? undefined)})`,
          claimable: Output.formatBoolean(p.claimable),
          positionPubkey: p.positionPubkey,
        };
      }),
    });
  }

  private static async open(opts: {
    market: string;
    side: string;
    amount: string;
    input: string;
    key?: string;
  }): Promise<void> {
    requireJupiterApiKey();
    const side = this.normalizeSide(opts.side);
    const isYes = side === "yes";
    const signer = await Signer.load(opts.key ?? Config.load().activeKey);
    const token = await resolveToken(this.#datapi, opts.input);
    const depositAmount = NumberConverter.toChainAmount(
      opts.amount,
      token.decimals
    );

    const response = await this.#api.prediction.postPredictionV1Orders({
      body: {
        isBuy: true,
        ownerPubkey: signer.address,
        marketId: opts.market,
        isYes,
        depositAmount,
        depositMint: token.id,
      },
    });
    if (response.error || !response.data) {
      throw new Error("Unable to build the prediction order.");
    }
    const res = response.data;

    const result = await this.signAndExecute(signer, res);

    const { order } = res;
    const contracts = Number(order.contracts);
    const costUsd = NumberConverter.fromMicroUsd(order.orderCostUsd);
    const feeUsd = NumberConverter.fromMicroUsd(order.estimatedTotalFeeUsd);
    const positionAvgPriceUsd = NumberConverter.fromMicroUsd(
      order.newAvgPriceUsd
    );
    const positionPayoutUsd = NumberConverter.fromMicroUsd(order.newPayoutUsd);

    if (Output.isJson()) {
      Output.json({
        ...(Config.dryRun && { dryRun: true }),
        action: "open",
        marketId: opts.market,
        side,
        contracts,
        costUsd,
        feeUsd,
        positionAvgPriceUsd,
        positionPayoutUsd,
        positionPubkey: order.positionPubkey,
        signature: result.signature,
        ...(Config.dryRun && {
          serializedTransaction: result.serializedTransaction,
          simulation: result.simulation,
        }),
      });
      return;
    }

    if (Config.dryRun) {
      console.log(Output.DRY_RUN_LABEL);
    }
    Output.table({
      type: "vertical",
      rows: [
        { label: "Action", value: "Open Position" },
        { label: "Market", value: opts.market },
        { label: "Side", value: side },
        { label: "Cost", value: Output.formatDollar(costUsd) },
        { label: "Fee", value: Output.formatDollar(feeUsd) },
        {
          label: "Position Avg Price",
          value: Output.formatDollar(positionAvgPriceUsd),
        },
        {
          label: "Position Payout",
          value: Output.formatDollar(positionPayoutUsd),
        },
        { label: "Position", value: order.positionPubkey },
        ...(!Config.dryRun
          ? [{ label: "Tx Signature", value: result.signature! }]
          : [
              {
                label: "Serialized Transaction",
                value: result.serializedTransaction!,
              },
              {
                label: "Simulation",
                value: result.simulation!.success ? "Success" : "Failed",
              },
              ...(result.simulation!.error
                ? [
                    {
                      label: "Simulation Error",
                      value: result.simulation!.error,
                    },
                  ]
                : []),
            ]),
      ],
    });
  }

  private static async history(opts: {
    key?: string;
    address?: string;
    limit: string;
    offset: string;
  }): Promise<void> {
    requireJupiterApiKey();
    if (opts.address && opts.key) {
      throw new Error("Only one of --address or --key can be provided.");
    }

    const start = Number(opts.offset);
    const limit = Number(opts.limit);
    const end = start + limit;

    const address =
      opts.address ??
      (await Signer.loadAddress(opts.key ?? Config.load().activeKey));

    const response = await this.#api.prediction.getPredictionV1History({
      query: { ownerPubkey: address, start, end },
    });
    if (response.error || !response.data) {
      throw new Error("Unable to get prediction history.");
    }
    const res = response.data;

    const history = res.data.map((h) => ({
      time: new Date(h.timestamp * 1000).toISOString(),
      event: h.eventMetadata.title,
      market: h.marketMetadata.title,
      type: h.eventType,
      side: h.isYes ? "yes" : "no",
      action: h.isBuy ? "buy" : "sell",
      contracts: Number(h.filledContracts),
      avgPriceUsd: NumberConverter.fromMicroUsd(h.avgFillPriceUsd),
      pnlUsd: h.realizedPnl
        ? NumberConverter.fromMicroUsd(h.realizedPnl)
        : null,
      payoutUsd: NumberConverter.fromMicroUsd(h.payoutAmountUsd),
      positionPubkey: h.positionPubkey,
      signature: h.signature,
    }));

    if (Output.isJson()) {
      const json: Record<string, unknown> = { count: history.length, history };
      if (res.pagination.hasNext) {
        json.next = res.pagination.end;
      }
      Output.json(json);
      return;
    }

    if (history.length === 0) {
      console.log("No history found.");
      return;
    }

    Output.table({
      type: "horizontal",
      headers: {
        time: "Time",
        event: "Event / Market",
        side: "Side",
        action: "Action",
        avgPrice: "Avg Price",
        pnl: "PnL",
        signature: "Tx Signature",
      },
      rows: history.map((h) => {
        const sideColor = h.side === "yes" ? chalk.green : chalk.red;
        return {
          time: this.formatDate(h.time),
          event: h.event + chalk.gray("\n└─► ") + h.market,
          side: sideColor(h.side),
          action: h.action,
          avgPrice: Output.formatDollar(h.avgPriceUsd),
          pnl: h.pnlUsd
            ? Output.formatDollarChange(h.pnlUsd)
            : chalk.gray("\u2014"),
          signature: h.signature,
        };
      }),
    });

    if (res.pagination.hasNext) {
      console.log("\nNext offset:", res.pagination.end);
    }
  }

  private static isClaimable(p: {
    claimed: boolean;
    isYes: boolean;
    marketMetadata: { result?: string | null };
  }): boolean {
    return (
      !p.claimed &&
      p.marketMetadata.result !== null &&
      p.marketMetadata.result === (p.isYes ? "yes" : "no")
    );
  }

  private static async signAndExecute(
    signer: Signer,
    build:
      | JupiterApiTypes.PredictionCreateOrderResponse
      | JupiterApiTypes.PredictionClaimPositionResponse
  ): Promise<PredictionSubmission> {
    if (!build.transaction) {
      throw new Error("The prediction API did not return a transaction.");
    }
    const signedTx = await signer.signTransaction(
      build.transaction as Base64EncodedBytes
    );
    if (Config.dryRun) {
      return {
        signature: null,
        serializedTransaction: signedTx,
        simulation: await this.#rpc.simulate(signedTx),
      };
    }
    const response = await this.#api.prediction.postPredictionV1Execute({
      body: {
        signedTransaction: signedTx,
        ...("execution" in build && build.execution
          ? { context: build.execution.context }
          : {}),
      },
    });
    if (response.error || !response.data) {
      throw new Error("Unable to execute the prediction transaction.");
    }
    if (response.data.status === "Failed") {
      throw new Error(
        response.data.error ?? "Prediction transaction execution failed."
      );
    }
    return { signature: response.data.signature ?? null };
  }

  private static async close(opts: {
    position: string;
    minSellPriceSlippageBps: string;
    key?: string;
  }): Promise<void> {
    requireJupiterApiKey();
    const minSellPriceSlippageBps = Number(opts.minSellPriceSlippageBps);
    if (
      !Number.isInteger(minSellPriceSlippageBps) ||
      minSellPriceSlippageBps < 0
    ) {
      throw new Error(
        "--min-sell-price-slippage-bps must be a non-negative integer."
      );
    }
    const signer = await Signer.load(opts.key ?? Config.load().activeKey);

    if (opts.position === "all") {
      const response = await this.#api.prediction.deletePredictionV1Positions({
        body: {
          ownerPubkey: signer.address,
          minSellPriceSlippageBps,
        },
      });
      if (response.error || !response.data) {
        throw new Error("Unable to build prediction close transactions.");
      }
      const res = response.data;

      if (res.data.length === 0) {
        throw new Error("No open positions to close.");
      }

      const results: {
        action: string;
        positionPubkey: string;
        signature: string | null;
        serializedTransaction?: string;
        simulation?: Awaited<ReturnType<SolanaRpc["simulate"]>>;
      }[] = [];

      for (const item of res.data) {
        const execResult = await this.signAndExecute(signer, item);
        const isClaim = "position" in item;
        const pubkey = isClaim
          ? item.position.positionPubkey
          : item.order.positionPubkey;
        results.push({
          action: isClaim ? "claim" : "close",
          positionPubkey: pubkey,
          signature: execResult.signature,
          ...(Config.dryRun
            ? {
                serializedTransaction: execResult.serializedTransaction,
                simulation: execResult.simulation,
              }
            : {}),
        });
      }

      if (Output.isJson()) {
        Output.json({
          ...(Config.dryRun && { dryRun: true }),
          action: "close-all",
          results,
        });
        return;
      }

      if (Config.dryRun) {
        console.log(Output.DRY_RUN_LABEL);
        Output.table({
          type: "horizontal",
          headers: {
            action: "Action",
            positionPubkey: "Position",
            serializedTransaction: "Serialized Transaction",
            simulation: "Simulation",
          },
          rows: results.map((r) => ({
            action: r.action,
            positionPubkey: r.positionPubkey,
            serializedTransaction: r.serializedTransaction!,
            simulation: r.simulation!.success ? "Success" : "Failed",
          })),
        });
        return;
      }

      Output.table({
        type: "horizontal",
        headers: {
          action: "Action",
          positionPubkey: "Position",
          signature: "Tx Signature",
        },
        rows: results,
      });
      return;
    }

    // Single position
    const positionResponse =
      await this.#api.prediction.getPredictionV1PositionsPositionPubkey({
        path: { positionPubkey: opts.position },
      });
    if (positionResponse.error || !positionResponse.data) {
      throw new Error("Unable to get the prediction position.");
    }
    const position = positionResponse.data;
    const claimable = this.isClaimable(position);

    if (claimable) {
      const response =
        await this.#api.prediction.postPredictionV1PositionsPositionPubkeyClaim(
          {
            path: { positionPubkey: opts.position },
            body: { ownerPubkey: signer.address },
          }
        );
      if (response.error || !response.data) {
        throw new Error("Unable to build the prediction claim transaction.");
      }
      const res = response.data;
      const result = await this.signAndExecute(signer, res);

      const contracts = Number(res.position.contracts);
      const payoutUsd = NumberConverter.fromMicroUsd(
        res.position.payoutAmountUsd
      );

      if (Output.isJson()) {
        Output.json({
          ...(Config.dryRun && { dryRun: true }),
          action: "claim",
          event: position.eventMetadata.title ?? "Unknown event",
          market: position.marketMetadata.title ?? "Unknown market",
          side: position.isYes ? "yes" : "no",
          positionPubkey: opts.position,
          contracts,
          payoutUsd,
          signature: result.signature,
          ...(Config.dryRun && {
            serializedTransaction: result.serializedTransaction,
            simulation: result.simulation,
          }),
        });
        return;
      }

      if (Config.dryRun) {
        console.log(Output.DRY_RUN_LABEL);
      }
      Output.table({
        type: "vertical",
        rows: [
          { label: "Action", value: "Claim Position" },
          {
            label: "Event",
            value: position.eventMetadata.title ?? "Unknown event",
          },
          {
            label: "Market",
            value: position.marketMetadata.title ?? "Unknown market",
          },
          {
            label: "Side",
            value: position.isYes ? chalk.green("yes") : chalk.red("no"),
          },
          { label: "Payout", value: Output.formatDollar(payoutUsd) },
          { label: "Position", value: opts.position },
          ...(!Config.dryRun
            ? [{ label: "Tx Signature", value: result.signature! }]
            : [
                {
                  label: "Serialized Transaction",
                  value: result.serializedTransaction!,
                },
                {
                  label: "Simulation",
                  value: result.simulation!.success ? "Success" : "Failed",
                },
                ...(result.simulation!.error
                  ? [
                      {
                        label: "Simulation Error",
                        value: result.simulation!.error,
                      },
                    ]
                  : []),
              ]),
        ],
      });
    } else {
      const response =
        await this.#api.prediction.deletePredictionV1PositionsPositionPubkey({
          path: { positionPubkey: opts.position },
          body: { ownerPubkey: signer.address },
        });
      if (response.error || !response.data) {
        throw new Error("Unable to build the prediction close transaction.");
      }
      const res = response.data;
      const result = await this.signAndExecute(signer, res);

      const { order } = res;
      const contracts = Number(order.contracts);
      const costUsd = NumberConverter.fromMicroUsd(order.orderCostUsd);
      const feeUsd = NumberConverter.fromMicroUsd(order.estimatedTotalFeeUsd);

      if (Output.isJson()) {
        Output.json({
          ...(Config.dryRun && { dryRun: true }),
          action: "close",
          event: position.eventMetadata.title ?? "Unknown event",
          market: position.marketMetadata.title ?? "Unknown market",
          side: position.isYes ? "yes" : "no",
          positionPubkey: opts.position,
          contracts,
          costUsd,
          feeUsd,
          signature: result.signature,
          ...(Config.dryRun && {
            serializedTransaction: result.serializedTransaction,
            simulation: result.simulation,
          }),
        });
        return;
      }

      if (Config.dryRun) {
        console.log(Output.DRY_RUN_LABEL);
      }
      Output.table({
        type: "vertical",
        rows: [
          { label: "Action", value: "Close Position" },
          {
            label: "Event",
            value: position.eventMetadata.title ?? "Unknown event",
          },
          {
            label: "Market",
            value: position.marketMetadata.title ?? "Unknown market",
          },
          {
            label: "Side",
            value: position.isYes ? chalk.green("yes") : chalk.red("no"),
          },
          { label: "Cost", value: Output.formatDollar(costUsd) },
          { label: "Fee", value: Output.formatDollar(feeUsd) },
          { label: "Position", value: opts.position },
          ...(!Config.dryRun
            ? [{ label: "Tx Signature", value: result.signature! }]
            : [
                {
                  label: "Serialized Transaction",
                  value: result.serializedTransaction!,
                },
                {
                  label: "Simulation",
                  value: result.simulation!.success ? "Success" : "Failed",
                },
                ...(result.simulation!.error
                  ? [
                      {
                        label: "Simulation Error",
                        value: result.simulation!.error,
                      },
                    ]
                  : []),
              ]),
        ],
      });
    }
  }

  private static formatPricePct(price: number | null): string {
    if (price === null || price === undefined) {
      return chalk.gray("\u2014");
    }
    return `${Math.round(price * 100)}%`;
  }

  private static formatDate(iso: string): string {
    const date = new Date(iso);
    return isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
  }
}
