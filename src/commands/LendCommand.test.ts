import { expect, test } from "bun:test";
import { Command } from "commander";
import type { JupiterApi } from "jupiter-api-ts";

import type { SolanaRpc } from "../lib/SolanaRpc.ts";
import { LendCommand } from "./LendCommand.ts";

test("lend registers earn and borrow as sibling command groups", () => {
  const program = new Command();

  LendCommand.register(
    program,
    undefined as unknown as SolanaRpc,
    undefined as unknown as JupiterApi
  );

  const lend = program.commands.find((command) => command.name() === "lend")!;
  expect(lend.commands.map((command) => command.name())).toEqual([
    "earn",
    "borrow",
  ]);
  expect(
    lend.commands
      .find((command) => command.name() === "earn")!
      .commands.map((command) => command.name())
  ).toEqual(["tokens", "positions", "deposit", "withdraw"]);
  expect(
    lend.commands
      .find((command) => command.name() === "borrow")!
      .commands.map((command) => command.name())
  ).toEqual(["vaults", "positions", "operate"]);
});
