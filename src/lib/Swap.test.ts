import { afterEach, expect, test } from "bun:test";
import type { Base64EncodedBytes } from "@solana/kit";
import type { JupiterApi } from "jupiter-api-ts";

import type { Token } from "./Asset.ts";
import { Config } from "./Config.ts";
import type { Signer } from "./Signer.ts";
import type { SolanaRpc } from "./SolanaRpc.ts";
import { Swap } from "./Swap.ts";

const inputToken = {
  id: "So11111111111111111111111111111111111111112",
  symbol: "SOL",
  name: "Solana",
  decimals: 9,
} as Token;
const outputToken = {
  id: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
} as Token;

afterEach(() => {
  Config.dryRun = false;
});

test("executes a Swap V2 order through its execute route", async () => {
  const calls: unknown[] = [];
  const api = {
    swap: {
      v2: {
        getOrder: async (request: unknown) => {
          calls.push(request);
          return {
            data: {
              inAmount: "1000000000",
              outAmount: "150000000",
              requestId: "request-id",
              lastValidBlockHeight: "123",
              transaction: "unsigned-transaction",
            },
          };
        },
        postExecute: async (request: unknown) => {
          calls.push(request);
          return {
            data: {
              status: "Success",
              signature: "signature",
              inputAmountResult: "1000000000",
              outputAmountResult: "150000000",
            },
          };
        },
      },
    },
  } as unknown as JupiterApi;
  const signer = {
    address: "wallet",
    signTransaction: async () => "signed-transaction" as Base64EncodedBytes,
  } as unknown as Signer;
  const rpc = {
    getScaledUiMultiplier: async () => undefined,
  } as unknown as SolanaRpc;

  const result = await Swap.execute({
    api,
    signer,
    rpc,
    inputToken,
    outputToken,
    amount: "1",
  });

  expect(calls).toEqual([
    {
      query: {
        inputMint: inputToken.id,
        outputMint: outputToken.id,
        amount: "1000000000",
        taker: "wallet",
      },
    },
    {
      body: {
        requestId: "request-id",
        lastValidBlockHeight: "123",
        signedTransaction: "signed-transaction",
      },
    },
  ]);
  expect(result.result?.signature).toBe("signature");
});
