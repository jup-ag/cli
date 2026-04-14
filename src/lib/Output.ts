import chalk from "chalk";
import Table from "cli-table3";
import { HTTPError } from "ky";

import { Config } from "./Config.ts";

type HorizontalTable = {
  type: "horizontal";
  headers: Record<string, string>;
  rows: Record<string, unknown>[];
  maxWidths?: Record<string, number>;
};

type VerticalTable = {
  type: "vertical";
  rows: {
    label: string;
    value: string;
  }[];
};

export class Output {
  public static outputOverride: "table" | "json" | undefined;

  public static isJson(): boolean {
    return (this.outputOverride ?? Config.load().output) === "json";
  }

  public static json(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }

  public static async error(err: unknown): Promise<void> {
    let message: string;
    if (err instanceof HTTPError) {
      // Best effort to extract message from the response body, which may be JSON or plain text
      const text = await err.response.text().catch(() => "");
      try {
        const json = JSON.parse(text);
        message = json.message ?? json.error ?? JSON.stringify(json);
      } catch {
        message = text || err.message;
      }
    } else {
      message = err instanceof Error ? err.message : String(err);
    }
    if (this.isJson()) {
      this.json({ error: message });
    } else {
      console.log(`${chalk.red.bold("Error:")} ${message}`);
    }
  }

  public static table(opts: HorizontalTable | VerticalTable): void {
    if (opts.type === "horizontal") {
      if (opts.rows.length === 0) {
        console.log("No results.");
        return;
      }

      const keys = Object.keys(opts.headers);
      const head = keys.map((k) => chalk.bold(opts.headers[k]!));
      const table = new Table({
        head,
        style: { head: [] },
        colWidths: keys.map((k) => opts.maxWidths?.[k] ?? null),
        wordWrap: true,
        wrapOnWordBoundary: true,
      });

      for (const row of opts.rows) {
        table.push(keys.map((k) => String(row[k] ?? "")));
      }

      console.log(table.toString());
    } else {
      const table = new Table();

      for (const { label, value } of opts.rows) {
        table.push({ [chalk.bold(label)]: value });
      }

      console.log(table.toString());
    }
  }

  public static readonly DRY_RUN_LABEL = chalk.bold(chalk.yellow("[DRY RUN]"));

  public static formatBoolean(value: boolean | undefined): string {
    return value ? "✅" : "❌";
  }

  public static formatPercentageChange(value: number | undefined): string {
    if (value === undefined || value === null) {
      return chalk.gray("\u2014");
    }
    const formatted = `${value >= 0 ? "+" : ""}${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
    if (value > 0.5) {
      return chalk.green(formatted);
    }
    if (value < -0.5) {
      return chalk.red(formatted);
    }
    return chalk.gray(formatted);
  }

  public static formatDollar(
    amount: number | undefined,
    opts?: { decimals?: number }
  ): string {
    if (!amount) {
      // em-dash to indicate nullish or zero values, since $0.00 can be misleading
      return chalk.gray("\u2014");
    }

    if (opts?.decimals !== undefined) {
      return amount.toLocaleString("en-US", {
        currency: "USD",
        style: "currency",
        minimumFractionDigits: opts.decimals,
        maximumFractionDigits: opts.decimals,
      });
    }

    if (amount < 1000) {
      return amount.toLocaleString("en-US", {
        currency: "USD",
        style: "currency",
        minimumSignificantDigits: 5,
        maximumSignificantDigits: 5,
      });
    }

    return amount.toLocaleString("en-US", {
      currency: "USD",
      style: "currency",
    });
  }

  public static formatDollarChange(amount: number | undefined): string {
    if (amount === undefined || amount === null || amount === 0) {
      return chalk.gray("\u2014");
    }
    const sign = amount > 0 ? "+" : "\u2212";
    const formatted = this.formatDollar(Math.abs(amount), { decimals: 2 });
    const text = `${sign}${formatted}`;
    if (amount > 0) {
      return chalk.green(text);
    }
    return chalk.red(text);
  }
}
