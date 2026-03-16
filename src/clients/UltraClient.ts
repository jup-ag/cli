import type { Address, Base64EncodedBytes } from "@solana/kit";
import ky from "ky";

import { ClientConfig } from "./ClientConfig.ts";

type GetOrderRequest = {
  inputMint: string;
  outputMint: string;
  amount: string;
  taker?: string | undefined;
  slippageBps?: number | undefined;
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

export type HoldingsTokenAccount = {
  account: string;
  amount: string;
  uiAmount: number;
  uiAmountString: string;
  isFrozen: boolean;
  isAssociatedTokenAccount: boolean;
  decimals: number;
  programId: string;
};

export type GetHoldingsResponse = {
  amount: string;
  uiAmount: number;
  uiAmountString: string;
  tokens: Record<string, HoldingsTokenAccount[]>;
};

type GetTransferTokenTxRequest = {
  senderAddress: Address;
  senderTokenAccountAddress: Address;
  receiverAddress: Address;
  receiverTokenAccountAddress?: Address; // If present, `receiverAddress` will be ignored and sending to non-initialised ATAs won't work
  amount: string;
  mint: string;
  tokenDecimals: string;
  tokenProgramId: string;
};

type GetTransferSolTxRequest = {
  senderAddress: Address;
  receiverAddress: Address;
  amount: string;
};

type GetTransferTxResponse =
  | {
      requestId: string;
      transaction: string; // base64 encoded wire tx
      expireAt: string;
      feeAmount: number;
      feeUsdAmount: number;
    }
  | {
      error: string;
    };

type PostExecuteTransferRequest = {
  requestId: string;
  signedTransaction: string;
};

type PostExecuteTransferResponse = {
  code: number;
  signature: string;
};

export class UltraClient {
  static readonly #ky = ky.create({
    prefixUrl: `${ClientConfig.host}/ultra/v1`,
    headers: ClientConfig.headers,
  });

  public static async getOrder(
    req: GetOrderRequest
  ): Promise<GetOrderResponse> {
    return this.#ky
      .get("order", { searchParams: req, throwHttpErrors: false })
      .json();
  }

  public static async getHoldings(
    address: string
  ): Promise<GetHoldingsResponse> {
    return this.#ky.get(`holdings/${address}`).json();
  }

  public static async postExecute(req: PostExecuteRequest) {
    return this.#ky.post<PostExecuteResponse>("execute", { json: req }).json();
  }

  public static async getTransferTokenTx(
    req: GetTransferTokenTxRequest
  ): Promise<GetTransferTxResponse> {
    return this.#ky
      .get("transfer/craft-token", {
        searchParams: req,
        throwHttpErrors: false,
      })
      .json();
  }

  public static async getTransferSolTx(
    req: GetTransferSolTxRequest
  ): Promise<GetTransferTxResponse> {
    return this.#ky
      .get("transfer/craft-native", {
        searchParams: req,
        throwHttpErrors: false,
      })
      .json();
  }

  public static async postExecuteTransfer(
    req: PostExecuteTransferRequest
  ): Promise<PostExecuteTransferResponse> {
    return this.#ky.post("transfer/execute", { json: req }).json();
  }
}
