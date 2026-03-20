import { createHash } from "crypto";
import { chmod, rename, rm, writeFile } from "fs/promises";
import { basename } from "path";

import chalk from "chalk";
import ky from "ky";
import type { Command } from "commander";

import { version as currentVersion } from "../../package.json";
import { Output } from "../lib/Output.ts";

type InstallMethod = "npm" | "binary";

export class UpdateCommand {
  public static register(program: Command): void {
    program
      .command("update")
      .description("Update the CLI to the latest version")
      .option("--check", "Check for updates without installing")
      .action((opts: { check?: boolean }) => this.update(opts));
  }

  private static async update(opts: { check?: boolean }): Promise<void> {
    const latestVersion = await this.getLatestVersion();

    if (!this.isNewer(latestVersion, currentVersion)) {
      if (Output.isJson()) {
        Output.json({
          currentVersion,
          latestVersion,
          status: "up_to_date",
        });
      } else {
        Output.table({
          type: "vertical",
          rows: [
            { label: "Version", value: `v${currentVersion}` },
            { label: "Status", value: chalk.green("Already up to date") },
          ],
        });
      }
      return;
    }

    if (opts.check) {
      if (Output.isJson()) {
        Output.json({
          currentVersion,
          latestVersion,
          status: "update_available",
        });
      } else {
        Output.table({
          type: "vertical",
          rows: [
            { label: "Current Version", value: `v${currentVersion}` },
            {
              label: "Latest Version",
              value: chalk.green(`v${latestVersion}`),
            },
            { label: "Status", value: "Update available" },
          ],
        });
      }
      return;
    }

    const method = this.detectInstallMethod();

    if (method === "npm") {
      const hint = this.getPackageManagerHint(latestVersion);
      if (Output.isJson()) {
        Output.json({
          currentVersion,
          latestVersion,
          status: "manual_update_required",
          method: "npm",
          command: hint,
        });
      } else {
        Output.table({
          type: "vertical",
          rows: [
            { label: "Current Version", value: `v${currentVersion}` },
            {
              label: "Latest Version",
              value: chalk.green(`v${latestVersion}`),
            },
            {
              label: "Update Command",
              value: chalk.cyan(hint),
            },
          ],
        });
      }
      return;
    }

    if (!Output.isJson()) {
      console.log(`Downloading v${latestVersion}...`);
    }

    await this.updateBinary(latestVersion);

    if (Output.isJson()) {
      Output.json({
        currentVersion,
        latestVersion,
        status: "updated",
        method,
      });
    } else {
      Output.table({
        type: "vertical",
        rows: [
          { label: "Previous Version", value: `v${currentVersion}` },
          {
            label: "New Version",
            value: chalk.green(`v${latestVersion}`),
          },
          { label: "Method", value: method },
          { label: "Status", value: chalk.green("Updated successfully") },
        ],
      });
    }
  }

  private static async getLatestVersion(): Promise<string> {
    const release = await ky
      .get("https://api.github.com/repos/jup-ag/cli/releases/latest", {
        headers: { "User-Agent": "@jup-ag/cli" },
      })
      .json<{ tag_name: string }>();

    return release.tag_name.replace(/^v/, "");
  }

  private static isNewer(latest: string, current: string): boolean {
    const latestParts = latest.split(".").map(Number);
    const currentParts = current.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((latestParts[i] ?? 0) > (currentParts[i] ?? 0)) {
        return true;
      }
      if ((latestParts[i] ?? 0) < (currentParts[i] ?? 0)) {
        return false;
      }
    }
    return false;
  }

  private static detectInstallMethod(): InstallMethod {
    if (process.argv[1]?.includes("node_modules")) {
      return "npm";
    }
    return "binary";
  }

  private static getPackageManagerHint(version: string): string {
    const agent = process.env.npm_config_user_agent ?? "";
    if (agent.startsWith("pnpm")) {
      return `pnpm add -g @jup-ag/cli@${version}`;
    }
    if (agent.startsWith("yarn")) {
      return `yarn global add @jup-ag/cli@${version}`;
    }
    if (agent.startsWith("bun")) {
      return `bun add -g @jup-ag/cli@${version}`;
    }
    // Check Volta via env var (set when Volta manages the shell)
    if (process.env.VOLTA_HOME) {
      return "volta install @jup-ag/cli";
    }
    return `npm install -g @jup-ag/cli@${version}`;
  }

  private static async updateBinary(version: string): Promise<void> {
    const binaryPath = process.execPath;
    const execName = basename(binaryPath);

    // Guard: refuse to overwrite the runtime in dev mode
    if (execName === "bun" || execName === "node") {
      throw new Error(
        "Cannot self-update in dev mode — process.execPath points to the runtime, not the jup binary. " +
          "Build a standalone binary first: bun build src/index.ts --compile --outfile jup"
      );
    }

    const assetName = this.getBinaryAssetName();
    const baseUrl = `https://github.com/jup-ag/cli/releases/download/v${version}`;
    const headers = { "User-Agent": "@jup-ag/cli" };

    const [binary, checksums] = await Promise.all([
      ky.get(`${baseUrl}/${assetName}`, { headers }).arrayBuffer(),
      ky.get(`${baseUrl}/checksums.txt`, { headers }).text(),
    ]);

    const buf = Buffer.from(binary);

    // Verify checksum — exact match on filename after the hash
    const checksumLine = checksums
      .split("\n")
      .map((line) => line.trim().split(/\s+/))
      .find((parts) => parts.length === 2 && parts[1] === assetName);

    if (!checksumLine) {
      throw new Error(`Checksum not found for ${assetName}`);
    }

    const expectedHash = checksumLine[0];
    const actualHash = createHash("sha256").update(buf).digest("hex");

    if (actualHash !== expectedHash) {
      throw new Error(
        `Checksum mismatch for ${assetName}: expected ${expectedHash}, got ${actualHash}`
      );
    }

    const tmpPath = `${binaryPath}.tmp`;

    try {
      await writeFile(tmpPath, buf);
      await chmod(tmpPath, 0o755);
      await rename(tmpPath, binaryPath);
    } catch (err: unknown) {
      await rm(tmpPath, { force: true }).catch(() => {});
      if (err instanceof Error && "code" in err && err.code === "EACCES") {
        throw new Error(
          "Permission denied. Try running with sudo: sudo jup update"
        );
      }
      throw err;
    }
  }

  private static getBinaryAssetName(): string {
    const supportedPlatforms = new Set(["linux", "darwin"]);
    const supportedArchs = new Set(["x64", "arm64"]);

    if (
      !supportedPlatforms.has(process.platform) ||
      !supportedArchs.has(process.arch)
    ) {
      throw new Error(
        `Unsupported platform: ${process.platform}-${process.arch}. ` +
          "Supported: linux-x64, linux-arm64, darwin-x64, darwin-arm64"
      );
    }

    return `jup-${process.platform}-${process.arch}`;
  }
}
