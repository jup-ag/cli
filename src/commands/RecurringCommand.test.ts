import { expect, test } from "bun:test";
import { Command } from "commander";
import type { JupiterApi } from "jupiter-api-ts";

import type { SolanaRpc } from "../lib/SolanaRpc.ts";
import { RecurringCommand } from "./RecurringCommand.ts";

test("dca registers only time-based create, cancel, and list commands", () => {
  const program = new Command();

  RecurringCommand.register(
    program,
    undefined as unknown as SolanaRpc,
    undefined as unknown as JupiterApi
  );

  const dca = program.commands.find((command) => command.name() === "dca")!;
  expect(dca.commands.map((command) => command.name())).toEqual([
    "create",
    "cancel",
    "list",
  ]);
  expect(
    dca.commands
      .find((command) => command.name() === "create")!
      .options.map((option) => option.long)
  ).toEqual([
    "--from",
    "--to",
    "--amount",
    "--raw-amount",
    "--interval",
    "--orders",
    "--min-price",
    "--max-price",
    "--start-at",
    "--key",
    "--dry-run",
  ]);
});
