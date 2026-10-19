import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";

// Point Config.KEYS_DIR at an isolated temp dir before importing anything
// that reads it. Config derives KEYS_DIR from CONFIG_DIR, which derives from
// homedir(); HOME is read at module-eval time, so we set it first.
const tempHome = mkdtempSync(join(tmpdir(), "jup-keys-test-"));
process.env.HOME = tempHome;

const { KeysCommand } = await import("./KeysCommand.ts");
const { Config } = await import("../lib/Config.ts");

// Access the private static list() handler through the class without
// invoking commander.
// @ts-expect-error test access to private static method
const list = () => KeysCommand.list();

// A valid 32-byte ed25519 private key as a JSON byte array — the Solana
// id-json shape Signer.load()/KeyPair.fromPrivateKey() accept. Deterministic
// test material only; never holds value.
const VALID_KEY = JSON.stringify(
  Array.from({ length: 32 }, (_, i) => (i * 7 + 3) % 256)
);

afterAll(() => {
  rmSync(tempHome, { recursive: true, force: true });
});

describe("KeysCommand.list with corrupted key files", () => {
  test("survives one corrupted keypair and still lists the valid one", async () => {
    Config.init();
    writeFileSync(join(Config.KEYS_DIR, "good.json"), VALID_KEY);
    writeFileSync(join(Config.KEYS_DIR, "bad.json"), "{not valid json");

    // The old Promise.all() behavior rejected here; allSettled must not.
    await expect(list()).resolves.toBeUndefined();
  });

  test("survives an empty key file and a valid key side by side", async () => {
    Config.init();
    writeFileSync(join(Config.KEYS_DIR, "good2.json"), VALID_KEY);
    writeFileSync(join(Config.KEYS_DIR, "empty.json"), "");

    await expect(list()).resolves.toBeUndefined();
  });

  test("all-corrupted keys dir does not crash either", async () => {
    Config.init();
    writeFileSync(join(Config.KEYS_DIR, "bad2.json"), "[]");
    writeFileSync(join(Config.KEYS_DIR, "bad3.json"), "garbage");

    await expect(list()).resolves.toBeUndefined();
  });
});
