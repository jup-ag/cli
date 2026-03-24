import chalk from "chalk";
import type { Command } from "commander";

import {
  PredictionsClient,
  type PredictionEvent,
} from "../clients/PredictionsClient.ts";
import { Output } from "../lib/Output.ts";

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
      volumeUsd: Number(e.volumeUsd) / 1e6,
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
          ? m.pricing.buyYesPriceUsd / 1e6
          : null,
        noPriceUsd: m.pricing.buyNoPriceUsd
          ? m.pricing.buyNoPriceUsd / 1e6
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
