import { findAssociatedTokenPda } from "@solana-program/token";
import type { Address, Base64EncodedBytes } from "@solana/kit";
import type { Command } from "commander";

import { DatapiClient, type Token } from "../clients/DatapiClient.ts";
import {
  UltraClient,
  type HoldingsTokenAccount,
} from "../clients/UltraClient.ts";
import { Asset } from "../lib/Asset.ts";
import { Config } from "../lib/Config.ts";
import { NumberConverter } from "../lib/NumberConverter.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";

export class SpotCommand {
  public static register(program: Command): void {
    const spot = program
      .command("spot")
      .description("Swaps, transfers, token and portfolio data");
    spot
      .command("tokens")
      .description("Search for tokens by symbol or mint address")
      .requiredOption(
        "--search <query>",
        "Token symbol or comma-delimited mint addresses"
      )
      .option("--limit <n>", "Max number of results")
      .action((opts) => this.tokens(opts));
    spot
      .command("quote")
      .description("Get a swap quote")
      .requiredOption("--from <token>", "Input token (symbol or mint address)")
      .requiredOption("--to <token>", "Output token (symbol or mint address)")
      .option("--amount <n>", "Amount in human-readable units")
      .option(
        "--raw-amount <n>",
        "Amount in on-chain units (no decimal conversion)"
      )
      .action((opts) => this.quote(opts));
    spot
      .command("swap")
      .description("Execute a swap")
      .requiredOption("--from <token>", "Input token (symbol or mint address)")
      .requiredOption("--to <token>", "Output token (symbol or mint address)")
      .option("--amount <n>", "Amount in human-readable units")
      .option(
        "--raw-amount <n>",
        "Amount in on-chain units (no decimal conversion)"
      )
      .option("--slippage <bps>", "Max slippage in basis points", "30")
      .option("--key <name>", "Key to use for signing")
      .action((opts) => this.swap(opts));
    spot
      .command("portfolio")
      .description("Show spot portfolio for a wallet")
      .option("--address <address>", "Wallet address to look up")
      .option("--key <name>", "Key to use (overrides active key)")
      .action((opts) => this.portfolio(opts));
    spot
      .command("transfer")
      .description("Transfer tokens to another wallet")
      .requiredOption(
        "--token <token>",
        "Token to transfer (symbol or mint address)"
      )
      .requiredOption("--to <address>", "Recipient wallet address")
      .option("--amount <n>", "Amount in human-readable units")
      .option(
        "--raw-amount <n>",
        "Amount in on-chain units (no decimal conversion)"
      )
      .option("--key <name>", "Key to use for signing")
      .action((opts) => this.transfer(opts));
  }

  private static async tokens(opts: {
    search: string;
    limit?: string;
  }): Promise<void> {
    if (opts.limit && isNaN(Number(opts.limit))) {
      throw new Error("--limit must be a number");
    }

    const tokens = await DatapiClient.search({
      query: opts.search,
      limit: opts.limit,
    });

    if (tokens.length === 0) {
      throw new Error("No tokens found matching query.");
    }

    if (Output.isJson()) {
      Output.json(tokens);
      return;
    }

    Output.table({
      type: "horizontal",
      headers: {
        id: "Address",
        symbol: "Symbol",
        name: "Name",
        price: "Price",
        mcap: "Market Cap",
        verified: "Verified",
      },
      rows: tokens.map((t) => ({
        ...t,
        price: Output.formatDollar(t.usdPrice),
        mcap: Output.formatDollar(t.mcap),
        verified: Output.formatBoolean(t.isVerified),
      })),
    });
  }

