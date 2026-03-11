#!/usr/bin/env node
import { Command } from "commander";

import { ConfigCommand } from "./commands/ConfigCommand.ts";
import { KeysCommand } from "./commands/KeysCommand.ts";
import { SpotCommand } from "./commands/SpotCommand.ts";

import { Config } from "./lib/Config.ts";
import { Output } from "./lib/Output.ts";

Config.init();

const program = new Command();
program
  .name("jup")
  .description("Jupiter CLI for agentic workflows")
  .version("0.1.0")
  .option("--output <type>", "Output format ('table' or 'json')")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.output) {
      if (opts.output !== "table" && opts.output !== "json") {
        throw new Error("Invalid --output format. Must be 'table' or 'json'.");
      }
      Output.outputOverride = opts.output;
    }
  });

ConfigCommand.register(program);
KeysCommand.register(program);
SpotCommand.register(program);

program.parseAsync().catch((err: unknown) => {
  Output.error(err);
  process.exit(1);
});
