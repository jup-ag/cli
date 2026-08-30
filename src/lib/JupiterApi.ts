import {
  createJupiterApiClient,
  createJupiterDatapiClient,
  createJupiterPerpsApiClient,
  JupiterApi,
  JupiterDatapi,
  JupiterPerpsApi,
} from "jupiter-api-ts";

import { Config } from "./Config.ts";

const CLIENT_PLATFORM_HEADER = "jupiter.cli";

type JupiterClientOptions = {
  apiKey?: string;
  fetch?: typeof fetch;
};

export type JupiterClients = {
  api: JupiterApi;
  datapi: JupiterDatapi;
  perps: JupiterPerpsApi;
};

export function createJupiterClients(
  options: JupiterClientOptions = {}
): JupiterClients {
  const apiKey = options.apiKey ?? Config.load().apiKey;
  const fetch = options.fetch;
  const coreClient = createJupiterApiClient({
    auth: apiKey,
    headers: { "x-client-platform": CLIENT_PLATFORM_HEADER },
    ...(fetch ? { fetch } : {}),
  });
  const perpsClient = createJupiterPerpsApiClient({
    auth: apiKey,
    headers: { "x-client-platform": CLIENT_PLATFORM_HEADER },
    ...(fetch ? { fetch } : {}),
  });
  const datapiClient = createJupiterDatapiClient(fetch ? { fetch } : {});

  return {
    api: new JupiterApi({ client: coreClient }),
    datapi: new JupiterDatapi({ client: datapiClient }),
    perps: new JupiterPerpsApi({ client: perpsClient }),
  };
}

export function requireJupiterApiKey(): string {
  const apiKey = Config.load().apiKey;
  if (!apiKey) {
    throw new Error(
      "A Jupiter API key is required. Run jup config set api-key <key>."
    );
  }
  return apiKey;
}
