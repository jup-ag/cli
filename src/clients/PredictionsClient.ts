import ky, { type SearchParamsOption } from "ky";

import { ClientConfig } from "./ClientConfig.ts";

export type EventMetadata = {
  eventId: string;
  title: string;
  subtitle: string;
  slug: string;
  series: string;
  closeTime: string;
  imageUrl: string;
  isLive: boolean;
};

export type MarketPricing = {
  buyYesPriceUsd: number | null;
  buyNoPriceUsd: number | null;
  sellYesPriceUsd: number | null;
  sellNoPriceUsd: number | null;
  volume: number;
};

export type Market = {
  marketId: string;
  title: string;
  status: "open" | "closed" | "cancelled";
  result: "yes" | "no" | null;
  openTime: number;
  closeTime: number;
  isTeamMarket: boolean;
  rulesPrimary: string;
  rulesSecondary: string;
  resolveAt: number | null;
  marketResultPubkey: string | null;
  imageUrl: string | null;
  pricing: MarketPricing;
};

export type PredictionEvent = {
  eventId: string;
  isActive: boolean;
  isLive: boolean;
  category: string;
  subcategory: string;
  tags: string[];
  metadata: EventMetadata;
  markets: Market[];
  volumeUsd: string;
  closeCondition: string;
  beginAt: string | null;
  rulesPdf: string;
};

export type Pagination = {
  start: number;
  end: number;
  total: number;
  hasNext: boolean;
};

export type GetEventsResponse = {
  data: PredictionEvent[];
  pagination: Pagination;
};

export type PredictionPosition = {
  pubkey: string;
  ownerPubkey: string;
  marketId: string;
  isYes: boolean;
  contracts: string;
  totalCostUsd: number;
  valueUsd: number;
  pnlUsd: number;
  pnlUsdPercent: number;
  claimed: boolean;
  claimedUsd: number;
  openedAt: string;
  updatedAt: string;
  eventMetadata: { title: string };
  marketMetadata: {
    title: string;
    status: string;
    result: "yes" | "no" | null;
  };
};

export type GetPositionsResponse = {
  data: PredictionPosition[];
  pagination: Pagination;
};

export type OrderDetails = {
  orderPubkey: string;
  orderAtaPubkey: string;
  userPubkey: string;
  marketId: string;
  marketIdHash: string;
  positionPubkey: string;
  isBuy: boolean;
  isYes: boolean;
  contracts: string;
  newContracts: string;
  maxBuyPriceUsd: string | null;
  minSellPriceUsd: string | null;
  externalOrderId: string;
  orderCostUsd: string;
  newAvgPriceUsd: string;
  newSizeUsd: string;
  newPayoutUsd: string;
  estimatedProtocolFeeUsd: string;
  estimatedVenueFeeUsd: string;
  estimatedIntegratorFeeUsd: string;
  estimatedTotalFeeUsd: string;
};

export type CreateOrderResponse = {
  transaction: string;
  txMeta: { blockhash: string; lastValidBlockHeight: string };
  externalOrderId: string;
  requiredSigners: string[];
  order: OrderDetails;
};

export type ExecuteOrderResponse = {
  signature: string;
};

export type ClaimPositionResponse = {
  transaction: string;
  txMeta: { blockhash: string; lastValidBlockHeight: string };
  position: {
    positionPubkey: string;
    marketPubkey: string;
    userPubkey: string;
    ownerPubkey: string;
    isYes: boolean;
    contracts: string;
    payoutAmountUsd: string;
  };
};

export type CloseAllPositionsResponse = {
  data: (CreateOrderResponse | ClaimPositionResponse)[];
};

export type HistoryEvent = {
  id: number;
  eventType: string;
  signature: string;
  slot: string;
  timestamp: number;
  orderPubkey: string;
  positionPubkey: string;
  marketId: string;
  ownerPubkey: string;
  keeperPubkey: string;
  isBuy: boolean;
  isYes: boolean;
  contracts: string;
  filledContracts: string;
  maxFillPriceUsd: string;
  avgFillPriceUsd: string;
  realizedPnl: string | null;
  payoutAmountUsd: string;
  marketMetadata: {
    title: string;
    status: string;
    result: string | null;
  };
  eventMetadata: {
    title: string;
    subtitle: string;
    slug: string;
    imageUrl: string;
    isLive: boolean;
  };
};

