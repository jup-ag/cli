import type { SolanaSigner } from "@solana/keychain";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Config } from "./Config.ts";

export type KeychainBackend =
  | "aws-kms"
  | "cdp"
  | "crossmint"
  | "dfns"
  | "fireblocks"
  | "gcp-kms"
  | "para"
  | "privy"
  | "turnkey"
  | "vault";

export type KeychainConfigData = {
  backend: KeychainBackend;
  address: string;
  params: Record<string, string>;
};

type BackendDef = {
  requiredEnvVars: string[];
  requiredParams: string[];
  optionalParams: string[];
  create: (params: Record<string, string>) => Promise<SolanaSigner>;
};

export class KeychainConfig {
  static readonly BACKENDS: Record<KeychainBackend, BackendDef> = {
    "aws-kms": {
      requiredEnvVars: [],
      requiredParams: ["keyId", "publicKey"],
      optionalParams: ["region"],
      create: async (params) => {
        const { createAwsKmsSigner } = await import("@solana/keychain-aws-kms");
        return createAwsKmsSigner({
          keyId: this.requireParam(params, "keyId"),
          publicKey: this.requireParam(params, "publicKey"),
          region: params.region,
        });
      },
    },
    cdp: {
      requiredEnvVars: [
        "CDP_API_KEY_ID",
        "CDP_API_KEY_SECRET",
        "CDP_WALLET_SECRET",
      ],
      requiredParams: ["address"],
      optionalParams: ["baseUrl"],
      create: async (params) => {
        const { createCdpSigner } = await import("@solana/keychain-cdp");
        return createCdpSigner({
          cdpApiKeyId: this.requireEnv("CDP_API_KEY_ID"),
          cdpApiKeySecret: this.requireEnv("CDP_API_KEY_SECRET"),
          cdpWalletSecret: this.requireEnv("CDP_WALLET_SECRET"),
          address: this.requireParam(params, "address"),
          baseUrl: params.baseUrl,
        });
      },
    },
    crossmint: {
      requiredEnvVars: ["CROSSMINT_API_KEY"],
      requiredParams: ["walletLocator"],
      optionalParams: ["signer"],
      create: async (params) => {
        const { createCrossmintSigner } =
          await import("@solana/keychain-crossmint");
        return createCrossmintSigner({
          apiKey: this.requireEnv("CROSSMINT_API_KEY"),
          walletLocator: this.requireParam(params, "walletLocator"),
          signer: params.signer,
        });
      },
    },
    dfns: {
      requiredEnvVars: ["DFNS_AUTH_TOKEN", "DFNS_PRIVATE_KEY_PEM"],
      requiredParams: ["credId", "walletId"],
      optionalParams: ["apiBaseUrl"],
      create: async (params) => {
        const { createDfnsSigner } = await import("@solana/keychain-dfns");
        return createDfnsSigner({
          authToken: this.requireEnv("DFNS_AUTH_TOKEN"),
          credId: this.requireParam(params, "credId"),
          privateKeyPem: this.requireEnv("DFNS_PRIVATE_KEY_PEM"),
          walletId: this.requireParam(params, "walletId"),
          apiBaseUrl: params.apiBaseUrl,
        });
      },
    },
    fireblocks: {
      requiredEnvVars: ["FIREBLOCKS_API_KEY", "FIREBLOCKS_PRIVATE_KEY_PEM"],
      requiredParams: ["vaultAccountId"],
      optionalParams: ["assetId"],
      create: async (params) => {
        const { createFireblocksSigner } =
          await import("@solana/keychain-fireblocks");
        return createFireblocksSigner({
          apiKey: this.requireEnv("FIREBLOCKS_API_KEY"),
          privateKeyPem: this.requireEnv("FIREBLOCKS_PRIVATE_KEY_PEM"),
          vaultAccountId: this.requireParam(params, "vaultAccountId"),
          assetId: params.assetId,
        });
      },
    },
    "gcp-kms": {
      requiredEnvVars: [],
      requiredParams: ["keyName", "publicKey"],
      optionalParams: [],
      create: async (params) => {
        const { createGcpKmsSigner } = await import("@solana/keychain-gcp-kms");
        return createGcpKmsSigner({
          keyName: this.requireParam(params, "keyName"),
          publicKey: this.requireParam(params, "publicKey"),
        });
      },
    },
    para: {
      requiredEnvVars: ["PARA_API_KEY"],
      requiredParams: ["walletId"],
      optionalParams: ["apiBaseUrl"],
      create: async (params) => {
        const { createParaSigner } = await import("@solana/keychain-para");
        return createParaSigner({
          apiKey: this.requireEnv("PARA_API_KEY"),
          walletId: this.requireParam(params, "walletId"),
          apiBaseUrl: params.apiBaseUrl,
        });
      },
    },
    privy: {
      requiredEnvVars: ["PRIVY_APP_SECRET"],
      requiredParams: ["appId", "walletId"],
      optionalParams: ["apiBaseUrl"],
      create: async (params) => {
        const { createPrivySigner } = await import("@solana/keychain-privy");
        return createPrivySigner({
          appId: this.requireParam(params, "appId"),
          appSecret: this.requireEnv("PRIVY_APP_SECRET"),
          walletId: this.requireParam(params, "walletId"),
          apiBaseUrl: params.apiBaseUrl,
        });
      },
    },
    turnkey: {
      requiredEnvVars: ["TURNKEY_API_PRIVATE_KEY"],
      requiredParams: [
        "apiPublicKey",
        "organizationId",
        "privateKeyId",
        "publicKey",
      ],
      optionalParams: ["apiBaseUrl"],
      create: async (params) => {
        const { createTurnkeySigner } =
          await import("@solana/keychain-turnkey");
        return createTurnkeySigner({
          apiPublicKey: this.requireParam(params, "apiPublicKey"),
          apiPrivateKey: this.requireEnv("TURNKEY_API_PRIVATE_KEY"),
          organizationId: this.requireParam(params, "organizationId"),
          privateKeyId: this.requireParam(params, "privateKeyId"),
          publicKey: this.requireParam(params, "publicKey"),
          apiBaseUrl: params.apiBaseUrl,
        });
      },
    },
    vault: {
      requiredEnvVars: ["VAULT_TOKEN"],
      requiredParams: ["vaultAddr", "keyName", "publicKey"],
      optionalParams: [],
      create: async (params) => {
        const { createVaultSigner } = await import("@solana/keychain-vault");
        return createVaultSigner({
          vaultAddr: this.requireParam(params, "vaultAddr"),
          vaultToken: this.requireEnv("VAULT_TOKEN"),
          keyName: this.requireParam(params, "keyName"),
          publicKey: this.requireParam(params, "publicKey"),
        });
      },
    },
  };

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

  public static async createSigner(
    config: KeychainConfigData
  ): Promise<SolanaSigner> {
    const def = this.BACKENDS[config.backend];
    if (!def) {
      throw new Error(`Unknown keychain backend: "${config.backend}"`);
    }
    for (const envVar of def.requiredEnvVars) {
      this.requireEnv(envVar);
    }
    return def.create(config.params);
  }

  private static requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  }

  private static requireParam(
    params: Record<string, string>,
    name: string
  ): string {
    const value = params[name];
    if (!value) {
      throw new Error(`Missing required parameter: ${name}`);
    }
    return value;
  }
}
