import type { Command } from "commander";

import { DatapiClient } from "../clients/DatapiClient.ts";
import { Output } from "../lib/Output.ts";

export class TokensCommand {
  public static register(program: Command): void {
    const tokens = program.command("tokens").description("Search tokens");
    tokens
      .command("search")
      .description("Search for tokens by symbol or mint address")
      .requiredOption(
        "--query <query>",
        "Token symbol or comma-delimited mint addresses"
      )
      .option("--limit <n>", "Max number of results")
      .action((opts) => this.search(opts));
  }

  private static async search(opts: {
    query: string;
    limit?: string;
  }): Promise<void> {
    if ("limit" in opts && isNaN(Number(opts.limit))) {
      throw new Error("--limit must be a number");
    }

    const tokens = await DatapiClient.search({
      query: opts.query,
      limit: opts.limit,
    });

    if (tokens.length === 0) {
      throw new Error("No tokens found matching query.");
    }

    if (Output.isJson()) {
      Output.json(tokens);
      return;
    }

    Output.table({
      type: "horizontal",
      headers: {
        id: "Address",
        symbol: "Symbol",
        name: "Name",
        price: "Price",
        mcap: "Market Cap",
        verified: "Verified",
      },
      rows: tokens.map((t) => ({
        ...t,
        price: Output.formatDollar(t.usdPrice),
        mcap: Output.formatDollar(t.mcap),
        verified: Output.formatBoolean(t.isVerified),
      })),
    });
  }
}
