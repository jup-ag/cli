import { address } from "@solana/kit";
import type { JupiterApi, JupiterDatapi } from "jupiter-api-ts";

type AssetInfo = {
  readonly id: ReturnType<typeof address>;
  readonly decimals: number;
};

export const Asset = {
  SOL: {
    id: address("So11111111111111111111111111111111111111112"),
    decimals: 9,
  },
  BTC: {
    id: address("3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh"),
    decimals: 8,
  },
  ETH: {
    id: address("7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs"),
    decimals: 8,
  },
  USDC: {
    id: address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    decimals: 6,
  },
} as const satisfies Record<string, AssetInfo>;

export type Asset = (typeof Asset)[keyof typeof Asset];

export type Token = {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  usdPrice?: number;
  mcap?: number;
  [key: string]: unknown;
};

export async function searchTokens(params: {
  api: JupiterApi;
  query: string;
  limit?: number;
}): Promise<Token[]> {
  const { api, query, limit } = params;
  const response = await api.tokens.v2.getTokensV2Search({
    query: { query },
  });
  if (response.error || !response.data) {
    throw new Error("Tokens V2 search failed.");
  }
  const tokens = response.data.filter(
    (token): token is Token =>
      typeof token.id === "string" &&
      typeof token.name === "string" &&
      typeof token.symbol === "string" &&
      typeof token.decimals === "number"
  );
  return limit === undefined ? tokens : tokens.slice(0, limit);
}

export async function getTokensByMints(
  datapi: JupiterDatapi,
  mints: string[]
): Promise<Token[]> {
  if (mints.length === 0) {
    return [];
  }
  const batches: string[][] = [];
  for (let i = 0; i < mints.length; i += 100) {
    batches.push(mints.slice(i, i + 100));
  }
  const results = await Promise.all(
    batches.map(async (batch) => {
      const response = await datapi.getAssetsByIds({
        query: { ids: batch.join(",") },
      });
      if (response.error || !response.data) {
        throw new Error("Data API asset lookup failed.");
      }
      return response.data.assets.filter(
        (asset): asset is Token => typeof asset.decimals === "number"
      );
    })
  );
  return results.flat();
}

export async function resolveToken(
  api: JupiterApi,
  queries: string[]
): Promise<Token[]> {
  if (queries.length === 0) {
    throw new Error("Token not found.");
  }

  const tokens = await searchTokens({
    api,
    query: queries.join(","),
    ...(queries.length === 1 ? { limit: 1 } : {}),
  });

  return queries.map((query) => {
    const token = queries.length === 1 ? tokens[0] : matchToken(tokens, query);
    if (!token) {
      throw new Error(`Token not found: ${query}`);
    }
    return token;
  });
}

function matchToken(tokens: Token[], query: string): Token | undefined {
  const lower = query.toLowerCase();
  return (
    tokens.find((token) => token.id === query) ??
    tokens.find((token) => token.symbol.toLowerCase() === lower)
  );
}

export function resolveAsset(name: string): (typeof Asset)[keyof typeof Asset] {
  const key = name.toUpperCase();
  const asset = Asset[key as keyof typeof Asset];
  if (!asset) {
    throw new Error(`Unknown asset: ${name}`);
  }
  return asset;
}
