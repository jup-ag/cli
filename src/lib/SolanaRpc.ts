import type {
  Base64EncodedBytes,
  Base64EncodedWireTransaction,
} from "@solana/kit";

import { Config } from "./Config.ts";
import { Signer } from "./Signer.ts";

type RpcError = {
  message?: string;
};

type RpcResponse<T> = {
  result?: T;
  error?: RpcError;
};

type SimulationValue = {
  err: unknown;
};

type SimulationResult = {
  serializedTransaction: Base64EncodedWireTransaction;
  success: boolean;
  error?: string;
};

type SolanaRpcOptions = {
  fetch?: typeof fetch;
  url?: string;
};

export class SolanaRpc {
  readonly #fetch: typeof fetch;
  readonly #url: string;

  public constructor(options: SolanaRpcOptions = {}) {
    this.#fetch = options.fetch ?? fetch;
    this.#url = options.url ?? Config.getRpcUrl();
  }

  public async simulate(
    serializedTransaction: Base64EncodedWireTransaction
  ): Promise<SimulationResult> {
    const result = await this.#request<{ value: SimulationValue }>(
      "simulateTransaction",
      [serializedTransaction, { encoding: "base64", sigVerify: true }]
    );
    const error = this.#formatSimulationError(result.value.err);

    return {
      serializedTransaction,
      success: error === undefined,
      ...(error ? { error } : {}),
    };
  }

  public async send(
    serializedTransaction: Base64EncodedWireTransaction
  ): Promise<string> {
    return this.#request<string>("sendTransaction", [
      serializedTransaction,
      {
        encoding: "base64",
      },
    ]);
  }

  public async signAndSimulate(
    signer: Signer,
    transaction: Base64EncodedBytes
  ): Promise<SimulationResult> {
    return this.simulate(await signer.signTransaction(transaction));
  }

  public async signAndSend(
    signer: Signer,
    transaction: Base64EncodedBytes
  ): Promise<string> {
    return this.send(await signer.signTransaction(transaction));
  }

  async #request<T>(method: string, params: unknown[]): Promise<T> {
    const response = await this.#fetch(this.#url, {
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json()) as RpcResponse<T>;

    if (!response.ok) {
      throw new Error(`RPC ${method} failed with HTTP ${response.status}.`);
    }
    if (payload.error) {
      throw new Error(
        `RPC ${method} failed: ${payload.error.message ?? "unknown error"}`
      );
    }
    if (payload.result === undefined) {
      throw new Error(`RPC ${method} returned no result.`);
    }
    return payload.result;
  }

  #formatSimulationError(error: unknown): string | undefined {
    if (error === null || error === undefined) {
      return undefined;
    }
    if (typeof error === "string") {
      return error;
    }
    return JSON.stringify(error);
  }
}
