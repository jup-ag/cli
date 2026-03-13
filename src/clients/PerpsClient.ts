import ky from "ky";

import { Asset, resolveAsset } from "../lib/Asset.ts";
import { NumberConverter } from "../lib/NumberConverter.ts";

export type MarketStatsResponse = {
  price: string;
  priceChange24H: string;
  priceHigh24H: string;
  priceLow24H: string;
  volume: string;
};

export type TpslRequest = {
  positionRequestPubkey: string;
  requestType: "tp" | "sl";
  triggerPrice: string;
  sizeUsdDelta: string;
  entirePosition: boolean;
};

export type Position = {
  asset: string;
  assetMint: string;
  collateralToken: string;
  collateralMint: string;
  positionPubkey: string;
  side: string;
  leverage: string;
  sizeUsd: string;
  sizeTokenAmount: string;
  collateralUsd: string;
  valueUsd: string;
  entryPriceUsd: string;
  markPriceUsd: string;
  liquidationPriceUsd: string;
  openFeesUsd: string;
  closeFeesUsd: string;
  borrowFeesUsd: string;
  totalFeesUsd: string;
  pnlBeforeFeesUsd: string;
  pnlBeforeFeesPct: string;
  pnlAfterFeesUsd: string;
  pnlAfterFeesPct: string;
  createdTime: number;
  updatedTime: number;
  tpslRequests: TpslRequest[];
};

export type GetPositionsResponse = {
  count: number;
  dataList: Position[];
};

export type LimitOrder = {
  collateralMint: string;
  collateralUsd: string;
  collateralTokenAmount: string;
  custody: string;
  executed: boolean;
  inputMint: string;
  liquidationPriceUsd: string;
  marketMint: string;
  openTime: string;
  positionPubkey: string;
  positionRequestPubkey: string;
  side: string;
  sizeUsdDelta: string;
  triggerPrice: string;
};

export type GetLimitOrdersResponse = {
  count: number;
  dataList: LimitOrder[];
};

export type TxMetadata = {
  blockhash: string;
  lastValidBlockHeight: string;
  transactionFeeLamports?: string;
  accountRentLamports?: string;
};

export type IncreasePositionQuote = {
  averagePriceUsd: string;
  collateralUsdDelta: string;
  leverage: string;
  liquidationPriceUsd: string;
  openFeeUsd: string;
  positionCollateralUsd: string;
  positionSizeUsd: string;
  priceImpactFeeBps: string;
  priceImpactFeeUsd: string;
  side: string;
  sizeUsdDelta: string;
  sizeTokenDelta: string;
};

export type IncreasePositionResponse = {
  positionPubkey: string;
  quote: IncreasePositionQuote;
  serializedTxBase64: string;
  tpsl?: {
    hasProfit: boolean;
    pnlUsd: string;
    pnlPercent: string;
    pubkey: string;
    requestType: string;
  }[];
  txMetadata: TxMetadata;
};

export type DecreasePositionQuote = {
  closeFeeUsd: string;
  collateralUsdDelta: string;
  leverage: string;
  liquidationPriceUsd: string;
  pnlAfterFeesUsd: string;
  pnlAfterFeesPercent: string;
  pnlBeforeFeesUsd: string;
  pnlBeforeFeesPercent: string;
  positionCollateralUsd: string;
  positionSizeUsd: string;
  priceImpactFeeBps: string;
  priceImpactFeeUsd: string;
  side: string;
  sizeUsdDelta: string;
  totalFeeUsd: string;
  transferAmountToken: string;
  transferAmountUsd: string;
  transferTokenMint: string;
};

export type DecreasePositionResponse = {
  positionPubkey: string;
  quote: DecreasePositionQuote;
  serializedTxBase64: string;
  txMetadata: TxMetadata;
};

export type CloseAllResponse = {
  serializedTxs: {
    serializedTxBase64: string;
    positionRequestPubkey: string;
  }[];
  txMetadata: TxMetadata;
};

export type LimitOrderResponse = {
  positionPubkey: string;
  quote: IncreasePositionQuote;
  serializedTxBase64: string;
  txMetadata: TxMetadata;
};

export type TpslResponse = {
  tpslPubkeys: string[];
  requireKeeperSignature: boolean;
  serializedTxBase64: string;
  tpslRequests: {
    estimatedPnlUsd: string;
    estimatedPnlPercent: string;
    hasProfit: boolean;
    requestType: string;
    positionRequestPubkey: string;
  }[];
  transactionType: string;
  txMetadata: TxMetadata;
};

