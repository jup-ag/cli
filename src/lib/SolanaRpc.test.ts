import { expect, test } from "bun:test";
import type {
  Base64EncodedWireTransaction,
  Blockhash,
  GetAccountInfoApi,
  GetLatestBlockhashApi,
  GetMultipleAccountsApi,
  GetTokenAccountsByOwnerApi,
  Rpc,
  SendTransactionApi,
  SimulateTransactionApi,
} from "@solana/kit";

import { SolanaRpc } from "./SolanaRpc.ts";

const signedTransaction = "c2lnbmVk" as Base64EncodedWireTransaction;
type SolanaRpcApi = GetAccountInfoApi &
  GetLatestBlockhashApi &
  GetMultipleAccountsApi &
  GetTokenAccountsByOwnerApi &
  SendTransactionApi &
  SimulateTransactionApi;

test("simulates a signed transaction with signature verification", async () => {
  let args: unknown[] | undefined;
  const rpc = new SolanaRpc({
    rpcClient: {
      simulateTransaction: (...params: unknown[]) => {
        args = params;
        return { send: async () => ({ value: { err: null } }) };
      },
    } as unknown as Rpc<SolanaRpcApi>,
  });

  const result = await rpc.simulate(signedTransaction);

  expect(args).toEqual(["c2lnbmVk", { encoding: "base64", sigVerify: true }]);
  expect(result).toEqual({
    serializedTransaction: signedTransaction,
    success: true,
  });
});

test("sends a signed transaction through the configured RPC", async () => {
  let args: unknown[] | undefined;
  const rpc = new SolanaRpc({
    rpcClient: {
      sendTransaction: (...params: unknown[]) => {
        args = params;
        return { send: async () => "signature" };
      },
    } as unknown as Rpc<SolanaRpcApi>,
  });

  await expect(rpc.send(signedTransaction)).resolves.toBe("signature");
  expect(args).toEqual(["c2lnbmVk", { encoding: "base64" }]);
});

test("gets the latest blockhash through Solana Kit's RPC method", async () => {
  const blockhash = "11111111111111111111111111111111" as Blockhash;
  let commitment: string | undefined;
  const rpcClient = {
    getLatestBlockhash: (config?: { commitment?: string }) => {
      commitment = config?.commitment;
      return {
        send: async () => ({
          context: { slot: 1n },
          value: { blockhash, lastValidBlockHeight: 123n },
        }),
      };
    },
  } as unknown as Rpc<SolanaRpcApi>;
  const rpc = new SolanaRpc({ rpcClient });

  await expect(rpc.getLatestBlockhash()).resolves.toEqual({
    blockhash,
    lastValidBlockHeight: 123n,
  });
  expect(commitment).toBe("confirmed");
});
