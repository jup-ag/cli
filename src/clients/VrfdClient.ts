import ky from "ky";

import { ClientConfig } from "./ClientConfig.ts";

export type CheckEligibilityResponse = {
  tokenExists: boolean;
  isVerified: boolean;
  canVerify: boolean;
  canMetadata: boolean;
  verificationError?: string;
  metadataError?: string;
};

export type CraftTxnResponse = {
  receiverAddress: string;
  mint: string;
  amount: string;
  tokenDecimals: number;
  tokenUsdRate?: number;
  feeLamports: number;
  feeUsdAmount?: number;
  feeMint: string;
  feeTokenDecimals: number;
  feeAmount: number;
  transaction?: string;
  requestId: string;
  totalTime: number;
  expireAt?: string;
  error?: string;
  code: number;
  gasless: boolean;
};

export type TokenMetadata = {
  tokenId: string;
  icon?: string | null;
  name?: string | null;
  symbol?: string | null;
  website?: string | null;
  telegram?: string | null;
  twitter?: string | null;
  twitterCommunity?: string | null;
  discord?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  circulatingSupply?: string | null;
  useCirculatingSupply?: boolean | null;
  tokenDescription?: string | null;
  coingeckoCoinId?: string | null;
  useCoingeckoCoinId?: boolean | null;
  circulatingSupplyUrl?: string | null;
  useCirculatingSupplyUrl?: boolean | null;
  otherUrl?: string | null;
};

export type ExecuteRequest = {
  transaction: string;
  requestId: string;
  senderAddress: string;
  tokenId: string;
  twitterHandle: string;
  senderTwitterHandle?: string;
  description: string;
  tokenMetadata?: TokenMetadata;
};

export type ExecuteResponse = {
  status: "Success" | "Failed";
  signature?: string;
  error?: string;
  code?: number;
  totalTime: number;
  verificationCreated: boolean;
  metadataCreated: boolean;
};

export class VrfdClient {
  static readonly #ky = ky.create({
    prefixUrl: ClientConfig.host,
    headers: ClientConfig.headers,
  });

  public static async checkEligibility(
    tokenId: string
  ): Promise<CheckEligibilityResponse> {
    return this.#ky
      .get("tokens/v2/verify/express/check-eligibility", {
        searchParams: { tokenId },
      })
      .json();
  }

  public static async craftTxn(
    senderAddress: string
  ): Promise<CraftTxnResponse> {
    return this.#ky
      .get("tokens/v2/verify/express/craft-txn", {
        searchParams: { senderAddress },
      })
      .json();
  }

  public static async execute(req: ExecuteRequest): Promise<ExecuteResponse> {
    return this.#ky
      .post("tokens/v2/verify/express/execute", { json: req })
      .json();
  }
}
