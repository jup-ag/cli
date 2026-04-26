import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { Config } from "./Config.ts";

const TEST_DIR = join(tmpdir(), `jup-config-test-${Date.now()}`);
const origSettingsFile = Config.SETTINGS_FILE;

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  // @ts-expect-error test override
  Config.SETTINGS_FILE = join(TEST_DIR, "settings.json");
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  // @ts-expect-error restore
  Config.SETTINGS_FILE = origSettingsFile;
});

describe("Config.load", () => {
  test("uses defaults when file is missing", () => {
    const s = Config.load();
    expect(s).toEqual({
      activeKey: "default",
      output: "table",
    });
    expect(s.apiKey).toBeUndefined();
  });

  test("throws a clear error when settings.json is not valid json", () => {
    writeFileSync(
      join(TEST_DIR, "settings.json"),
      "{ broken json no closing brace",
      "utf-8"
    );
    expect(() => Config.load()).toThrow(
      /Could not parse .*settings\.json.*Fix the file or remove it/
    );
  });

  test("loads valid settings", () => {
    writeFileSync(
      join(TEST_DIR, "settings.json"),
      JSON.stringify(
        { activeKey: "main", output: "json", apiKey: "secret" },
        null,
        2
      )
    );
    expect(Config.load()).toEqual({
      activeKey: "main",
      output: "json",
      apiKey: "secret",
    });
  });

  test("treats non-object root as empty object for fields", () => {
    writeFileSync(join(TEST_DIR, "settings.json"), "[]");
    const s = Config.load();
    expect(s.activeKey).toBe("default");
    expect(s.output).toBe("table");
  });
});