  private static async quote(opts: {
    from: string;
    to: string;
    amount?: string;
    rawAmount?: string;
  }): Promise<void> {
    this.validateAmountOpts(opts);

    const [inputToken, outputToken] = await Promise.all([
      this.resolveToken(opts.from),
      this.resolveToken(opts.to),
    ]);
    const inputMultiplier = this.getScaledUiMultiplier(inputToken);
    const outputMultiplier = this.getScaledUiMultiplier(outputToken);

    const order = await UltraClient.getOrder({
      inputMint: inputToken.id,
      outputMint: outputToken.id,
      amount:
        opts.rawAmount ??
        NumberConverter.toChainAmount(
          opts.amount!,
          inputToken.decimals,
          inputMultiplier
        ),
    });
    if (order.error) {
      throw new Error(order.errorMessage ?? order.error);
    }

    const inAmount = NumberConverter.fromChainAmount(
      order.inAmount,
      inputToken.decimals,
      inputMultiplier
    );
    const outAmount = NumberConverter.fromChainAmount(
      order.outAmount,
      outputToken.decimals,
      outputMultiplier
    );

    if (Output.isJson()) {
      Output.json({
        inputToken: {
          id: inputToken.id,
          symbol: inputToken.symbol,
          decimals: inputToken.decimals,
        },
        outputToken: {
          id: outputToken.id,
          symbol: outputToken.symbol,
          decimals: outputToken.decimals,
        },
        inAmount,
        outAmount,
        inUsdValue: order.inUsdValue,
        outUsdValue: order.outUsdValue,
        priceImpact: order.priceImpact,
      });
      return;
    }

    Output.table({
      type: "vertical",
      rows: [
        {
          label: "Input",
          value: `${inAmount} ${inputToken.symbol} (${Output.formatDollar(order.inUsdValue)})`,
        },
        {
          label: "Quoted Output",
          value: `${outAmount} ${outputToken.symbol} (${Output.formatDollar(order.outUsdValue)})`,
        },
        {
          label: "Price Impact",
          value: Output.formatPercentageChange(order.priceImpact),
        },
      ],
    });
  }

  private static async swap(opts: {
    from: string;
    to: string;
    amount?: string;
    rawAmount?: string;
    slippage?: string;
    key?: string;
  }): Promise<void> {
    this.validateAmountOpts(opts);

    const slippageBps = Number(opts.slippage ?? "30");
    if (isNaN(slippageBps) || slippageBps < 0 || slippageBps > 10000) {
      throw new Error("--slippage must be 0-10000 (basis points)");
    }

    const settings = Config.load();
    const [signer, inputToken, outputToken] = await Promise.all([
      Signer.load(opts.key ?? settings.activeKey),
      this.resolveToken(opts.from),
      this.resolveToken(opts.to),
    ]);
    const inputMultiplier = this.getScaledUiMultiplier(inputToken);
    const outputMultiplier = this.getScaledUiMultiplier(outputToken);

    const order = await UltraClient.getOrder({
      inputMint: inputToken.id,
      outputMint: outputToken.id,
      amount:
        opts.rawAmount ??
        NumberConverter.toChainAmount(
          opts.amount!,
          inputToken.decimals,
          inputMultiplier
        ),
      taker: signer.address,
      slippageBps,
    });

    if (order.error) {
      throw new Error(order.errorMessage ?? order.error);
    }
    if (!order.transaction) {
      throw new Error("No valid routes found.");
    }

    const signedTx = await signer.signTransaction(order.transaction);
    const result = await UltraClient.postExecute({
      requestId: order.requestId,
      signedTransaction: signedTx,
    });

    const inAmount = NumberConverter.fromChainAmount(
      result.inputAmountResult,
      inputToken.decimals,
      inputMultiplier
    );
    const outAmount = NumberConverter.fromChainAmount(
      result.outputAmountResult,
      outputToken.decimals,
      outputMultiplier
    );

    let networkFeeLamports = 0;
    if (
      order.prioritizationFeePayer === signer.address &&
      order.prioritizationFeeLamports
    ) {
      networkFeeLamports = order.prioritizationFeeLamports;
    }
    if (order.rentFeePayer === signer.address && order.rentFeeLamports) {
      networkFeeLamports += order.rentFeeLamports;
    }
    if (
      order.signatureFeePayer === signer.address &&
      order.signatureFeeLamports
    ) {
      networkFeeLamports += order.signatureFeeLamports;
    }
    const networkFee = NumberConverter.fromChainAmount(
      networkFeeLamports.toString(),
      Asset.SOL.decimals
    );

    if (Output.isJson()) {
      Output.json({
        trader: signer.address,
        signature: result.signature,
        inputToken: {
          id: inputToken.id,
          symbol: inputToken.symbol,
          decimals: inputToken.decimals,
        },
        outputToken: {
          id: outputToken.id,
          symbol: outputToken.symbol,
          decimals: outputToken.decimals,
        },
        inAmount,
        outAmount,
        inUsdValue: order.inUsdValue,
        outUsdValue: order.outUsdValue,
        priceImpact: order.priceImpact,
        networkFeeLamports,
      });
      return;
    }

    Output.table({
      type: "vertical",
      rows: [
        {
          label: "Trader",
          value: signer.address,
        },
        {
          label: "Input",
          value: `${inAmount} ${inputToken.symbol} (${Output.formatDollar(order.inUsdValue)})`,
        },
        {
          label: "Output",
          value: `${outAmount} ${outputToken.symbol} (${Output.formatDollar(order.outUsdValue)})`,
        },
        {
          label: "Network Fee",
          value: `${networkFee} SOL`,
        },
        {
          label: "Tx Signature",
          value: result.signature,
        },
      ],
    });
  }

