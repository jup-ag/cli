import { address, isAddress } from "@solana/kit";

import { DatapiClient, type Token } from "../clients/DatapiClient.ts";
import { UltraClient } from "../clients/UltraClient.ts";

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

export function resolveAsset(name: string): (typeof Asset)[keyof typeof Asset] {
  const key = name.toUpperCase();
  const asset = Asset[key as keyof typeof Asset];
  if (!asset) {
    throw new Error(`Unknown asset: ${name}`);
  }
  return asset;
}

export async function resolveWalletAsset(
  walletAddress: string,
  asset: string
): Promise<Token> {
  if (isAddress(asset)) {
    return DatapiClient.resolveToken(asset);
  }

  const key = asset.toUpperCase();
  // Prevent full holdings lookup for well-known tokens
  if (key in Asset) {
    return DatapiClient.resolveToken(Asset[key as keyof typeof Asset].id);
  }

  const holdings = await UltraClient.getHoldings(walletAddress);
  const mints = Object.keys(holdings.tokens);
  if (BigInt(holdings.amount) > 0n && !mints.includes(Asset.SOL.id)) {
    mints.push(Asset.SOL.id);
  }
  const tokens = await DatapiClient.getTokensByMints(mints);
  const query = asset.toLowerCase();
  const matches = tokens.filter((t) => t.symbol.toLowerCase() === query);

  if (matches.length === 0) {
    throw new Error(`Token "${asset}" not found in wallet.`);
  }
  if (matches.length === 1) {
    return matches[0]!;
  }
  const options = matches.map((t) => `  - ${t.symbol} (${t.id})`).join("\n");
  throw new Error(
    `Multiple tokens matching "${asset}" found in wallet. Use the mint address instead:\n${options}`
  );
}
