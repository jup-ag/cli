import { execSync } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

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

    if (!Output.isJson()) {
      console.log(`Updating to v${latestVersion}...`);
    }

    if (method === "npm") {
      execSync(this.getPackageManagerCommand(latestVersion), {
        stdio: "inherit",
      });
    } else {
      await this.updateBinary();
    }

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
      .get("https://api.github.com/repos/jup-ag/cli/releases/latest")
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

  private static getPackageManagerCommand(version: string): string {
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

  private static async updateBinary(): Promise<void> {
    const scriptUrl =
      "https://github.com/jup-ag/cli/releases/latest/download/install.sh";
    const dir = await mkdtemp(join(tmpdir(), "jup-"));
    const scriptPath = join(dir, "install.sh");

    try {
      const script = await ky.get(scriptUrl).text();
      await writeFile(scriptPath, script, { mode: 0o700 });
      execSync(`bash ${scriptPath}`, { stdio: "inherit" });
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
