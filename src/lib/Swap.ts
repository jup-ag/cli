import type { Base64EncodedBytes } from "@solana/kit";

import type { Token } from "../clients/DatapiClient.ts";
import {
  UltraClient,
  type GetOrderResponse,
  type PostExecuteResponse,
} from "../clients/UltraClient.ts";
import { Config } from "./Config.ts";
import { NumberConverter } from "./NumberConverter.ts";
import type { Signer } from "./Signer.ts";

export type SwapResult = {
  signer: Signer;
  order: GetOrderResponse;
  result: PostExecuteResponse | null;
  inputToken: Token;
  outputToken: Token;
  inAmount: string;
  outAmount: string;
  networkFeeLamports: number;
};

export class Swap {
  public static validateAmountOpts(opts: {
    amount?: string;
    rawAmount?: string;
  }): void {
    if (!opts.amount && !opts.rawAmount) {
      throw new Error("Either --amount or --raw-amount must be provided.");
    }
    if (opts.amount && opts.rawAmount) {
      throw new Error("Only one of --amount or --raw-amount can be provided.");
    }
  }

  public static async execute(opts: {
    signer: Signer;
    inputToken: Token;
    outputToken: Token;
    amount?: string;
    rawAmount?: string;
    slippageBps?: string;
  }): Promise<SwapResult> {
    const { signer, inputToken, outputToken } = opts;
    const inputMultiplier = this.getScaledUiMultiplier(inputToken);
    const outputMultiplier = this.getScaledUiMultiplier(outputToken);

    const order = await UltraClient.getOrder({
      inputMint: inputToken.id,
      outputMint: outputToken.id,
      amount:
        opts.rawAmount ??
        NumberConverter.toChainAmount(
          opts.amount!,
          inputToken.decimals,
          inputMultiplier
        ),
      taker: signer.address,
      slippageBps: opts.slippageBps,
    });

    if (order.error) {
      throw new Error(order.errorMessage ?? order.error);
    }
    if (!order.transaction) {
      throw new Error("No valid routes found.");
    }

    let networkFeeLamports = 0;
    if (
      order.prioritizationFeePayer === signer.address &&
      order.prioritizationFeeLamports
    ) {
      networkFeeLamports = order.prioritizationFeeLamports;
    }
    if (order.rentFeePayer === signer.address && order.rentFeeLamports) {
      networkFeeLamports += order.rentFeeLamports;
    }
    if (
      order.signatureFeePayer === signer.address &&
      order.signatureFeeLamports
    ) {
      networkFeeLamports += order.signatureFeeLamports;
    }

    if (Config.dryRun) {
      const inAmount = NumberConverter.fromChainAmount(
        order.inAmount,
        inputToken.decimals,
        inputMultiplier
      );
      const outAmount = NumberConverter.fromChainAmount(
        order.outAmount,
        outputToken.decimals,
        outputMultiplier
      );
      return {
        signer,
        order,
        result: null,
        inputToken,
        outputToken,
        inAmount,
        outAmount,
        networkFeeLamports,
      };
    }

    const signedTx = await signer.signTransaction(
      order.transaction as Base64EncodedBytes
    );
    const result = await UltraClient.postExecute({
      requestId: order.requestId,
      signedTransaction: signedTx,
    });

    const inAmount = NumberConverter.fromChainAmount(
      result.inputAmountResult,
      inputToken.decimals,
      inputMultiplier
    );
    const outAmount = NumberConverter.fromChainAmount(
      result.outputAmountResult,
      outputToken.decimals,
      outputMultiplier
    );

    return {
      signer,
      order,
      result,
      inputToken,
      outputToken,
      inAmount,
      outAmount,
      networkFeeLamports,
    };
  }

  public static getScaledUiMultiplier(token: Token): number | undefined {
    if (!token.scaledUiConfig) {
      return undefined;
    }
    const isNewMultiplierActive =
      new Date() >= new Date(token.scaledUiConfig.newMultiplierEffectiveAt);
    return isNewMultiplierActive
      ? token.scaledUiConfig.newMultiplier
      : token.scaledUiConfig.multiplier;
  }
}
