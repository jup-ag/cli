import { expect, test } from "bun:test";
import type { JupiterApi } from "jupiter-api-ts";

import { resolveToken, searchTokens } from "./Asset.ts";

const tokenA = {
  id: "mint-a",
  name: "Token A",
  symbol: "A",
  decimals: 6,
};
const tokenB = {
  id: "mint-b",
  name: "Token B",
  symbol: "B",
  decimals: 9,
};

function mockSearchApi(handler: (request: unknown) => unknown): JupiterApi {
  return {
    tokens: {
      v2: {
        getTokensV2Search: async (request: unknown) => handler(request),
      },
    },
  } as unknown as JupiterApi;
}

test("searchTokens uses Tokens V2 for a comma-separated mint search", async () => {
  const calls: unknown[] = [];
  const api = mockSearchApi((request) => {
    calls.push(request);
    return { data: [tokenA, tokenB] };
  });

  const tokens = await searchTokens({
    api,
    query: "mint-a,mint-b",
  });

  expect(calls).toEqual([{ query: { query: "mint-a,mint-b" } }]);
  expect(tokens.map((token) => token.id)).toEqual(["mint-a", "mint-b"]);
});

test("resolveToken looks up a single query as the top search result", async () => {
  const calls: unknown[] = [];
  const api = mockSearchApi((request) => {
    calls.push(request);
    return { data: [tokenA, tokenB] };
  });

  const [token] = await resolveToken(api, ["A"]);

  expect(calls).toEqual([{ query: { query: "A" } }]);
  expect(token).toEqual(tokenA);
});

test("resolveToken looks up multiple queries in one search call", async () => {
  const calls: unknown[] = [];
  const api = mockSearchApi((request) => {
    calls.push(request);
    return { data: [tokenB, tokenA] };
  });

  const [inputToken, outputToken] = await resolveToken(api, [
    "mint-a",
    "mint-b",
  ]);

  expect(calls).toEqual([{ query: { query: "mint-a,mint-b" } }]);
  expect(inputToken).toEqual(tokenA);
  expect(outputToken).toEqual(tokenB);
});

test("resolveToken matches multi-query results by symbol", async () => {
  const api = mockSearchApi(() => ({ data: [tokenA, tokenB] }));

  const [inputToken, outputToken] = await resolveToken(api, ["a", "B"]);

  expect(inputToken).toEqual(tokenA);
  expect(outputToken).toEqual(tokenB);
});

test("resolveToken throws when a multi-query token is missing", async () => {
  const api = mockSearchApi(() => ({ data: [tokenA] }));

  await expect(resolveToken(api, ["mint-a", "mint-b"])).rejects.toThrow(
    "Token not found: mint-b"
  );
});
