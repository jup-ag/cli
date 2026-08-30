import type { Base64EncodedBytes } from "@solana/kit";
import type { JupiterApi, JupiterApiTypes } from "jupiter-api-ts";

import type { Token } from "./Asset.ts";
import { Config } from "./Config.ts";
import { NumberConverter } from "./NumberConverter.ts";
import type { Signer } from "./Signer.ts";
import type { SolanaRpc } from "./SolanaRpc.ts";

export type SwapResult = {
  signer: Signer;
  order: JupiterApiTypes.GetUltraV1OrderResponse;
  result: JupiterApiTypes.PostUltraV1ExecuteResponse | null;
  inputToken: Token;
  outputToken: Token;
  inAmount: string;
  outAmount: string;
  networkFeeLamports: number;
  serializedTransaction?: string;
  simulation?: Awaited<ReturnType<SolanaRpc["simulate"]>>;
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
    api: JupiterApi;
    signer: Signer;
    inputToken: Token;
    outputToken: Token;
    amount?: string;
    rawAmount?: string;
    rpc: SolanaRpc;
    slippageBps?: string;
  }): Promise<SwapResult> {
    const { api, signer, inputToken, outputToken, rpc } = opts;
    const [inputMultiplier, outputMultiplier] = await Promise.all([
      rpc.getScaledUiMultiplier(inputToken.id),
      rpc.getScaledUiMultiplier(outputToken.id),
    ]);

    const orderResponse = await api.ultra.get({
      query: {
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
      },
    });
    if (orderResponse.error || !orderResponse.data) {
      throw new Error("Unable to get a swap order.");
    }
    const order = orderResponse.data;
    if (!order.transaction) {
      throw new Error(order.errorMessage ?? "No valid routes found.");
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

    const signedTx = await signer.signTransaction(
      order.transaction as Base64EncodedBytes
    );

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
        serializedTransaction: signedTx,
        simulation: await rpc.simulate(signedTx),
      };
    }

    const executionResponse = await api.ultra.post({
      body: { requestId: order.requestId, signedTransaction: signedTx },
    });
    if (executionResponse.error || !executionResponse.data) {
      throw new Error("Unable to execute the swap.");
    }
    const result = executionResponse.data;
    if (
      result.status === "Failed" ||
      !result.inputAmountResult ||
      !result.outputAmountResult
    ) {
      throw new Error(result.error ?? "Swap execution failed.");
    }

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
}
