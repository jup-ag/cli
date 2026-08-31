import { expect, test } from "bun:test";
import type { JupiterApi } from "jupiter-api-ts";

import { searchTokens } from "./Asset.ts";

test("searchTokens uses Tokens V2 for a comma-separated mint search", async () => {
  const calls: unknown[] = [];
  const api = {
    tokens: {
      v2: {
        getTokensV2Search: async (request: unknown) => {
          calls.push(request);
          return {
            data: [
              {
                id: "mint-a",
                name: "Token A",
                symbol: "A",
                decimals: 6,
              },
              {
                id: "mint-b",
                name: "Token B",
                symbol: "B",
                decimals: 9,
              },
            ],
          };
        },
      },
    },
  } as unknown as JupiterApi;

  const tokens = await searchTokens({
    api,
    query: "mint-a,mint-b",
  } as never);

  expect(calls).toEqual([{ query: { query: "mint-a,mint-b" } }]);
  expect(tokens.map((token) => token.id)).toEqual(["mint-a", "mint-b"]);
});
