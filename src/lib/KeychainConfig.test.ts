import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createKeychainSigner,
  isKeychainKey,
  keychainConfigPath,
  loadKeychainConfig,
  saveKeychainConfig,
  type KeychainConfig,
} from "./KeychainConfig.ts";
import { Config } from "./Config.ts";

const TEST_DIR = join(tmpdir(), `jup-test-${Date.now()}`);
const origKeysDir = Config.KEYS_DIR;

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  // @ts-expect-error — override readonly for testing
  Config.KEYS_DIR = TEST_DIR;
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  // @ts-expect-error — restore original
  Config.KEYS_DIR = origKeysDir;
});

const SAMPLE_CONFIG: KeychainConfig = {
  backend: "vault",
  address: "11111111111111111111111111111111",
  params: {
    vaultAddr: "https://vault.example.com",
    keyName: "solana-key",
    publicKey: "11111111111111111111111111111111",
  },
};

describe("config round-trip", () => {
  test("save then load returns same data", () => {
    saveKeychainConfig("test-key", SAMPLE_CONFIG);
    const loaded = loadKeychainConfig("test-key");
    expect(loaded).toEqual(SAMPLE_CONFIG);
  });

  test("save creates .keychain.json file", () => {
    saveKeychainConfig("test-key", SAMPLE_CONFIG);
    expect(existsSync(join(TEST_DIR, "test-key.keychain.json"))).toBe(true);
  });
});

describe("isKeychainKey", () => {
  test("returns true for .keychain.json", () => {
    saveKeychainConfig("kc-key", SAMPLE_CONFIG);
    expect(isKeychainKey("kc-key")).toBe(true);
  });

  test("returns false for regular .json", () => {
    writeFileSync(join(TEST_DIR, "regular.json"), "[]");
    expect(isKeychainKey("regular")).toBe(false);
  });

  test("returns false for nonexistent key", () => {
    expect(isKeychainKey("nope")).toBe(false);
  });
});

describe("loadKeychainConfig", () => {
  test("throws for nonexistent config", () => {
    expect(() => loadKeychainConfig("missing")).toThrow(
      'Keychain config "missing" does not exist.'
    );
  });
});

describe("createKeychainSigner", () => {
  test("throws for unknown backend", async () => {
    const config = {
      backend: "nonexistent" as any,
      address: "",
      params: {},
    };
    expect(createKeychainSigner(config)).rejects.toThrow(
      'Unknown keychain backend: "nonexistent"'
    );
  });

  test("throws when required env var is missing", async () => {
    const saved = process.env.VAULT_TOKEN;
    delete process.env.VAULT_TOKEN;
    try {
      const config: KeychainConfig = {
        backend: "vault",
        address: "",
        params: {
          vaultAddr: "https://vault.example.com",
          keyName: "test",
          publicKey: "11111111111111111111111111111111",
        },
      };
      expect(createKeychainSigner(config)).rejects.toThrow(
        "Missing required environment variable: VAULT_TOKEN"
      );
    } finally {
      if (saved) {
        process.env.VAULT_TOKEN = saved;
      }
    }
  });
});
