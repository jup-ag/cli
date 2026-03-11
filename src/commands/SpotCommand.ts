import type { Command } from "commander";
import { DatapiClient, type Token } from "../clients/DatapiClient.ts";
import { UltraClient } from "../clients/UltraClient.ts";
import { Config } from "../lib/Config.ts";
import { NumberConverter } from "../lib/NumberConverter.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";

export class SpotCommand {
  public static register(program: Command): void {
    const spot = program
      .command("spot")
      .description("Quote and execute spot swaps");
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
      .option("--key <name>", "Key to use for signing")
      .action((opts) => this.swap(opts));
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

    const order = await UltraClient.getOrder({
      inputMint: inputToken.id,
      outputMint: outputToken.id,
      amount:
        opts.rawAmount ??
        NumberConverter.toChainAmount(opts.amount!, inputToken.decimals),
    });
    if (order.error) {
      throw new Error(order.errorMessage ?? order.error);
    }

    const inAmount = NumberConverter.fromChainAmount(
      order.inAmount,
      inputToken.decimals
    );
    const outAmount = NumberConverter.fromChainAmount(
      order.outAmount,
      outputToken.decimals
    );

    if (Output.isJson()) {
      Output.json({
        inputToken: {
          symbol: inputToken.symbol,
          mint: inputToken.id,
          decimals: inputToken.decimals,
        },
        outputToken: {
          symbol: outputToken.symbol,
          mint: outputToken.id,
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
    key?: string;
  }): Promise<void> {
    this.validateAmountOpts(opts);

    const settings = Config.load();
    const [signer, inputToken, outputToken] = await Promise.all([
      Signer.load(opts.key ?? settings.activeKey),
      this.resolveToken(opts.from),
      this.resolveToken(opts.to),
    ]);
    const order = await UltraClient.getOrder({
      inputMint: inputToken.id,
      outputMint: outputToken.id,
      amount:
        opts.rawAmount ??
        NumberConverter.toChainAmount(opts.amount!, inputToken.decimals),
      taker: signer.address,
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
      inputToken.decimals
    );
    const outAmount = NumberConverter.fromChainAmount(
      result.outputAmountResult,
      outputToken.decimals
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
      9
    );

    if (Output.isJson()) {
      Output.json({
        trader: signer.address,
        signature: result.signature,
        inputToken: {
          symbol: inputToken.symbol,
          mint: inputToken.id,
          decimals: inputToken.decimals,
        },
        outputToken: {
          symbol: outputToken.symbol,
          mint: outputToken.id,
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

  private static async resolveToken(input: string): Promise<Token> {
    const [token] = await DatapiClient.search({ query: input, limit: "1" });
    if (!token) {
      throw new Error(`Token not found: ${input}`);
    }
    return token;
  }
}
