import { address } from "@solana/kit";

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
