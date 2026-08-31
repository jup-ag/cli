import { address } from "@solana/kit";
import type { JupiterDatapi, JupiterDatapiTypes } from "jupiter-api-ts";

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

export type Token = JupiterDatapiTypes.Asset & { decimals: number };

export async function searchTokens(params: {
  datapi: JupiterDatapi;
  query: string;
  limit?: number;
}): Promise<Token[]> {
  const { datapi, ...query } = params;
  const response = await datapi.searchAssets({ query });
  if (response.error || !response.data) {
    throw new Error("Data API token search failed.");
  }
  return response.data.filter(
    (asset): asset is Token => typeof asset.decimals === "number"
  );
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
  datapi: JupiterDatapi,
  input: string
): Promise<Token> {
  const [token] = await searchTokens({ datapi, query: input, limit: 1 });
  if (!token) {
    throw new Error(`Token not found: ${input}`);
  }
  return token;
}

export function resolveAsset(name: string): (typeof Asset)[keyof typeof Asset] {
  const key = name.toUpperCase();
  const asset = Asset[key as keyof typeof Asset];
  if (!asset) {
    throw new Error(`Unknown asset: ${name}`);
  }
  return asset;
}
