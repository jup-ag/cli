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

export type SpotTrade = {
  type: "buy" | "sell";
  usdVolume: number;
  profit: number;
  cost: number;
  txHash: string;
  assetId: string;
  blockTime: string;
  amount: number;
  price: number;
};

type GetSpotHistoryResponse = {
  userTrades: SpotTrade[];
  next: string | null;
};

export class DatapiClient {
  static readonly #ky = ky.create({
    prefixUrl: ClientConfig.host,
    headers: ClientConfig.headers,
    throwHttpErrors: false,
  });

  public static async getTokensSearch(
    req: GetSearchTokensRequest
  ): Promise<GetSearchTokensResponse> {
    return this.#ky.get("tokens/v2/search", { searchParams: req }).json();
  }

  public static async getSwapsByAddress(params: {
    address: string;
    assetId?: string;
    after?: string;
    before?: string;
    limit?: number;
    offset?: string;
  }): Promise<GetSpotHistoryResponse> {
    const searchParams: Record<string, string | number> = {
      addresses: params.address,
      includeCapitalSide: "true",
    };
    if (params.assetId) {
      searchParams.assetId = params.assetId;
    }
    if (params.after) {
      searchParams.fromTs = params.after;
    }
    if (params.before) {
      searchParams.toTs = params.before;
    }
    if (params.limit) {
      searchParams.limit = Math.min(params.limit, 30);
    }
    if (params.offset) {
      searchParams.offset = params.offset;
    }
    return this.#ky.get("_datapi/v1/txs/users", { searchParams }).json();
  }

  public static async getTokensByMints(mints: string[]): Promise<Token[]> {
    if (mints.length === 0) {
      return [];
    }
    const BATCH_SIZE = 100;
    const batches: string[][] = [];
    for (let i = 0; i < mints.length; i += BATCH_SIZE) {
      batches.push(mints.slice(i, i + BATCH_SIZE));
    }
    const resolved = await Promise.all(
      batches.map((batch) =>
        this.getTokensSearch({
          query: batch.join(","),
          limit: BATCH_SIZE.toString(),
        })
      )
    );
    return resolved.flat();
  }

  public static async resolveToken(input: string): Promise<Token> {
    const [token] = await this.getTokensSearch({
      query: input,
      limit: "1",
    });
    if (!token) {
      throw new Error(`Token not found: ${input}`);
    }
    return token;
  }
}
