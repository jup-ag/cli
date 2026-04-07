#!/usr/bin/env node
import { Command } from "commander";

import { ConfigCommand } from "./commands/ConfigCommand.ts";
import { KeysCommand } from "./commands/KeysCommand.ts";
import { LendCommand } from "./commands/LendCommand.ts";
import { PerpsCommand } from "./commands/PerpsCommand.ts";
import { PredictionsCommand } from "./commands/PredictionsCommand.ts";
import { SpotCommand } from "./commands/SpotCommand.ts";
import { UpdateCommand } from "./commands/UpdateCommand.ts";
import { VrfdCommand } from "./commands/VrfdCommand.ts";

import { version } from "../package.json";
import { Config } from "./lib/Config.ts";
import { Output } from "./lib/Output.ts";

Config.init();

const program = new Command();
program
  .name("jup")
  .description("Jupiter CLI for agentic workflows")
  .version(version)
  .option("-f, --format <type>", "Output format ('table' or 'json')")
  .option("--dry-run", "Preview the transaction without signing or submitting")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.format) {
      if (opts.format !== "table" && opts.format !== "json") {
        throw new Error("Invalid --format value. Must be 'table' or 'json'.");
      }
      Output.outputOverride = opts.format;
    }
    if (opts.dryRun) {
      Config.dryRun = true;
    }
  });

ConfigCommand.register(program);
KeysCommand.register(program);
LendCommand.register(program);
PerpsCommand.register(program);
PredictionsCommand.register(program);
SpotCommand.register(program);
UpdateCommand.register(program);
VrfdCommand.register(program);

program.parseAsync().catch(async (err: unknown) => {
  await Output.error(err);
  process.exit(1);
});
