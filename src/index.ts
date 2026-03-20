#!/usr/bin/env node
import { Command } from "commander";

import { ConfigCommand } from "./commands/ConfigCommand.ts";
import { KeysCommand } from "./commands/KeysCommand.ts";
import { LendCommand } from "./commands/LendCommand.ts";
import { PerpsCommand } from "./commands/PerpsCommand.ts";
import { SpotCommand } from "./commands/SpotCommand.ts";
import { UpdateCommand } from "./commands/UpdateCommand.ts";

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
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.format) {
      if (opts.format !== "table" && opts.format !== "json") {
        throw new Error("Invalid --format value. Must be 'table' or 'json'.");
      }
      Output.outputOverride = opts.format;
    }
  });

ConfigCommand.register(program);
KeysCommand.register(program);
LendCommand.register(program);
PerpsCommand.register(program);
SpotCommand.register(program);
UpdateCommand.register(program);

program.parseAsync().catch(async (err: unknown) => {
  await Output.error(err);
  process.exit(1);
});
