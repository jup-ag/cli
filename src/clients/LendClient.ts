import ky from "ky";

import { ClientConfig } from "./ClientConfig.ts";

export type LendAsset = {
  address: string;
  chain_id: string;
  name: string;
  symbol: string;
  decimals: number;
  logo_url: string;
  price: string;
  coingecko_id: string;
};

export type LiquiditySupplyData = {
  modeWithInterest: boolean;
  supply: string;
  withdrawalLimit: string;
  lastUpdateTimestamp: string;
  expandPercent: string;
  expandDuration: string;
  baseWithdrawalLimit: string;
  withdrawableUntilLimit: string;
  withdrawable: string;
};

export type LendToken = {
  id: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  assetAddress: string;
  asset: LendAsset;
  totalAssets: string;
  totalSupply: string;
  convertToShares: string;
  convertToAssets: string;
  rewardsRate: string;
  supplyRate: string;
  totalRate: string;
  rebalanceDifference: string;
  liquiditySupplyData: LiquiditySupplyData;
};

export type LendPosition = {
  token: LendToken;
  ownerAddress: string;
  shares: string;
  underlyingAssets: string;
  underlyingBalance: string;
  allowance: string;
};

export type LendEarning = {
  address: string;
  ownerAddress: string;
  earnings: number;
  slot: number;
};

export class LendClient {
  static readonly #ky = ky.create({
    prefixUrl: `${ClientConfig.host}/lend/v1`,
    headers: ClientConfig.headers,
  });

  public static async getTokens(): Promise<LendToken[]> {
    return this.#ky.get("earn/tokens").json();
  }

  public static async getPositions(users: string): Promise<LendPosition[]> {
    return this.#ky.get("earn/positions", { searchParams: { users } }).json();
  }

  public static async getEarnings(req: {
    user: string;
    positions: string;
  }): Promise<LendEarning[]> {
    return this.#ky.get("earn/earnings", { searchParams: req }).json();
  }
}
