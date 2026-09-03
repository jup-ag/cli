import { expect, test } from "bun:test";
import { Command } from "commander";
import type { JupiterPerpsApi } from "jupiter-api-ts";

import { Output } from "../lib/Output.ts";
import type { SolanaRpc } from "../lib/SolanaRpc.ts";
import { JlpCommand } from "./JlpCommand.ts";

type JlpPrivateMethods = {
  info(): Promise<void>;
  poolToken(value: string, option: string): string;
};

const jlpMethods = JlpCommand as unknown as JlpPrivateMethods;

test("jlp registers info, mint, and burn commands", () => {
  const program = new Command();

  JlpCommand.register(
    program,
    undefined as unknown as JupiterPerpsApi,
    undefined as unknown as SolanaRpc
  );

  const jlp = program.commands.find((command) => command.name() === "jlp")!;
  expect(jlp.commands.map((command) => command.name())).toEqual([
    "info",
    "mint",
    "burn",
  ]);
  expect(
    jlp.commands
      .find((command) => command.name() === "mint")!
      .options.map((option) => option.long)
  ).toEqual(["--token", "--amount", "--raw-amount", "--key", "--dry-run"]);
  expect(
    jlp.commands
      .find((command) => command.name() === "burn")!
      .options.map((option) => option.long)
  ).toEqual(["--amount", "--raw-amount", "--receive", "--key", "--dry-run"]);
});

test("jlp info returns pool data as JSON", async () => {
  const program = new Command();
  const api = {
    getJlpInfo: async () => ({
      data: {
        aumUsd: "100000000",
        aumUsdFormatted: "$100.00",
        aumLimitUsd: "1000000000",
        aumLimitUsdFormatted: "$1,000.00",
        jlpPriceUsd: "1000000",
        jlpPriceUsdFormatted: "$1.00",
        jlpTotalSupply: "100000000",
        jlpTotalSupplyFormatted: "100 JLP",
        jlpAprBps: "1000",
        jlpAprPct: "10",
        jlpApyBps: "1050",
        jlpApyPct: "10.5",
        jlpAprLastUpdatedTimestamp: "0",
        jlpRealizedFeeUsd: "0",
        custodies: [
          {
            pubkey: "custody",
            symbol: "SOL",
            name: "Solana",
            mint: "mint",
            aumUsd: "100000000",
            aumUsdFormatted: "$100.00",
            aumTokenAmount: "1000000000",
            aumTokenAmountFormatted: "1 SOL",
            currentWeightagePct: "25",
            targetWeightagePct: "30",
            utilizationPct: "5",
            owned: "0",
            locked: "0",
            guaranteedUsd: "0",
            globalShortSizes: "0",
            globalShortAveragePrice: "0",
            shortPnlDelta: "0",
            shortTradersHasProfit: false,
            totalStakedAmountLamports: "0",
            totalStakedAmountUsd: "0",
            totalStakedAmountUsdFormatted: "$0.00",
          },
        ],
      },
    }),
  };
  JlpCommand.register(
    program,
    api as unknown as JupiterPerpsApi,
    undefined as unknown as SolanaRpc
  );
  const output: string[] = [];
  const originalLog = console.log;
  Output.outputOverride = "json";
  console.log = (value: string) => output.push(value);

  try {
    await jlpMethods.info();
  } finally {
    console.log = originalLog;
    Output.outputOverride = undefined;
  }

  expect(JSON.parse(output[0]!)).toMatchObject({
    aumUsdFormatted: "$100.00",
    custodies: [{ symbol: "SOL", currentWeightagePct: "25" }],
  });
});

test("jlp accepts WBTC as a documented pool token", () => {
  expect(jlpMethods.poolToken("wbtc", "--token")).toBe("WBTC");
  expect(() => jlpMethods.poolToken("JUP", "--token")).toThrow(
    "Invalid --token. Must be SOL, WBTC, ETH, or USDC."
  );
});