export type GetHistoryResponse = {
  data: HistoryEvent[];
  pagination: Pagination;
};

export class PredictionsClient {
  static readonly #ky = ky.create({
    prefixUrl: `${ClientConfig.host}/prediction/v1`,
    headers: ClientConfig.headers,
  });

  public static async searchEvents(params: {
    query: string;
    start?: number;
    end?: number;
  }): Promise<{ data: PredictionEvent[] }> {
    const searchParams: SearchParamsOption = {
      query: params.query,
      includeMarkets: true,
    };
    if (params.start !== undefined) {
      searchParams.start = params.start;
    }
    if (params.end !== undefined) {
      searchParams.end = params.end;
    }
    return this.#ky.get("events/search", { searchParams }).json();
  }

  public static async getEvent(eventId: string): Promise<PredictionEvent> {
    return this.#ky
      .get(`events/${eventId}`, { searchParams: { includeMarkets: true } })
      .json();
  }

  public static async getEvents(params: {
    filter?: string;
    sortBy?: string;
    sortDirection?: string;
    category?: string;
    start?: number;
    end?: number;
  }): Promise<GetEventsResponse> {
    const searchParams: Record<string, string | number | boolean> = {
      includeMarkets: true,
    };
    if (params.filter) {
      searchParams.filter = params.filter;
    }
    if (params.sortBy) {
      searchParams.sortBy = params.sortBy;
    }
    if (params.sortDirection) {
      searchParams.sortDirection = params.sortDirection;
    }
    if (params.category) {
      searchParams.category = params.category;
    }
    if (params.start !== undefined) {
      searchParams.start = params.start;
    }
    if (params.end !== undefined) {
      searchParams.end = params.end;
    }
    return this.#ky.get("events", { searchParams }).json();
  }

  public static async getPositions(
    ownerPubkey: string
  ): Promise<GetPositionsResponse> {
    return this.#ky.get("positions", { searchParams: { ownerPubkey } }).json();
  }

  public static async getPosition(
    positionPubkey: string
  ): Promise<PredictionPosition> {
    return this.#ky.get(`positions/${positionPubkey}`).json();
  }

  public static async postOrder(req: {
    isBuy: boolean;
    ownerPubkey: string;
    marketId: string;
    isYes: boolean;
    depositAmount: string;
    depositMint?: string;
  }): Promise<CreateOrderResponse> {
    return this.#ky
      .post("orders", { json: { ...req, skipSigning: true } })
      .json();
  }

  public static async postExecute(req: {
    signedTransaction: string;
  }): Promise<ExecuteOrderResponse> {
    return this.#ky.post("orders/execute", { json: req }).json();
  }

  public static async closePosition(
    positionPubkey: string,
    ownerPubkey: string
  ): Promise<CreateOrderResponse> {
    return this.#ky
      .delete(`positions/${positionPubkey}`, { json: { ownerPubkey } })
      .json();
  }

  public static async closeAllPositions(
    ownerPubkey: string
  ): Promise<CloseAllPositionsResponse> {
    return this.#ky
      .delete("positions", {
        json: { ownerPubkey, minSellPriceSlippageBps: 200 },
      })
      .json();
  }

  public static async getHistory(params: {
    ownerPubkey: string;
    start?: number;
    end?: number;
  }): Promise<GetHistoryResponse> {
    const searchParams: Record<string, string | number> = {
      ownerPubkey: params.ownerPubkey,
    };
    if (params.start !== undefined) {
      searchParams.start = params.start;
    }
    if (params.end !== undefined) {
      searchParams.end = params.end;
    }
    return this.#ky.get("history", { searchParams }).json();
  }

  public static async claimPosition(
    positionPubkey: string,
    ownerPubkey: string
  ): Promise<ClaimPositionResponse> {
    return this.#ky
      .post(`positions/${positionPubkey}/claim`, { json: { ownerPubkey } })
      .json();
  }
}
