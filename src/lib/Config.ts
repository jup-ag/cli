import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type Settings = {
  activeKey: "default" | string;
  output: "table" | "json";
  apiKey?: string | undefined;
};

const DEFAULT_SETTINGS: Settings = {
  activeKey: "default",
  output: "table",
};

export class Config {
  public static dryRun: boolean = false;

  public static readonly CONFIG_DIR = join(homedir(), ".config", "jup");
  public static readonly SETTINGS_FILE = join(this.CONFIG_DIR, "settings.json");
  public static readonly KEYS_DIR = join(this.CONFIG_DIR, "keys");

  public static init(): void {
    mkdirSync(this.CONFIG_DIR, { recursive: true });
    mkdirSync(this.KEYS_DIR, { recursive: true });
    if (!existsSync(this.SETTINGS_FILE)) {
      this.save(DEFAULT_SETTINGS);
    }
  }

  public static load(): Settings {
    if (!existsSync(this.SETTINGS_FILE)) {
      return { ...DEFAULT_SETTINGS };
    }
    const raw = JSON.parse(readFileSync(this.SETTINGS_FILE, "utf-8"));
    return {
      activeKey:
        typeof raw.activeKey === "string"
          ? raw.activeKey
          : DEFAULT_SETTINGS.activeKey,
      output:
        raw.output === "table" || raw.output === "json"
          ? raw.output
          : DEFAULT_SETTINGS.output,
      apiKey: typeof raw.apiKey === "string" ? raw.apiKey : undefined,
    };
  }

  public static set(settings: Partial<Settings>): void {
    if (Object.keys(settings).length === 0) {
      throw new Error("No settings provided to update.");
    }
    const currentSettings = this.load();
    this.save({
      ...currentSettings,
      ...settings,
    });
  }

  public static save(settings: Settings): void {
    // Strip undefined optional fields so settings.json stays clean
    const { apiKey, ...rest } = settings;
    const out = apiKey ? { ...rest, apiKey } : rest;
    writeFileSync(this.SETTINGS_FILE, JSON.stringify(out, null, 2) + "\n");
  }
}
