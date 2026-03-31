import type { Base64EncodedBytes } from "@solana/kit";
import chalk from "chalk";
import type { Command } from "commander";

import {
  PredictionsClient,
  type ClaimPositionResponse,
  type CreateOrderResponse,
  type PredictionEvent,
} from "../clients/PredictionsClient.ts";
import { resolveWalletAsset } from "../lib/Asset.ts";
import { Config } from "../lib/Config.ts";
import { NumberConverter } from "../lib/NumberConverter.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";

export class PredictionsCommand {
  public static register(program: Command): void {
    const predictions = program
      .command("predictions")
      .description("Prediction markets");
    predictions
      .command("events")
      .description("Browse prediction events")
      .option("--id <eventId>", "Look up a single event by ID")
      .option("--search <query>", "Search events by title")
      .option("--filter <filter>", "Filter: new, live, trending")
      .option("--sort <sort>", "Sort by: volume, recent", "volume")
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
      .action((opts) => this.open(opts));
    predictions
      .command("close")
      .description("Close or claim a prediction position")
      .requiredOption(
        "--position <pubkey>",
        "Position pubkey to close, or 'all'"
      )
      .option("--key <name>", "Key to use for signing")
      .action((opts) => this.close(opts));
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
    const hasListingOpts =
      opts.filter ||
      opts.sort !== "volume" ||
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

    let data: PredictionEvent[];
    let hasNext = false;
    let nextOffset: number | undefined;

    if (opts.id) {
      const event = await PredictionsClient.getEvent(opts.id);
      data = [event];
    } else if (opts.search) {
      const start = Number(opts.offset);
      const end = start + Number(opts.limit);
      const res = await PredictionsClient.searchEvents({
        query: opts.search,
        start,
        end,
      });
      data = res.data;
    } else {
      const start = Number(opts.offset);
      const limit = Number(opts.limit);
      const end = start + limit;

      const sortBy = opts.sort === "recent" ? "beginAt" : "volume24hr";
      const sortDirection = opts.sort === "recent" ? "desc" : undefined;

      const res = await PredictionsClient.getEvents({
        filter: opts.filter,
        sortBy,
        sortDirection,
        category: opts.category,
        start,
        end,
      });
      data = res.data;
      hasNext = res.pagination.hasNext;
      nextOffset = res.pagination.end;
    }

    const events = data.map((e) => ({
      eventId: e.eventId,
      title: e.metadata.title,
      category: e.category,
      isLive: e.isLive,
      volumeUsd: NumberConverter.fromMicroUsd(e.volumeUsd),
      startsAt: e.beginAt
        ? new Date(Number(e.beginAt) * 1000).toISOString()
        : null,
      endsAt: e.metadata.closeTime
        ? new Date(e.metadata.closeTime).toISOString()
        : null,
      markets: (e.markets ?? []).map((m) => ({
        marketId: m.marketId,
        title: m.metadata.title,
        status: m.status,
        yesPriceUsd: m.pricing.buyYesPriceUsd
          ? NumberConverter.fromMicroUsd(m.pricing.buyYesPriceUsd)
          : null,
        noPriceUsd: m.pricing.buyNoPriceUsd
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
      console.log(`Vol: ${Output.formatDollar(event.volumeUsd)}`);

      if (event.markets.length > 0) {
        Output.table({
          type: "horizontal",
          headers: {
            title: "Market",
            yes: "Yes",
            no: "No",
            marketId: "Market ID",
          },
          rows: event.markets.map((m) => ({
            title: m.title,
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
    if (opts.position && (opts.key || opts.address)) {
      throw new Error("--position cannot be combined with --key or --address.");
    }
    if (opts.address && opts.key) {
      throw new Error("Only one of --address or --key can be provided.");
    }

    let data;
    if (opts.position) {
      const p = await PredictionsClient.getPosition(opts.position);
      data = [p];
    } else {
      const address =
        opts.address ??
        await Signer.loadAddress(opts.key ?? Config.load().activeKey);
      const res = await PredictionsClient.getPositions(address);
      data = res.data;
    }

    const positions = data.map((p) => ({
      positionPubkey: p.pubkey,
      event: p.eventMetadata.title,
      market: p.marketMetadata.title,
      side: p.isYes ? "yes" : "no",
      contracts: Number(p.contracts),
      costUsd: NumberConverter.fromMicroUsd(p.totalCostUsd),
      valueUsd: NumberConverter.fromMicroUsd(p.valueUsd),
      pnlUsd: NumberConverter.fromMicroUsd(p.pnlUsd),
      pnlPct: p.pnlUsdPercent,
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
        side: "Side",
        costUsd: "Cost",
        valueUsd: "Value",
        pnl: "PnL",
        claimable: "Claimable",
        positionPubkey: "Position",
      },
      rows: positions.map((p) => {
        const sideColor = p.side === "yes" ? chalk.green : chalk.red;
        return {
          event: p.event,
          market: p.market,
          side: sideColor(p.side),
          costUsd: Output.formatDollar(p.costUsd),
          valueUsd: Output.formatDollar(p.valueUsd),
          pnl: `${Output.formatDollarChange(p.pnlUsd)} (${Output.formatPercentageChange(p.pnlPct)})`,
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
    const side = this.normalizeSide(opts.side);
    const isYes = side === "yes";
    const signer = await Signer.load(opts.key ?? Config.load().activeKey);
    const token = await resolveWalletAsset(signer.address, opts.input);
    const depositAmount = NumberConverter.toChainAmount(
      opts.amount,
      token.decimals
    );

    const res = await PredictionsClient.postOrder({
      isBuy: true,
      ownerPubkey: signer.address,
      marketId: opts.market,
      isYes,
      depositAmount,
      depositMint: token.id,
    });

    const result = await this.signAndExecute(signer, res.transaction);

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
        ...(Config.dryRun && { transaction: res.transaction }),
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
          : []),
      ],
    });
  }

  private static async history(opts: {
    key?: string;
    address?: string;
    limit: string;
    offset: string;
  }): Promise<void> {
    if (opts.address && opts.key) {
      throw new Error("Only one of --address or --key can be provided.");
    }

    const start = Number(opts.offset);
    const limit = Number(opts.limit);
    const end = start + limit;

    const address =
      opts.address ??
      await Signer.loadAddress(opts.key ?? Config.load().activeKey);

    const res = await PredictionsClient.getHistory({
      ownerPubkey: address,
      start,
      end,
    });

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
    marketMetadata: { result: "yes" | "no" | null };
  }): boolean {
    return (
      !p.claimed &&
      p.marketMetadata.result !== null &&
      p.marketMetadata.result === (p.isYes ? "yes" : "no")
    );
  }

  private static async signAndExecute(
    signer: Signer,
    transaction: string
  ): Promise<{ signature: string | null }> {
    if (Config.dryRun) {
      return { signature: null };
    }
    const signedTx = await signer.signTransaction(
      transaction as Base64EncodedBytes
    );
    return PredictionsClient.postExecute({ signedTransaction: signedTx });
  }

  private static async close(opts: {
    position: string;
    key?: string;
  }): Promise<void> {
    const signer = await Signer.load(opts.key ?? Config.load().activeKey);

    if (opts.position === "all") {
      const res = await PredictionsClient.closeAllPositions(signer.address);

      if (res.data.length === 0) {
        throw new Error("No open positions to close.");
      }

      const results: {
        action: string;
        positionPubkey: string;
        signature: string | null;
        transaction?: string;
      }[] = [];

      for (const item of res.data) {
        const execResult = await this.signAndExecute(signer, item.transaction);
        const isClaim = "position" in item;
        const pubkey = isClaim
          ? (item as ClaimPositionResponse).position.positionPubkey
          : (item as CreateOrderResponse).order.positionPubkey;
        results.push({
          action: isClaim ? "claim" : "close",
          positionPubkey: pubkey,
          signature: execResult.signature,
          ...(Config.dryRun && { transaction: item.transaction }),
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
          },
          rows: results.map((r) => ({
            action: r.action,
            positionPubkey: r.positionPubkey,
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
    const position = await PredictionsClient.getPosition(opts.position);
    const claimable = this.isClaimable(position);

    if (claimable) {
      const res = await PredictionsClient.claimPosition(
        opts.position,
        signer.address
      );
      const result = await this.signAndExecute(signer, res.transaction);

      const contracts = Number(res.position.contracts);
      const payoutUsd = NumberConverter.fromMicroUsd(
        res.position.payoutAmountUsd
      );

      if (Output.isJson()) {
        Output.json({
          ...(Config.dryRun && { dryRun: true }),
          action: "claim",
          event: position.eventMetadata.title,
          market: position.marketMetadata.title,
          side: position.isYes ? "yes" : "no",
          positionPubkey: opts.position,
          contracts,
          payoutUsd,
          signature: result.signature,
          ...(Config.dryRun && { transaction: res.transaction }),
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
          { label: "Event", value: position.eventMetadata.title },
          { label: "Market", value: position.marketMetadata.title },
          {
            label: "Side",
            value: position.isYes ? chalk.green("yes") : chalk.red("no"),
          },
          { label: "Payout", value: Output.formatDollar(payoutUsd) },
          { label: "Position", value: opts.position },
          ...(!Config.dryRun
            ? [{ label: "Tx Signature", value: result.signature! }]
            : []),
        ],
      });
    } else {
      const res = await PredictionsClient.closePosition(
        opts.position,
        signer.address
      );
      const result = await this.signAndExecute(signer, res.transaction);

      const { order } = res;
      const contracts = Number(order.contracts);
      const costUsd = NumberConverter.fromMicroUsd(order.orderCostUsd);
      const feeUsd = NumberConverter.fromMicroUsd(order.estimatedTotalFeeUsd);

      if (Output.isJson()) {
        Output.json({
          ...(Config.dryRun && { dryRun: true }),
          action: "close",
          event: position.eventMetadata.title,
          market: position.marketMetadata.title,
          side: position.isYes ? "yes" : "no",
          positionPubkey: opts.position,
          contracts,
          costUsd,
          feeUsd,
          signature: result.signature,
          ...(Config.dryRun && { transaction: res.transaction }),
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
          { label: "Event", value: position.eventMetadata.title },
          { label: "Market", value: position.marketMetadata.title },
          {
            label: "Side",
            value: position.isYes ? chalk.green("yes") : chalk.red("no"),
          },
          { label: "Cost", value: Output.formatDollar(costUsd) },
          { label: "Fee", value: Output.formatDollar(feeUsd) },
          { label: "Position", value: opts.position },
          ...(!Config.dryRun
            ? [{ label: "Tx Signature", value: result.signature! }]
            : []),
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
    return new Date(iso).toLocaleDateString();
  }
}
