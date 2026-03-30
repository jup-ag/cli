import type { Base64EncodedBytes } from "@solana/kit";
import { readFileSync } from "node:fs";
import type { Command } from "commander";

import {
  VrfdClient,
  type CraftTxnResponse,
  type TokenMetadata,
} from "../clients/VrfdClient.ts";
import { Config } from "../lib/Config.ts";
import { NumberConverter } from "../lib/NumberConverter.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";

export class VrfdCommand {
  public static register(program: Command): void {
    const vrfd = program.command("vrfd").description("Token verification");
    vrfd
      .command("check")
      .description("Check if a token is eligible for verification")
      .requiredOption("--token <mint>", "Token mint address")
      .action((opts) => this.check(opts));
    vrfd
      .command("submit")
      .description("Submit a token verification request")
      .requiredOption("--token <mint>", "Token mint address to verify")
      .requiredOption("--twitter <handle>", "Project Twitter/X handle or URL")
      .requiredOption("--description <text>", "Reason for verification request")
      .option("--sender-twitter <handle>", "Submitter's Twitter/X handle")
      .option("--metadata <path>", "Path to JSON file with token metadata")
      .option("--key <name>", "Key to use for signing")
      .action((opts) => this.submit(opts));
  }

  private static async check(opts: { token: string }): Promise<void> {
    const eligibility = await VrfdClient.checkEligibility(opts.token);

    if (Output.isJson()) {
      Output.json(eligibility);
      return;
    }

    Output.table({
      type: "vertical",
      rows: [
        { label: "Token", value: opts.token },
        {
          label: "Exists",
          value: Output.formatBoolean(eligibility.tokenExists),
        },
        {
          label: "Verified",
          value: Output.formatBoolean(eligibility.isVerified),
        },
        {
          label: "Can Verify",
          value: Output.formatBoolean(eligibility.canVerify),
        },
        {
          label: "Can Update Metadata",
          value: Output.formatBoolean(eligibility.canMetadata),
        },
        ...(eligibility.verificationError
          ? [
              {
                label: "Verification Error",
                value: eligibility.verificationError,
              },
            ]
          : []),
        ...(eligibility.metadataError
          ? [{ label: "Metadata Error", value: eligibility.metadataError }]
          : []),
      ],
    });
  }

  private static async submit(opts: {
    token: string;
    twitter: string;
    description: string;
    senderTwitter?: string;
    metadata?: string;
    key?: string;
  }): Promise<void> {
    const settings = Config.load();
    const signer = await Signer.load(opts.key ?? settings.activeKey);

    // Check eligibility before crafting transaction
    const eligibility = await VrfdClient.checkEligibility(opts.token);
    if (!eligibility.tokenExists) {
      throw new Error("Token not found.");
    }
    if (eligibility.isVerified) {
      throw new Error("Token is already verified.");
    }
    if (!eligibility.canVerify) {
      throw new Error(
        eligibility.verificationError ??
          "Token is not eligible for express verification."
      );
    }

    // Load metadata from file if provided
    let tokenMetadata: TokenMetadata | undefined;
    if (opts.metadata) {
      if (!eligibility.canMetadata) {
        throw new Error(
          "Token metadata update not available. " +
            (eligibility.metadataError ?? "")
        );
      }
      const raw = readFileSync(opts.metadata, "utf-8");
      tokenMetadata = JSON.parse(raw) as TokenMetadata;
      tokenMetadata.tokenId = opts.token;
    }

    // Craft the payment transaction
    const craftResult = await VrfdClient.craftTxn(signer.address);
    if (craftResult.error) {
      throw new Error(craftResult.error);
    }
    if (!craftResult.transaction) {
      throw new Error("No transaction returned from server.");
    }

    const paymentAmount = NumberConverter.fromChainAmount(
      craftResult.amount,
      craftResult.tokenDecimals
    );

    if (Config.dryRun) {
      this.outputDryRun(
        signer,
        opts,
        craftResult,
        paymentAmount,
        tokenMetadata
      );
      return;
    }

    // Sign and execute
    const signedTx = await signer.signTransaction(
      craftResult.transaction as Base64EncodedBytes
    );

    const result = await VrfdClient.execute({
      transaction: signedTx,
      requestId: craftResult.requestId,
      senderAddress: signer.address,
      tokenId: opts.token,
      twitterHandle: opts.twitter,
      senderTwitterHandle: opts.senderTwitter,
      description: opts.description,
      tokenMetadata,
    });

    if (result.status === "Failed") {
      throw new Error(result.error ?? "Verification submission failed.");
    }

    if (Output.isJson()) {
      Output.json({
        sender: signer.address,
        tokenId: opts.token,
        status: result.status,
        signature: result.signature ?? null,
        verificationCreated: result.verificationCreated,
        metadataCreated: result.metadataCreated,
      });
      return;
    }

    Output.table({
      type: "vertical",
      rows: [
        { label: "Status", value: result.status },
        { label: "Token", value: opts.token },
        {
          label: "Verification Created",
          value: Output.formatBoolean(result.verificationCreated),
        },
        {
          label: "Metadata Created",
          value: Output.formatBoolean(result.metadataCreated),
        },
        ...(result.signature
          ? [{ label: "Tx Signature", value: result.signature }]
          : []),
      ],
    });
  }

  private static outputDryRun(
    signer: Signer,
    opts: {
      token: string;
      twitter: string;
      description: string;
    },
    craftResult: CraftTxnResponse,
    paymentAmount: string,
    tokenMetadata: TokenMetadata | undefined
  ): void {
    if (Output.isJson()) {
      Output.json({
        dryRun: true,
        sender: signer.address,
        tokenId: opts.token,
        twitterHandle: opts.twitter,
        description: opts.description,
        paymentAmount,
        paymentMint: craftResult.mint,
        feeLamports: craftResult.feeLamports,
        feeUsdAmount: craftResult.feeUsdAmount ?? null,
        gasless: craftResult.gasless,
        hasMetadata: !!tokenMetadata,
        signature: null,
        transaction: craftResult.transaction,
      });
      return;
    }

    console.log(Output.DRY_RUN_LABEL);
    Output.table({
      type: "vertical",
      rows: [
        { label: "Sender", value: signer.address },
        { label: "Token", value: opts.token },
        { label: "Twitter", value: opts.twitter },
        { label: "Description", value: opts.description },
        { label: "Payment", value: `${paymentAmount} JUP` },
        {
          label: "Gasless",
          value: Output.formatBoolean(craftResult.gasless),
        },
        {
          label: "Metadata Update",
          value: Output.formatBoolean(!!tokenMetadata),
        },
      ],
    });
  }
}
