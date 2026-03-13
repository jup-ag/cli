import ky from "ky";

import { ClientConfig } from "./ClientConfig.ts";

export type SwapStats = {
  priceChange?: number | undefined;
  holderChange?: number | undefined;
  liquidityChange?: number | undefined;
  volumeChange?: number | undefined;
  buyVolume?: number | undefined;
  sellVolume?: number | undefined;
  buyOrganicVolume?: number | undefined;
  sellOrganicVolume?: number | undefined;
  numBuys?: number | undefined;
  numSells?: number | undefined;
  numTraders?: number | undefined;
  numOrganicBuyers?: number | undefined;
};

export type Token = {
  id: string;
  name: string;
  symbol: string;
  icon?: string | undefined;
  decimals: number;
  twitter?: string | undefined;
  telegram?: string | undefined;
  website?: string | undefined;
  dev?: string | undefined;
  circSupply?: number | undefined;
  totalSupply?: number | undefined;
  tokenProgram: string;
  launchpad?: string | undefined;
  graduatedPool?: string | undefined;
  holderCount?: number | undefined;
  fdv?: number | undefined;
  mcap?: number | undefined;
  usdPrice?: number | undefined;
  liquidity?: number | undefined;
  stats5m?: SwapStats | undefined;
  stats1h?: SwapStats | undefined;
  stats6h?: SwapStats | undefined;
  stats24h?: SwapStats | undefined;
  firstPool?:
    | {
        id: string;
        createdAt: string;
      }
    | undefined;
  audit?:
    | {
        mintAuthorityDisabled: boolean | undefined;
        freezeAuthorityDisabled: boolean | undefined;
        topHoldersPercentage: number | undefined;
        lpBurnedPercentage: number | undefined;
        knownRugger: boolean | undefined;
        knownRuggerTopHolder: boolean | undefined;
        soulBound: boolean | undefined;
        permanentControlEnabled: boolean | undefined;
        highSingleOwnership: boolean | undefined;
        mutableFees: boolean | undefined;
      }
    | undefined;
  scaledUiConfig?:
    | {
        multiplier: number;
        newMultiplier: number;
        newMultiplierEffectiveAt: string;
        circSupplyPrescaled: number;
        totalSupplyPrescaled: number;
        usdPricePrescaled: number;
      }
    | undefined;
  organicScore: number;
  organicScoreLabel: "high" | "medium" | "low";
  ctLikes?: number | undefined;
  smartCtLikes?: number | undefined;
  isVerified?: boolean | undefined;
  cexes?: string[] | undefined;
  tags?: string[] | undefined;
  stockData?: { id: string } | undefined;
  apy?:
    | {
        jupEarn?: number | undefined;
      }
    | undefined;
};

type GetSearchTokensRequest = {
  query: string;
  filters?: string | undefined;
  limit?: string | undefined;
  sortBy?: string | undefined;
};

type GetSearchTokensResponse = Token[];

export class DatapiClient {
  static readonly #ky = ky.create({
    prefixUrl: `${ClientConfig.host}/tokens/v2`,
    headers: ClientConfig.headers,
    throwHttpErrors: false,
  });

  public static async search(
    req: GetSearchTokensRequest
  ): Promise<GetSearchTokensResponse> {
    return this.#ky.get("search", { searchParams: req }).json();
  }
}
