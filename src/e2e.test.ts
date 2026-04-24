import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(REPO_ROOT, "dist", "index.js");

// From src/lib/KeyPair.test.ts — same mnemonic, same default derivation path.
const TEST_SEED =
  "neither lonely flavor argue grass remind eye tag avocado spot unusual intact";
const TEST_SEED_ADDRESS = "5vftMkHL72JaJG6ExQfGAsT2uGVHpRR7oTNUPMs68Y2N";

let tmpHome: string;

beforeAll(() => {
  const build = spawnSync("bun", ["run", "build"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  if (build.status !== 0) {
    throw new Error("bun run build failed — cannot run e2e tests");
  }
  if (!existsSync(CLI)) {
    throw new Error(`Expected ${CLI} to exist after build`);
  }
});

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), "jup-e2e-"));
});

afterEach(() => {
  rmSync(tmpHome, { recursive: true, force: true });
});

type CliResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function runCli(...args: string[]): CliResult {
  const { status, stdout, stderr } = spawnSync("node", [CLI, ...args], {
    env: { ...process.env, HOME: tmpHome },
    encoding: "utf-8",
  });
  return { status, stdout, stderr };
}

// Runs the CLI and throws with full stdout/stderr if exit status != 0
// test failures surface the actual error from the CLI
function runOk(...args: string[]): CliResult {
  const result = runCli(...args);
  if (result.status !== 0) {
    throw new Error(
      `jup ${args.join(" ")} exited with status ${result.status}\n` +
        `--- stdout ---\n${result.stdout}` +
        `\n--- stderr ---\n${result.stderr}`
    );
  }
  return result;
}

// Catches regression introduced in e0ea22e
describe("keys add (dist/index.js)", () => {
  test("generates a new keypair on disk", () => {
    runOk("keys", "add", "generated");

    const keyFile = join(tmpHome, ".config", "jup", "keys", "generated.json");
    expect(existsSync(keyFile)).toBe(true);

    const contents = JSON.parse(readFileSync(keyFile, "utf-8"));
    expect(Array.isArray(contents)).toBe(true);
    expect(contents).toHaveLength(64);
    expect(
      (contents as number[]).every(
        (v) => Number.isInteger(v) && v >= 0 && v <= 255
      )
    ).toBe(true);
  });

  test("imports from seed phrase and derives the expected address", () => {
    runOk("keys", "add", "imported", "--seed-phrase", TEST_SEED);
    const list = runOk("-f", "json", "keys", "list");

    const keys = JSON.parse(list.stdout) as { name: string; address: string }[];
    const imported = keys.find((k) => k.name === "imported");
    expect(imported?.address).toBe(TEST_SEED_ADDRESS);
  });

  test("refuses to overwrite an existing key without --overwrite", () => {
    runOk("keys", "add", "dup");

    const second = runCli("keys", "add", "dup");
    expect(second.status).not.toBe(0);
    expect(second.stdout + second.stderr).toContain("already exists");
  });
});
