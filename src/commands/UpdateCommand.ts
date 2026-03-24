import chalk from "chalk";
import { execSync } from "child_process";
import type { Command } from "commander";
import ky from "ky";

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
      if (Output.isJson()) {
        return Output.json({
          currentVersion,
          latestVersion,
          status: "up_to_date",
        });
      }
      return Output.table({
        type: "vertical",
        rows: [
          { label: "Current Version", value: `v${currentVersion}` },
          { label: "Latest Version", value: `v${latestVersion}` },
          { label: "Status", value: chalk.green("Already up to date") },
        ],
      });
    }

    if (opts.check) {
      if (Output.isJson()) {
        return Output.json({
          currentVersion,
          latestVersion,
          status: "update_available",
        });
      }
      return Output.table({
        type: "vertical",
        rows: [
          { label: "Current Version", value: `v${currentVersion}` },
          { label: "Latest Version", value: `v${latestVersion}` },
          { label: "Status", value: chalk.yellow("Update available") },
        ],
      });
    }

    await this.runInstallScript();

    if (Output.isJson()) {
      return Output.json({
        currentVersion: latestVersion,
        latestVersion,
        status: "updated",
      });
    }
    Output.table({
      type: "vertical",
      rows: [
        { label: "Current Version", value: chalk.green(`v${latestVersion}`) },
        { label: "Latest Version", value: `v${latestVersion}` },
        { label: "Status", value: chalk.green("Updated successfully") },
      ],
    });
  }

  private static async getLatestVersion(): Promise<string> {
    try {
      const release = await ky
        .get("https://api.github.com/repos/jup-ag/cli/releases/latest")
        .json<{ tag_name: string }>();
      return release.tag_name.replace(/^v/, "");
    } catch {
      throw new Error(
        "Failed to check for updates. Run `jup update` again or install manually from https://github.com/jup-ag/cli/releases."
      );
    }
  }

  private static isNewer(latest: string, current: string): boolean {
    return latest.localeCompare(current, "en", { numeric: true }) > 0;
  }

  private static async runInstallScript(): Promise<void> {
    const scriptUrl =
      "https://raw.githubusercontent.com/jup-ag/cli/main/scripts/install.sh";

    try {
      const script = await ky.get(scriptUrl).text();
      execSync("bash -s", {
        input: script,
        stdio: ["pipe", "inherit", "inherit"],
      });
    } catch {
      throw new Error(
        "Update failed. Run `jup update` again or install manually from https://github.com/jup-ag/cli/releases."
      );
    }
  }
}