export type CancelResponse = {
  serializedTxBase64: string;
  txMetadata: TxMetadata;
  positionPubkey?: string;
  positionRequestPubkey?: string;
  requireKeeperSignature?: boolean;
};

export type ExecuteResponse = {
  action: string;
  txid: string;
};

export class PerpsClient {
  static readonly #BASE_URL = "https://perps-api.jup.ag/v2";

  public static toUsdRaw(amount: string): string {
    return NumberConverter.toChainAmount(amount, Asset.USDC.decimals);
  }

  public static fromUsdRaw(amount: string): string {
    return NumberConverter.fromChainAmount(amount, Asset.USDC.decimals);
  }

  public static async getMarkets(): Promise<
    ({ asset: string } & MarketStatsResponse)[]
  > {
    return Promise.all(
      ["SOL", "BTC", "ETH"].map(async (asset) => {
        const mint = resolveAsset(asset).id;
        const stats: MarketStatsResponse = await ky
          .get(`${this.#BASE_URL}/market-stats`, { searchParams: { mint } })
          .json();
        return { asset, ...stats };
      })
    );
  }

  public static async getPositions(
    walletAddress: string
  ): Promise<GetPositionsResponse> {
    return ky
      .get(`${this.#BASE_URL}/positions`, {
        searchParams: { walletAddress },
      })
      .json();
  }

  public static async getLimitOrders(
    walletAddress: string
  ): Promise<GetLimitOrdersResponse> {
    return ky
      .get(`${this.#BASE_URL}/orders/limit`, {
        searchParams: { walletAddress },
      })
      .json();
  }

  public static async postIncreasePosition(req: {
    asset: string;
    inputToken: string;
    inputTokenAmount?: string;
    side: string;
    maxSlippageBps: string;
    leverage?: string;
    sizeUsdDelta?: string;
    walletAddress: string;
    tpsl?: { triggerPrice: string; requestType: string }[];
  }): Promise<IncreasePositionResponse> {
    return ky
      .post(`${this.#BASE_URL}/positions/increase`, { json: req })
      .json();
  }

  public static async postDecreasePosition(req: {
    positionPubkey: string;
    receiveToken: string;
    sizeUsdDelta?: string;
    entirePosition?: boolean;
    maxSlippageBps: string;
  }): Promise<DecreasePositionResponse> {
    return ky
      .post(`${this.#BASE_URL}/positions/decrease`, { json: req })
      .json();
  }

  public static async postCloseAll(
    walletAddress: string
  ): Promise<CloseAllResponse> {
    return ky
      .post(`${this.#BASE_URL}/positions/close-all`, {
        json: { walletAddress },
      })
      .json();
  }

  public static async postLimitOrder(req: {
    asset: string;
    inputToken: string;
    inputTokenAmount?: string;
    side: string;
    triggerPrice: string;
    leverage?: string;
    sizeUsdDelta?: string;
    walletAddress: string;
  }): Promise<LimitOrderResponse> {
    return ky.post(`${this.#BASE_URL}/orders/limit`, { json: req }).json();
  }

  public static async patchLimitOrder(req: {
    positionRequestPubkey: string;
    triggerPrice: string;
  }): Promise<LimitOrderResponse> {
    return ky.patch(`${this.#BASE_URL}/orders/limit`, { json: req }).json();
  }

  public static async deleteLimitOrder(
    positionRequestPubkey: string
  ): Promise<CancelResponse> {
    return ky
      .delete(`${this.#BASE_URL}/orders/limit`, {
        json: { positionRequestPubkey },
      })
      .json();
  }

  public static async postTpsl(req: {
    walletAddress: string;
    positionPubkey: string;
    tpsl: {
      receiveToken: string;
      triggerPrice: string;
      requestType: string;
      entirePosition: boolean;
    }[];
  }): Promise<TpslResponse> {
    return ky.post(`${this.#BASE_URL}/tpsl`, { json: req }).json();
  }

  public static async patchTpsl(req: {
    positionRequestPubkey: string;
    triggerPrice: string;
  }): Promise<TpslResponse> {
    return ky.patch(`${this.#BASE_URL}/tpsl`, { json: req }).json();
  }

  public static async deleteTpsl(
    positionRequestPubkey: string
  ): Promise<CancelResponse> {
    return ky
      .delete(`${this.#BASE_URL}/tpsl`, {
        json: { positionRequestPubkey },
      })
      .json();
  }

  public static async postExecute(req: {
    action: string;
    serializedTxBase64: string;
  }): Promise<ExecuteResponse> {
    return ky
      .post(`${this.#BASE_URL}/transaction/execute`, { json: req })
      .json();
  }
}
