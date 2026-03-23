import { execFileSync } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import chalk from "chalk";
import ky from "ky";
import type { Command } from "commander";

import { version as currentVersion } from "../../package.json";
import { Output } from "../lib/Output.ts";

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
    const isUpToDate = !this.isNewer(latestVersion, currentVersion);

    if (isUpToDate) {
      return this.output({
        json: { currentVersion, latestVersion, status: "up_to_date" },
        rows: [
          { label: "Version", value: `v${currentVersion}` },
          { label: "Status", value: chalk.green("Already up to date") },
        ],
      });
    }

    if (opts.check) {
      return this.output({
        json: { currentVersion, latestVersion, status: "update_available" },
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

    if (!Output.isJson()) {
      console.log(`Updating to v${latestVersion}...`);
    }

    await this.runInstallScript();

    this.output({
      json: { currentVersion, latestVersion, status: "updated" },
      rows: [
        { label: "Previous Version", value: `v${currentVersion}` },
        {
          label: "New Version",
          value: chalk.green(`v${latestVersion}`),
        },
        { label: "Status", value: chalk.green("Updated successfully") },
      ],
    });
  }

  private static output(opts: {
    json: Record<string, string>;
    rows: { label: string; value: string }[];
  }): void {
    if (Output.isJson()) {
      Output.json(opts.json);
    } else {
      Output.table({ type: "vertical", rows: opts.rows });
    }
  }

  private static async getLatestVersion(): Promise<string> {
    try {
      const release = await ky
        .get("https://api.github.com/repos/jup-ag/cli/releases/latest")
        .json<{ tag_name: string }>();

      return release.tag_name.replace(/^v/, "");
    } catch {
      throw new Error(
        "Failed to check for updates. Please check your internet connection and try again."
      );
    }
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

  private static async runInstallScript(): Promise<void> {
    const scriptUrl =
      "https://github.com/jup-ag/cli/releases/latest/download/install.sh";
    const dir = await mkdtemp(join(tmpdir(), "jup-"));
    const scriptPath = join(dir, "install.sh");

    try {
      const script = await ky.get(scriptUrl).text();
      await writeFile(scriptPath, script, { mode: 0o700 });
      execFileSync("bash", [scriptPath], {
        env: {
          ...process.env,
          JUP_INSTALL_QUIET: Output.isJson() ? "1" : "0",
        },
        stdio: Output.isJson()
          ? ["inherit", "ignore", "inherit"]
          : "inherit",
      });
    } catch {
      throw new Error(
        "Update failed. Run `jup update` again or install manually from https://github.com/jup-ag/cli/releases"
      );
    } finally {
      rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