  private static async portfolio(opts: {
    address?: string;
    key?: string;
  }): Promise<void> {
    if (opts.address && opts.key) {
      throw new Error("Only one of --address or --key can be provided.");
    }

    const address =
      opts.address ??
      (await Signer.load(opts.key ?? Config.load().activeKey)).address;

    const SOL_DECIMALS = Asset.SOL.decimals;

    const raw = await UltraClient.getHoldings(address);

    // Preprocess: extract only ATA entries, keyed by mint
    const ataByMint = new Map<string, HoldingsTokenAccount>();
    for (const [mint, accounts] of Object.entries(raw.tokens)) {
      const ata = accounts.find((acc) => acc.isAssociatedTokenAccount);
      if (ata) {
        ataByMint.set(mint, ata);
      }
    }

    // Resolve all token info via Datapi
    const allMints = [...ataByMint.keys()];
    if (!ataByMint.has(Asset.SOL.id)) {
      allMints.push(Asset.SOL.id);
    }

    const BATCH_SIZE = 100;
    const tokenMap = new Map<string, Token>();
    const batches: string[][] = [];
    for (let i = 0; i < allMints.length; i += BATCH_SIZE) {
      batches.push(allMints.slice(i, i + BATCH_SIZE));
    }
    const resolved = await Promise.all(
      batches.map((batch) =>
        DatapiClient.search({
          query: batch.join(","),
          limit: BATCH_SIZE.toString(),
        })
      )
    );
    for (const tokens of resolved) {
      for (const token of tokens) {
        tokenMap.set(token.id, token);
      }
    }

    const outputTokens: {
      id: string;
      symbol: string;
      decimals: number;
      amount: number;
      rawAmount: string;
      value: number;
      price: number;
      priceChange: number;
      isVerified?: boolean | undefined;
      scaledUiMultiplier?: number | undefined;
    }[] = [];

    // Add combined SOL/WSOL entry
    const wsolInfo = tokenMap.get(Asset.SOL.id);
    const solLamports = BigInt(raw.amount);
    const wsolLamports = BigInt(ataByMint.get(Asset.SOL.id)?.amount ?? "0");
    const combinedSolLamports = solLamports + wsolLamports;
    if (wsolInfo && combinedSolLamports > 0n) {
      const amount = Number(
        NumberConverter.fromChainAmount(combinedSolLamports, SOL_DECIMALS)
      );
      outputTokens.push({
        id: Asset.SOL.id,
        symbol: wsolInfo.symbol,
        decimals: SOL_DECIMALS,
        amount,
        rawAmount: combinedSolLamports.toString(),
        value: amount * (wsolInfo.usdPrice ?? 0),
        price: wsolInfo.usdPrice ?? 0,
        priceChange: wsolInfo.stats24h?.priceChange ?? 0,
        isVerified: wsolInfo.isVerified,
      });
    }

    for (const [mint, ata] of ataByMint) {
      if (mint === Asset.SOL.id) {
        continue;
      }
      const info = tokenMap.get(mint);
      if (!info) {
        continue;
      }
      const multiplier = this.getScaledUiMultiplier(info);
      const amount = Number(
        NumberConverter.fromChainAmount(ata.amount, info.decimals, multiplier)
      );
      outputTokens.push({
        id: mint,
        symbol: info.symbol,
        decimals: info.decimals,
        amount,
        rawAmount: ata.amount,
        value: amount * (info.usdPrice ?? 0),
        price: info.usdPrice ?? 0,
        priceChange: info.stats24h?.priceChange ?? 0,
        isVerified: info.isVerified,
        scaledUiMultiplier: multiplier,
      });
    }

    // Sort by value descending
    outputTokens.sort((a, b) => b.value - a.value);
    const totalValue = outputTokens.reduce((sum, t) => sum + t.value, 0);

    if (Output.isJson()) {
      Output.json({ totalValue, tokens: outputTokens });
      return;
    }

    if (outputTokens.length === 0) {
      throw new Error("No holdings found for this address.");
    }

    Output.table({
      type: "horizontal",
      headers: {
        symbol: "Token",
        amount: "Amount",
        price: "Price",
        value: "Value",
        priceChange: "24h Change",
        verified: "Verified",
      },
      rows: outputTokens.map((t) => ({
        symbol: t.symbol,
        amount: t.amount.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        }),
        price: Output.formatDollar(t.price),
        value: Output.formatDollar(t.value),
        priceChange: Output.formatPercentageChange(t.priceChange),
        verified: Output.formatBoolean(t.isVerified),
      })),
    });
    console.log(`\nTotal Value: ${Output.formatDollar(totalValue)}`);
  }

  public static async transfer(opts: {
    token: string;
    amount?: string;
    rawAmount?: string;
    to: string;
    key?: string;
  }): Promise<void> {
    this.validateAmountOpts(opts);

    const settings = Config.load();
    const [signer, token] = await Promise.all([
      Signer.load(opts.key ?? settings.activeKey),
      this.resolveToken(opts.token),
    ]);
    const multiplier = this.getScaledUiMultiplier(token);
    const chainAmount =
      opts.rawAmount ??
      NumberConverter.toChainAmount(opts.amount!, token.decimals, multiplier);

    let txResponse;
    if (token.id === Asset.SOL.id) {
      txResponse = await UltraClient.getTransferSolTx({
        senderAddress: signer.address as Address,
        receiverAddress: opts.to as Address,
        amount: chainAmount,
      });
    } else {
      const [senderTokenAccountAddress] = await findAssociatedTokenPda({
        mint: token.id as Address,
        owner: signer.address as Address,
        tokenProgram: token.tokenProgram as Address,
      });
      txResponse = await UltraClient.getTransferTokenTx({
        mint: token.id,
        tokenDecimals: token.decimals.toString(),
        tokenProgramId: token.tokenProgram,
        senderAddress: signer.address as Address,
        senderTokenAccountAddress,
        receiverAddress: opts.to as Address,
        amount: chainAmount,
      });
    }

    if ("error" in txResponse) {
      throw new Error(txResponse.error);
    }

    const signedTx = await signer.signTransaction(
      txResponse.transaction as Base64EncodedBytes
    );
    const result = await UltraClient.postExecuteTransfer({
      requestId: txResponse.requestId,
      signedTransaction: signedTx,
    });

    const humanAmount = NumberConverter.fromChainAmount(
      chainAmount,
      token.decimals,
      multiplier
    );
    const value = Number(humanAmount) * (token.usdPrice ?? 0);

    if (Output.isJson()) {
      Output.json({
        sender: signer.address,
        recipient: opts.to,
        token: {
          id: token.id,
          symbol: token.symbol,
          decimals: token.decimals,
        },
        amount: humanAmount,
        value: value,
        networkFeeLamports: txResponse.feeAmount,
        signature: result.signature,
      });
      return;
    }

    const networkFee = NumberConverter.fromChainAmount(
      txResponse.feeAmount.toString(),
      Asset.SOL.decimals
    );

    Output.table({
      type: "vertical",
      rows: [
        { label: "Sender", value: signer.address },
        { label: "Recipient", value: opts.to },
        {
          label: "Amount",
          value: `${humanAmount} ${token.symbol} (${Output.formatDollar(value)})`,
        },
        {
          label: "Network Fee",
          value: `${networkFee} SOL`,
        },
        { label: "Tx Signature", value: result.signature },
      ],
    });
  }

  private static validateAmountOpts(opts: {
    amount?: string;
    rawAmount?: string;
  }): void {
    if (!opts.amount && !opts.rawAmount) {
      throw new Error("Either --amount or --raw-amount must be provided.");
    }
    if (opts.amount && opts.rawAmount) {
      throw new Error("Only one of --amount or --raw-amount can be provided.");
    }
  }

  private static getScaledUiMultiplier(token: Token): number | undefined {
    if (!token.scaledUiConfig) {
      return undefined;
    }
    const isNewMultiplierActive =
      new Date() >= new Date(token.scaledUiConfig.newMultiplierEffectiveAt);
    return isNewMultiplierActive
      ? token.scaledUiConfig.newMultiplier
      : token.scaledUiConfig.multiplier;
  }

  private static async resolveToken(input: string): Promise<Token> {
    const [token] = await DatapiClient.search({ query: input, limit: "1" });
    if (!token) {
      throw new Error(`Token not found: ${input}`);
    }
    return token;
  }
}
