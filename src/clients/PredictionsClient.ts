import ky from "ky";

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

export type MarketMetadata = {
  marketId: string;
  title: string;
  status: string;
  result: string;
  closeTime: number;
  openTime: number;
  isTeamMarket: boolean;
  rulesPrimary: string;
  rulesSecondary: string;
};

export type Market = {
  marketId: string;
  status: "open" | "closed" | "cancelled";
  result: "yes" | "no" | null;
  openTime: number;
  closeTime: number;
  resolveAt: number | null;
  marketResultPubkey: string | null;
  imageUrl: string | null;
  metadata: MarketMetadata;
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

export class PredictionsClient {
  static readonly #ky = ky.create({
    prefixUrl: `${ClientConfig.host}/prediction/v1`,
    headers: ClientConfig.headers,
  });

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
}
