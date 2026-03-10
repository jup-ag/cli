import type { Base64EncodedBytes } from "@solana/kit";
import ky from "ky";

type GetOrderRequest = {
  inputMint: string;
  outputMint: string;
  amount: string;
  taker?: string | undefined;
};

export type GetOrderResponse = {
  error?: string | undefined;
  errorCode?: number | undefined;
  errorMessage?: string | undefined;
  requestId: string;
  inAmount: string;
  inUsdValue: number;
  outAmount: string;
  outUsdValue: number;
  otherAmountThreshold: string;
  priceImpact: number;
  taker: string | null;
  transaction: "" | Base64EncodedBytes; // empty string denotes invalid transaction
  router: string;
  platformFee: {
    feeBps: number;
  };
  gasless?: boolean | undefined;
  prioritizationFeePayer?: string | undefined;
  prioritizationFeeLamports?: number | undefined;
  rentFeePayer?: string | undefined;
  rentFeeLamports?: number | undefined;
  signatureFeePayer?: string | undefined;
  signatureFeeLamports?: number | undefined;
};

export type PostExecuteRequest = {
  requestId: string;
  signedTransaction: string;
};

export type PostExecuteResponse = {
  code: number;
  inputAmountResult: string;
  outputAmountResult: string;
  signature: string;
};

export class UltraClient {
  static readonly #BASE_URL = "https://lite-api.jup.ag/ultra/v1";
  static readonly #ATTRIBUTION_HEADER = {
    "x-client-platform": "jupiter.cli",
  } as const;

  public static async getOrder(
    params: GetOrderRequest
  ): Promise<GetOrderResponse> {
    return ky
      .get(`${this.#BASE_URL}/order`, {
        searchParams: params,
        throwHttpErrors: false,
        headers: this.#ATTRIBUTION_HEADER,
      })
      .json();
  }

  public static async postExecute(req: PostExecuteRequest) {
    return ky
      .post<PostExecuteResponse>(`${this.#BASE_URL}/execute`, {
        json: req,
        headers: this.#ATTRIBUTION_HEADER,
      })
      .json();
  }
}
