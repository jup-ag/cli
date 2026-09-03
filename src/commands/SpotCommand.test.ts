import { expect, test } from "bun:test";
import { Command } from "commander";
import type { JupiterApi, JupiterDatapi } from "jupiter-api-ts";

import type { SolanaRpc } from "../lib/SolanaRpc.ts";
import { SpotCommand } from "./SpotCommand.ts";

test("spot registers transfers, rent reclaim, and portfolio at the top level", () => {
  const program = new Command();

  SpotCommand.register(
    program,
    undefined as unknown as JupiterDatapi,
    undefined as unknown as SolanaRpc,
    undefined as unknown as JupiterApi
  );

  expect(program.commands.map((command) => command.name())).toEqual([
    "spot",
    "portfolio",
    "transfer",
    "reclaim",
  ]);
  expect(
    program.commands
      .find((command) => command.name() === "spot")!
      .commands.map((command) => command.name())
  ).toEqual(["tokens", "quote", "swap", "history"]);
});
