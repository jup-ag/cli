import type { BackendName, KeychainSignerConfig } from "@solana/keychain";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Config } from "./Config.ts";

export type KeychainConfigData = {
  backend: BackendName;
  address: string;
  params: Record<string, string>;
};

export const BACKEND_NAMES: BackendName[] = [
  "aws-kms",
  "cdp",
  "crossmint",
  "dfns",
  "fireblocks",
  "gcp-kms",
  "para",
  "privy",
  "turnkey",
  "vault",
];

export class KeychainConfig {
  public static configPath(name: string): string {
    return join(Config.KEYS_DIR, `${name}.keychain.json`);
  }

  public static isKeychainKey(name: string): boolean {
    return existsSync(this.configPath(name));
  }

  public static load(name: string): KeychainConfigData {
    const path = this.configPath(name);
    if (!existsSync(path)) {
      throw new Error(`Keychain config "${name}" does not exist.`);
    }
    return JSON.parse(readFileSync(path, "utf-8")) as KeychainConfigData;
  }

  public static save(name: string, config: KeychainConfigData): void {
    writeFileSync(this.configPath(name), JSON.stringify(config, null, 2));
  }

  public static toSignerConfig(
    config: KeychainConfigData
  ): KeychainSignerConfig {
    return {
      backend: config.backend,
      ...config.params,
    } as KeychainSignerConfig;
  }
}
