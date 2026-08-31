import type {
  Address,
  Base64EncodedBytes,
  Base64EncodedWireTransaction,
  BlockhashLifetimeConstraint,
  GetAccountInfoApi,
  GetLatestBlockhashApi,
  GetMultipleAccountsApi,
  GetTokenAccountsByOwnerApi,
  Rpc,
} from "@solana/kit";
import {
  address,
  createSolanaRpc,
  parseBase64RpcAccount,
  unwrapOption,
} from "@solana/kit";
import {
  decodeToken as decodeToken2022,
  fetchMint,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import {
  decodeToken,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";

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

export type ClosableTokenAccount = {
  address: Address;
  amount: bigint;
  isFrozen: boolean;
  lamports: bigint;
  mint: Address;
  owner: Address;
};

type SolanaRpcOptions = {
  fetch?: typeof fetch;
  rpcClient?: Rpc<
    GetAccountInfoApi &
      GetLatestBlockhashApi &
      GetMultipleAccountsApi &
      GetTokenAccountsByOwnerApi
  >;
  url?: string;
};

export class SolanaRpc {
  readonly #fetch: typeof fetch;
  readonly #rpcClient: Rpc<
    GetAccountInfoApi &
      GetLatestBlockhashApi &
      GetMultipleAccountsApi &
      GetTokenAccountsByOwnerApi
  >;
  readonly #url: string;
  readonly #mints = new Map<string, ReturnType<typeof fetchMint>>();
  readonly #scaledUiMultipliers = new Map<
    string,
    Promise<number | undefined>
  >();

  public constructor(options: SolanaRpcOptions = {}) {
    this.#fetch = options.fetch ?? fetch;
    this.#url = options.url ?? Config.getRpcUrl();
    this.#rpcClient = options.rpcClient ?? createSolanaRpc(this.#url);
  }

  public getScaledUiMultiplier(mint: string): Promise<number | undefined> {
    const cached = this.#scaledUiMultipliers.get(mint);
    if (cached) {
      return cached;
    }

    const multiplier = this.#fetchScaledUiMultiplier(address(mint));
    this.#scaledUiMultipliers.set(mint, multiplier);
    return multiplier;
  }

  public async getTokenProgram(mint: string): Promise<Address> {
    const account = await this.#fetchMint(address(mint));
    if (
      account.programAddress !== TOKEN_PROGRAM_ADDRESS &&
      account.programAddress !== TOKEN_2022_PROGRAM_ADDRESS
    ) {
      throw new Error(`Mint ${mint} is not owned by an SPL Token program.`);
    }
    return account.programAddress;
  }

  public async getTokenPrograms(
    mints: readonly string[]
  ): Promise<Map<string, Address>> {
    const response = await this.#rpcClient
      .getMultipleAccounts(mints.map(address))
      .send();
    const tokenPrograms = new Map<string, Address>();

    for (const [index, account] of response.value.entries()) {
      const mint = mints[index]!;
      if (
        account?.owner !== TOKEN_PROGRAM_ADDRESS &&
        account?.owner !== TOKEN_2022_PROGRAM_ADDRESS
      ) {
        throw new Error(`Mint ${mint} is not owned by an SPL Token program.`);
      }
      tokenPrograms.set(mint, account.owner);
    }

    return tokenPrograms;
  }

  public async getTokenAccountsByOwner(
    owner: Address,
    tokenProgram: Address
  ): Promise<ClosableTokenAccount[]> {
    const response = await this.#rpcClient
      .getTokenAccountsByOwner(
        owner,
        { programId: tokenProgram },
        { encoding: "base64" }
      )
      .send();

    return response.value.map(({ account, pubkey }) => {
      const decoded =
        tokenProgram === TOKEN_2022_PROGRAM_ADDRESS
          ? decodeToken2022(parseBase64RpcAccount(pubkey, account))
          : decodeToken(parseBase64RpcAccount(pubkey, account));
      return {
        address: pubkey,
        amount: decoded.data.amount,
        isFrozen: decoded.data.state === 2,
        lamports: decoded.lamports,
        mint: decoded.data.mint,
        owner: decoded.data.owner,
      };
    });
  }

  public async getLatestBlockhash(): Promise<BlockhashLifetimeConstraint> {
    const { value } = await this.#rpcClient
      .getLatestBlockhash({ commitment: "confirmed" })
      .send();
    return value;
  }

  async #fetchScaledUiMultiplier(mint: Address): Promise<number | undefined> {
    const account = await this.#fetchMint(mint);
    if (account.programAddress !== TOKEN_2022_PROGRAM_ADDRESS) {
      return undefined;
    }

    const config = unwrapOption(account.data.extensions)?.find(
      (extension) => extension.__kind === "ScaledUiAmountConfig"
    );
    if (!config || config.__kind !== "ScaledUiAmountConfig") {
      return undefined;
    }

    const timestamp = BigInt(Math.floor(Date.now() / 1_000));
    return timestamp >= config.newMultiplierEffectiveTimestamp
      ? config.newMultiplier
      : config.multiplier;
  }

  #fetchMint(mint: Address): ReturnType<typeof fetchMint> {
    const cached = this.#mints.get(mint);
    if (cached) {
      return cached;
    }

    const account = fetchMint(this.#rpcClient, mint);
    this.#mints.set(mint, account);
    return account;
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
