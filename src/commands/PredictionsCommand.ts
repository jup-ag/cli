import type { Base64EncodedBytes } from "@solana/kit";
import chalk from "chalk";
import type { Command } from "commander";

import { PredictionsClient } from "../clients/PredictionsClient.ts";
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
  }

  private static async events(opts: {
    filter?: string;
    sort: string;
    category: string;
    offset: string;
    limit: string;
  }): Promise<void> {
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

    const events = res.data.map((e) => ({
      id: e.eventId,
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
        id: m.marketId,
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
      if (res.pagination.hasNext) {
        json.next = res.pagination.end;
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
            id: "ID",
          },
          rows: event.markets.map((m) => ({
            title: m.title,
            yes: this.formatPricePct(m.yesPriceUsd),
            no: this.formatPricePct(m.noPriceUsd),
            id: m.id,
          })),
        });
      }

      console.log();
    }

    if (res.pagination.hasNext) {
      console.log("Next offset:", res.pagination.end);
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
        (await Signer.load(opts.key ?? Config.load().activeKey)).address;
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
      claimable:
        !p.claimed &&
        p.marketMetadata.result !== null &&
        p.marketMetadata.result === (p.isYes ? "yes" : "no"),
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

    const signedTx = await signer.signTransaction(
      res.transaction as Base64EncodedBytes
    );
    const result = await PredictionsClient.postExecute({
      signedTransaction: signedTx,
    });

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
      });
      return;
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
        { label: "Tx Signature", value: result.signature },
      ],
    });
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
