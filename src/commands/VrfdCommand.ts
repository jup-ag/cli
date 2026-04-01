import { isAddress, type Base64EncodedBytes } from "@solana/kit";

import type { Command } from "commander";

import { VrfdClient, type TokenMetadata } from "../clients/VrfdClient.ts";
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
      .requiredOption(
        "--project-twitter <handle>",
        "Project Twitter/X handle or URL"
      )
      .requiredOption("--description <text>", "Reason for verification request")
      .option("--sender-twitter <handle>", "Submitter's Twitter/X handle")
      .option("--meta-icon <url>", "Token icon URL")
      .option("--meta-name <name>", "Token name")
      .option("--meta-symbol <symbol>", "Token symbol/ticker")
      .option("--meta-website <url>", "Token website URL")
      .option("--meta-telegram <url>", "Telegram group URL")
      .option("--meta-twitter <url>", "Token Twitter/X URL")
      .option("--meta-twitter-community <url>", "Twitter community URL")
      .option("--meta-discord <url>", "Discord server URL")
      .option("--meta-instagram <url>", "Instagram URL")
      .option("--meta-tiktok <url>", "TikTok URL")
      .option("--meta-circulating-supply <amount>", "Circulating supply value")
      .option("--meta-description <text>", "Token description")
      .option("--meta-coingecko-coin-id <id>", "CoinGecko coin identifier")
      .option(
        "--meta-circulating-supply-url <url>",
        "Circulating supply API URL"
      )
      .option("--meta-other-url <url>", "Additional URL")
      .option("--meta-use-circulating-supply", "Enable circulating supply")
      .option("--meta-use-coingecko-coin-id", "Enable CoinGecko coin ID")
      .option(
        "--meta-use-circulating-supply-url",
        "Enable circulating supply URL"
      )
      .option("--key <name>", "Key to use for signing")
      .action((opts) => this.submit(opts));
  }

  private static async check(opts: { token: string }): Promise<void> {
    if (!isAddress(opts.token)) {
      throw new Error("Invalid token mint address.");
    }
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
    projectTwitter: string;
    description: string;
    senderTwitter?: string;
    key?: string;
    metaIcon?: string;
    metaName?: string;
    metaSymbol?: string;
    metaWebsite?: string;
    metaTelegram?: string;
    metaTwitter?: string;
    metaTwitterCommunity?: string;
    metaDiscord?: string;
    metaInstagram?: string;
    metaTiktok?: string;
    metaCirculatingSupply?: string;
    metaDescription?: string;
    metaCoingeckoCoinId?: string;
    metaCirculatingSupplyUrl?: string;
    metaOtherUrl?: string;
    metaUseCirculatingSupply?: boolean;
    metaUseCoingeckoCoinId?: boolean;
    metaUseCirculatingSupplyUrl?: boolean;
  }): Promise<void> {
    const settings = Config.load();
    const signer = await Signer.load(opts.key ?? settings.activeKey);

    if (!isAddress(opts.token)) {
      throw new Error("Invalid token mint address.");
    }

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
          "Token is not eligible for verification."
      );
    }

    // Build metadata from inline --meta-* options if any were provided
    const tokenMetadata = this.buildTokenMetadata(opts.token, opts);
    if (tokenMetadata) {
      if (!eligibility.canMetadata) {
        throw new Error(
          "Token metadata update not available. " +
            (eligibility.metadataError ?? "")
        );
      }
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
      if (Output.isJson()) {
        Output.json({
          dryRun: true,
          sender: signer.address,
          tokenId: opts.token,
          status: null,
          signature: null,
          paymentAmount,
          paymentMint: craftResult.mint,
          feeUsd: craftResult.feeUsdAmount ?? null,
          verificationCreated: null,
          metadataCreated: null,
          metadata: tokenMetadata ?? null,
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
          { label: "Twitter", value: opts.projectTwitter },
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
          ...this.metadataRows(tokenMetadata),
        ],
      });
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
      twitterHandle: opts.projectTwitter,
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
        paymentAmount,
        paymentMint: craftResult.mint,
        feeUsd: craftResult.feeUsdAmount ?? null,
        verificationCreated: result.verificationCreated,
        metadataCreated: result.metadataCreated,
        metadata: tokenMetadata ?? null,
      });
      return;
    }

    Output.table({
      type: "vertical",
      rows: [
        { label: "Status", value: result.status },
        { label: "Token", value: opts.token },
        { label: "Payment", value: `${paymentAmount} JUP` },
        {
          label: "Verification Created",
          value: Output.formatBoolean(result.verificationCreated),
        },
        {
          label: "Metadata Created",
          value: Output.formatBoolean(result.metadataCreated),
        },
        ...this.metadataRows(tokenMetadata),
        ...(result.signature
          ? [{ label: "Tx Signature", value: result.signature }]
          : []),
      ],
    });
  }

  private static metadataRows(
    metadata: TokenMetadata | undefined
  ): { label: string; value: string }[] {
    if (!metadata) {
      return [];
    }

    const labels: Record<string, string> = {
      name: "Meta: Name",
      symbol: "Meta: Symbol",
      icon: "Meta: Icon",
      tokenDescription: "Meta: Description",
      website: "Meta: Website",
      twitter: "Meta: Twitter",
      twitterCommunity: "Meta: Twitter Community",
      telegram: "Meta: Telegram",
      discord: "Meta: Discord",
      instagram: "Meta: Instagram",
      tiktok: "Meta: TikTok",
      circulatingSupply: "Meta: Circulating Supply",
      coingeckoCoinId: "Meta: CoinGecko ID",
      circulatingSupplyUrl: "Meta: Circulating Supply URL",
      otherUrl: "Meta: Other URL",
      useCirculatingSupply: "Meta: Use Circulating Supply",
      useCoingeckoCoinId: "Meta: Use CoinGecko ID",
      useCirculatingSupplyUrl: "Meta: Use Circulating Supply URL",
    };

    return Object.entries(metadata)
      .filter(([key]) => key !== "tokenId" && labels[key])
      .map(([key, value]) => ({
        label: labels[key]!,
        value:
          typeof value === "boolean"
            ? Output.formatBoolean(value)
            : String(value),
      }));
  }

  private static buildTokenMetadata(
    tokenId: string,
    opts: Record<string, unknown>
  ): TokenMetadata | undefined {
    const fieldMap: Record<string, keyof TokenMetadata> = {
      metaIcon: "icon",
      metaName: "name",
      metaSymbol: "symbol",
      metaWebsite: "website",
      metaTelegram: "telegram",
      metaTwitter: "twitter",
      metaTwitterCommunity: "twitterCommunity",
      metaDiscord: "discord",
      metaInstagram: "instagram",
      metaTiktok: "tiktok",
      metaCirculatingSupply: "circulatingSupply",
      metaDescription: "tokenDescription",
      metaCoingeckoCoinId: "coingeckoCoinId",
      metaCirculatingSupplyUrl: "circulatingSupplyUrl",
      metaOtherUrl: "otherUrl",
      metaUseCirculatingSupply: "useCirculatingSupply",
      metaUseCoingeckoCoinId: "useCoingeckoCoinId",
      metaUseCirculatingSupplyUrl: "useCirculatingSupplyUrl",
    };

    const metadata: Partial<TokenMetadata> = {};
    let hasAny = false;

    for (const [optKey, metaField] of Object.entries(fieldMap)) {
      if (opts[optKey] !== undefined) {
        (metadata as Record<string, unknown>)[metaField] = opts[optKey];
        hasAny = true;
      }
    }

    if (!hasAny) {
      return undefined;
    }

    metadata.tokenId = tokenId;
    return metadata as TokenMetadata;
  }
}
