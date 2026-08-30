import { expect, test } from "bun:test";
import type { Base64EncodedWireTransaction } from "@solana/kit";

import { SolanaRpc } from "./SolanaRpc.ts";

const signedTransaction = "c2lnbmVk" as Base64EncodedWireTransaction;

test("simulates a signed transaction with signature verification", async () => {
  let body: unknown;
  const rpc = new SolanaRpc({
    fetch: (async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({
        jsonrpc: "2.0",
        id: 1,
        result: { value: { err: null } },
      });
    }) as typeof fetch,
    url: "https://rpc.example.com",
  });

  const result = await rpc.simulate(signedTransaction);

  expect(body).toEqual({
    jsonrpc: "2.0",
    id: 1,
    method: "simulateTransaction",
    params: ["c2lnbmVk", { encoding: "base64", sigVerify: true }],
  });
  expect(result).toEqual({
    serializedTransaction: signedTransaction,
    success: true,
  });
});

test("sends a signed transaction through the configured RPC", async () => {
  let body: unknown;
  const rpc = new SolanaRpc({
    fetch: (async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return Response.json({ jsonrpc: "2.0", id: 1, result: "signature" });
    }) as typeof fetch,
    url: "https://rpc.example.com",
  });

  await expect(rpc.send(signedTransaction)).resolves.toBe("signature");
  expect(body).toEqual({
    jsonrpc: "2.0",
    id: 1,
    method: "sendTransaction",
    params: ["c2lnbmVk", { encoding: "base64" }],
  });
});
