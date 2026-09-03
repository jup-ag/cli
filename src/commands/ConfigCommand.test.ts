import { afterEach, beforeEach, expect, test } from "bun:test";
import { Command } from "commander";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Config } from "../lib/Config.ts";
import { Output } from "../lib/Output.ts";
import { ConfigCommand } from "./ConfigCommand.ts";

const TEST_DIR = join(tmpdir(), `jup-config-command-test-${Date.now()}`);
const origSettingsFile = Config.SETTINGS_FILE;
const originalLog = console.log;

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  // @ts-expect-error test override
  Config.SETTINGS_FILE = join(TEST_DIR, "settings.json");
  Output.outputOverride = "json";
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  // @ts-expect-error restore
  Config.SETTINGS_FILE = origSettingsFile;
  Output.outputOverride = undefined;
  console.log = originalLog;
});

test("config set stores an HTTPS RPC URL and lists it", async () => {
  const output: string[] = [];
  console.log = (message?: unknown) => output.push(String(message));
  const program = new Command();
  program.exitOverride();
  ConfigCommand.register(program);

  await program.parseAsync([
    "node",
    "jup",
    "config",
    "set",
    "--rpc-url",
    "https://rpc.example.com",
  ]);

  expect(Config.load().rpcUrl).toBe("https://rpc.example.com");
  expect(JSON.parse(output.at(-1)!)).toMatchObject({
    rpcUrl: "https://rpc.example.com",
  });
});

test("config set clears an RPC URL when --rpc-url has no value", async () => {
  Config.set({ rpcUrl: "https://rpc.example.com" });
  console.log = () => {};
  const program = new Command();
  program.exitOverride();
  ConfigCommand.register(program);

  await program.parseAsync(["node", "jup", "config", "set", "--rpc-url"]);

  expect(Config.load().rpcUrl).toBeUndefined();
  expect(Config.getRpcUrl()).toBe("https://api.mainnet.solana.com");
});

test("config list displays the effective default RPC URL", async () => {
  const output: string[] = [];
  console.log = (message?: unknown) => output.push(String(message));
  const program = new Command();
  program.exitOverride();
  ConfigCommand.register(program);

  await program.parseAsync(["node", "jup", "config", "list"]);

  expect(JSON.parse(output.at(-1)!)).toMatchObject({
    rpcUrl: "https://api.mainnet.solana.com",
  });
});

test("config list redacts the API key while displaying the RPC URL", async () => {
  Config.set({ apiKey: "secret", rpcUrl: "https://rpc.example.com" });
  const output: string[] = [];
  console.log = (message?: unknown) => output.push(String(message));
  const program = new Command();
  program.exitOverride();
  ConfigCommand.register(program);

  await program.parseAsync(["node", "jup", "config", "list"]);

  expect(JSON.parse(output.at(-1)!)).toMatchObject({
    apiKey: "<set>",
    rpcUrl: "https://rpc.example.com",
  });
});
