import type { Command } from "commander";

import { Config } from "../lib/Config.ts";
import { Output } from "../lib/Output.ts";

export class ConfigCommand {
  public static register(program: Command): void {
    const config = program
      .command("config")
      .description("CLI settings and configurations");
    config
      .command("list")
      .description("List all settings")
      .action(() => this.list());
    config
      .command("set")
      .description("Update settings")
      .option("--active-key <name>", "Set the active key")
      .option("--output <type>", "Set the output format ('table' or 'json')")
      .action((opts) => this.set(opts));
  }

  private static list(): void {
    const settings = Config.load();
    if (Output.isJson()) {
      Output.json(settings);
      return;
    }

    const data = Object.entries(settings).map(([key, value]) => ({
      setting: key,
      value: String(value),
    }));
    Output.table({
      type: "horizontal",
      headers: { setting: "Setting", value: "Value" },
      rows: data,
    });
  }

  private static set(opts: {
    activeKey?: string;
    output?: "table" | "json";
  }): void {
    if (opts.output && opts.output !== "table" && opts.output !== "json") {
      throw new Error("Invalid --output format. Must be 'table' or 'json'.");
    }
    Config.set(opts);
    this.list();
  }
}
