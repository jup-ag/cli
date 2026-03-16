import ky from "ky";

import { Asset, resolveAsset } from "../lib/Asset.ts";
import { NumberConverter } from "../lib/NumberConverter.ts";
import { ClientConfig } from "./ClientConfig.ts";

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
  desiredMint: string;
  desiredToken: string;
  collateralUsdDelta: string;
  entirePosition: boolean;
  sizeUsd: string;
  sizePercentage: string;
  triggerPriceUsd: string | null;
  openTime: string;
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
  collateralCustody: string;
  collateralUsd: string;
  collateralUsdAtTriggerPrice: string;
  collateralTokenAmount: string;
  custody: string;
  executed: boolean;
  inputMint: string;
  liquidationPriceUsd: string;
  marketMint: string;
  maxSizeUsdDelta: string;
  minSizeUsdDelta: string;
  openTime: string;
  positionPubkey: string;
  positionRequestPubkey: string;
  side: string;
  sizeUsdDelta: string;
  triggerPrice: string | null;
  triggerToLiquidationPercent: string | null;
};

export type GetLimitOrdersResponse = {
  count: number;
  dataList: LimitOrder[];
};

export type Trade = {
  action: "Increase" | "Decrease";
  collateralUsdDelta: string;
  createdTime: number;
  baseFee: string;
  borrowFee: string;
  liquidationFee: string;
  priceImpactFee: string;
  fee: string;
  integratorFeeTokenAmount: string;
  integratorFeeTokenMint: string | null;
  mint: string;
  orderType: string;
  owner: string;
  pnl: string | null;
  pnlPercentage: string | null;
  positionName: string;
  positionPubkey: string;
  price: string;
  side: "long" | "short";
  size: string;
  transactionFeeLamports: string;
  priorityFeeLamports: string;
  swapFeeBps: string | null;
  swapFeeUsd: string | null;
  swapFeeTokenAmount: string | null;
  swapFeeTokenMint: string | null;
  txHash: string;
  updatedTime: number;
};

export type GetTradesResponse = {
  count: number;
  dataList: Trade[];
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
  outstandingBorrowFeeUsd: string;
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
  outstandingBorrowFeeUsd: string;
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
  positionPubkey: string | null;
  positionRequestPubkey?: string | null;
  quote: IncreasePositionQuote;
  serializedTxBase64: string | null;
  txMetadata: TxMetadata | null;
};

export type TpslResponse = {
  tpslPubkeys?: string[];
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
  positionPubkey?: string | null;
  positionRequestPubkey?: string | null;
  requireKeeperSignature?: boolean | null;
  transactionType?: string;
};

export type ExecuteResponse = {
  action: string;
  txid: string;
};

export class PerpsClient {
  static readonly #ky = ky.create({
    prefixUrl: "https://perps-api.jup.ag/v2",
    headers: ClientConfig.headers,
  });

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
        const stats: MarketStatsResponse = await this.#ky
          .get("market-stats", { searchParams: { mint } })
          .json();
        return { asset, ...stats };
      })
    );
  }

  public static async getPositions(
    walletAddress: string
  ): Promise<GetPositionsResponse> {
    return this.#ky
      .get("positions", { searchParams: { walletAddress } })
      .json();
  }

  public static async getLimitOrders(
    walletAddress: string
  ): Promise<GetLimitOrdersResponse> {
    return this.#ky
      .get("orders/limit", { searchParams: { walletAddress } })
      .json();
  }

  public static async getTrades(params: {
    walletAddress: string;
    action?: string;
    mint?: string;
    side?: string;
    start?: number;
    end?: number;
    createdAtAfter?: string;
    createdAtBefore?: string;
  }): Promise<GetTradesResponse> {
    const searchParams: Record<string, string | number> = {
      walletAddress: params.walletAddress,
    };
    if (params.action) {
      searchParams.action = params.action;
    }
    if (params.mint) {
      searchParams.mint = params.mint;
    }
    if (params.side) {
      searchParams.side = params.side;
    }
    if (params.start !== undefined) {
      searchParams.start = params.start;
    }
    if (params.end !== undefined) {
      searchParams.end = params.end;
    }
    if (params.createdAtAfter) {
      searchParams.createdAtAfter = params.createdAtAfter;
    }
    if (params.createdAtBefore) {
      searchParams.createdAtBefore = params.createdAtBefore;
    }
    return this.#ky.get("trades", { searchParams }).json();
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
    tpsl?: {
      receiveToken: string;
      triggerPrice: string;
      requestType: string;
    }[];
  }): Promise<IncreasePositionResponse> {
    return this.#ky.post("positions/increase", { json: req }).json();
  }

  public static async postDecreasePosition(req: {
    positionPubkey: string;
    receiveToken: string;
    sizeUsdDelta?: string;
    entirePosition?: boolean;
    maxSlippageBps: string;
  }): Promise<DecreasePositionResponse> {
    return this.#ky.post("positions/decrease", { json: req }).json();
  }

  public static async postCloseAll(
    walletAddress: string
  ): Promise<CloseAllResponse> {
    return this.#ky
      .post("positions/close-all", { json: { walletAddress } })
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
    return this.#ky.post("orders/limit", { json: req }).json();
  }

  public static async patchLimitOrder(req: {
    positionRequestPubkey: string;
    triggerPrice: string;
  }): Promise<LimitOrderResponse> {
    return this.#ky.patch("orders/limit", { json: req }).json();
  }

  public static async deleteLimitOrder(
    positionRequestPubkey: string
  ): Promise<CancelResponse> {
    return this.#ky
      .delete("orders/limit", { json: { positionRequestPubkey } })
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
      sizeUsdDelta?: string;
    }[];
  }): Promise<TpslResponse> {
    return this.#ky.post("tpsl", { json: req }).json();
  }

  public static async patchTpsl(req: {
    positionRequestPubkey: string;
    triggerPrice: string;
  }): Promise<TpslResponse> {
    return this.#ky.patch("tpsl", { json: req }).json();
  }

  public static async deleteTpsl(
    positionRequestPubkey: string
  ): Promise<CancelResponse> {
    return this.#ky.delete("tpsl", { json: { positionRequestPubkey } }).json();
  }

  public static async postExecute(req: {
    action: string;
    serializedTxBase64: string;
  }): Promise<ExecuteResponse> {
    return this.#ky.post("transaction/execute", { json: req }).json();
  }
}
