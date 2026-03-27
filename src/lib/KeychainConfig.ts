import type { SolanaSigner } from "@solana/keychain";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Config } from "./Config.ts";

export type KeychainBackend =
  | "aws-kms"
  | "crossmint"
  | "fireblocks"
  | "gcp-kms"
  | "para"
  | "privy"
  | "turnkey"
  | "vault";

export type KeychainConfig = {
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireParam(params: Record<string, string>, name: string): string {
  const value = params[name];
  if (!value) {
    throw new Error(`Missing required parameter: ${name}`);
  }
  return value;
}

export const BACKEND_REGISTRY: Record<KeychainBackend, BackendDef> = {
  "aws-kms": {
    requiredEnvVars: [],
    requiredParams: ["keyId", "publicKey"],
    optionalParams: ["region"],
    create: async (params) => {
      const { createAwsKmsSigner } = await import("@solana/keychain-aws-kms");
      return createAwsKmsSigner({
        keyId: requireParam(params, "keyId"),
        publicKey: requireParam(params, "publicKey"),
        region: params.region,
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
        apiKey: requireEnv("CROSSMINT_API_KEY"),
        walletLocator: requireParam(params, "walletLocator"),
        signer: params.signer,
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
        apiKey: requireEnv("FIREBLOCKS_API_KEY"),
        privateKeyPem: requireEnv("FIREBLOCKS_PRIVATE_KEY_PEM"),
        vaultAccountId: requireParam(params, "vaultAccountId"),
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
        keyName: requireParam(params, "keyName"),
        publicKey: requireParam(params, "publicKey"),
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
        apiKey: requireEnv("PARA_API_KEY"),
        walletId: requireParam(params, "walletId"),
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
        appId: requireParam(params, "appId"),
        appSecret: requireEnv("PRIVY_APP_SECRET"),
        walletId: requireParam(params, "walletId"),
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
      const { createTurnkeySigner } = await import("@solana/keychain-turnkey");
      return createTurnkeySigner({
        apiPublicKey: requireParam(params, "apiPublicKey"),
        apiPrivateKey: requireEnv("TURNKEY_API_PRIVATE_KEY"),
        organizationId: requireParam(params, "organizationId"),
        privateKeyId: requireParam(params, "privateKeyId"),
        publicKey: requireParam(params, "publicKey"),
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
        vaultAddr: requireParam(params, "vaultAddr"),
        vaultToken: requireEnv("VAULT_TOKEN"),
        keyName: requireParam(params, "keyName"),
        publicKey: requireParam(params, "publicKey"),
      });
    },
  },
};

export function keychainConfigPath(name: string): string {
  return join(Config.KEYS_DIR, `${name}.keychain.json`);
}

export function isKeychainKey(name: string): boolean {
  return existsSync(keychainConfigPath(name));
}

export function loadKeychainConfig(name: string): KeychainConfig {
  const path = keychainConfigPath(name);
  if (!existsSync(path)) {
    throw new Error(`Keychain config "${name}" does not exist.`);
  }
  return JSON.parse(readFileSync(path, "utf-8")) as KeychainConfig;
}

export function saveKeychainConfig(name: string, config: KeychainConfig): void {
  writeFileSync(keychainConfigPath(name), JSON.stringify(config, null, 2));
}

export async function createKeychainSigner(
  config: KeychainConfig
): Promise<SolanaSigner> {
  const def = BACKEND_REGISTRY[config.backend];
  if (!def) {
    throw new Error(`Unknown keychain backend: "${config.backend}"`);
  }
  for (const envVar of def.requiredEnvVars) {
    requireEnv(envVar);
  }
  return def.create(config.params);
}
