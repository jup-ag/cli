import { findAssociatedTokenPda } from "@solana-program/token";
import { isAddress, type Address, type Base64EncodedBytes } from "@solana/kit";
import chalk from "chalk";
import type { Command } from "commander";

import {
  DatapiClient,
  type SpotTrade,
  type Token,
} from "../clients/DatapiClient.ts";
import {
  UltraClient,
  type HoldingsTokenAccount,
} from "../clients/UltraClient.ts";
import { Asset } from "../lib/Asset.ts";
import { Config } from "../lib/Config.ts";
import { NumberConverter } from "../lib/NumberConverter.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";
import { Swap } from "../lib/Swap.ts";

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
      .option("--key <name>", "Key to use for signing")
      .action((opts) => this.swap(opts));
    spot
      .command("portfolio")
      .description("Show spot portfolio for a wallet")
      .option("--address <address>", "Wallet address to look up")
      .option("--key <name>", "Key to use (overrides active key)")
      .action((opts) => this.portfolio(opts));
    spot
      .command("history")
      .description("View swap trade history for a wallet")
      .option("--key <name>", "Key to use (overrides active key)")
      .option("--address <address>", "Wallet address to look up")
      .option("--token <token>", "Filter by token (symbol or mint address)")
      .option("--after <date>", "Show trades after this date or UNIX timestamp")
      .option(
        "--before <date>",
        "Show trades before this date or UNIX timestamp"
      )
      .option("--limit <n>", "Max number of results (max: 15)", "10")
      .option("--offset <offset>", "Pagination offset for next page of results")
      .action((opts) => this.history(opts));
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
    spot
      .command("reclaim")
      .description("Reclaim SOL rent from empty token accounts")
      .option("--key <name>", "Key to use for signing")
      .option("--token <token>", "Token symbol or mint address to reclaim")
      .action((opts) => this.reclaim(opts));
  }

  private static async tokens(opts: {
    search: string;
    limit?: string;
  }): Promise<void> {
    if (opts.limit && isNaN(Number(opts.limit))) {
      throw new Error("--limit must be a number");
    }

    const tokens = await DatapiClient.getTokensSearch({
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
    Swap.validateAmountOpts(opts);

    const [inputToken, outputToken] = await Promise.all([
      DatapiClient.resolveToken(opts.from),
      DatapiClient.resolveToken(opts.to),
    ]);
    const inputMultiplier = Swap.getScaledUiMultiplier(inputToken);
    const outputMultiplier = Swap.getScaledUiMultiplier(outputToken);

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
    key?: string;
  }): Promise<void> {
    Swap.validateAmountOpts(opts);

    const settings = Config.load();
    const [signer, inputToken, outputToken] = await Promise.all([
      Signer.load(opts.key ?? settings.activeKey),
      DatapiClient.resolveToken(opts.from),
      DatapiClient.resolveToken(opts.to),
    ]);

    const swap = await Swap.execute({
      signer,
      inputToken,
      outputToken,
      amount: opts.amount,
      rawAmount: opts.rawAmount,
    });

    const networkFee = NumberConverter.fromChainAmount(
      swap.networkFeeLamports.toString(),
      Asset.SOL.decimals
    );

    if (Output.isJson()) {
      Output.json({
        trader: signer.address,
        signature: swap.result.signature,
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
        inAmount: swap.inAmount,
        outAmount: swap.outAmount,
        inUsdValue: swap.order.inUsdValue,
        outUsdValue: swap.order.outUsdValue,
        priceImpact: swap.order.priceImpact,
        networkFeeLamports: swap.networkFeeLamports,
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
          value: `${swap.inAmount} ${inputToken.symbol} (${Output.formatDollar(swap.order.inUsdValue)})`,
        },
        {
          label: "Output",
          value: `${swap.outAmount} ${outputToken.symbol} (${Output.formatDollar(swap.order.outUsdValue)})`,
        },
        {
          label: "Network Fee",
          value: `${networkFee} SOL`,
        },
        {
          label: "Tx Signature",
          value: swap.result.signature,
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
        DatapiClient.getTokensSearch({
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
      reclaimableLamports?: string;
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
      const multiplier = Swap.getScaledUiMultiplier(info);
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
        reclaimableLamports: ata.reclaimableLamports,
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
    Swap.validateAmountOpts(opts);

    const settings = Config.load();
    const [signer, token] = await Promise.all([
      Signer.load(opts.key ?? settings.activeKey),
      DatapiClient.resolveToken(opts.token),
    ]);
    const multiplier = Swap.getScaledUiMultiplier(token);
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
      txResponse.feeAmount?.toString() ?? 0n,
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

  private static async history(opts: {
    key?: string;
    address?: string;
    token?: string;
    after?: string;
    before?: string;
    limit: string;
    offset?: string;
  }): Promise<void> {
    if (opts.address && opts.key) {
      throw new Error("Only one of --address or --key can be provided.");
    }

    const limit = Number(opts.limit);
    if (isNaN(limit) || limit <= 0) {
      throw new Error("--limit must be a positive number.");
    }

    const address =
      opts.address ??
      (await Signer.load(opts.key ?? Config.load().activeKey)).address;
    const targetAsset = opts.token
      ? await DatapiClient.resolveToken(opts.token)
      : undefined;
    const { userTrades, next } = await DatapiClient.getSwapsByAddress({
      address,
      assetId: targetAsset?.id,
      after: opts.after ? this.parseTimestamp(opts.after) : undefined,
      before: opts.before ? this.parseTimestamp(opts.before) : undefined,
      limit: opts.limit ? limit * 2 : undefined, // double bookkeeping
      offset: opts.offset,
    });

    // Group double-bookkeeping entries by txHash
    const grouped = new Map<string, SpotTrade[]>();
    for (const t of userTrades) {
      const existing = grouped.get(t.txHash);
      if (existing) {
        existing.push(t);
      } else {
        grouped.set(t.txHash, [t]);
      }
    }

    // Resolve token metadata for all unique mints
    const mints = [...new Set(userTrades.map((t) => t.assetId))];
    const tokenMap = new Map<string, Token>();
    if (mints.length > 0) {
      const tokens = await DatapiClient.getTokensSearch({
        query: mints.join(","),
        limit: mints.length.toString(),
      });
      for (const token of tokens) {
        tokenMap.set(token.id, token);
      }
    }

    const trades = [...grouped.values()]
      .map((entries) => {
        const sell = entries.find((e) => e.type === "sell");
        const buy = entries.find((e) => e.type === "buy");
        const inputInfo = sell ? tokenMap.get(sell.assetId) : undefined;
        const outputInfo = buy ? tokenMap.get(buy.assetId) : undefined;
        return {
          time: (sell ?? buy)!.blockTime,
          inputToken: inputInfo
            ? {
                id: inputInfo.id,
                symbol: inputInfo.symbol,
                decimals: inputInfo.decimals,
              }
            : null,
          outputToken: outputInfo
            ? {
                id: outputInfo.id,
                symbol: outputInfo.symbol,
                decimals: outputInfo.decimals,
              }
            : null,
          inAmount: sell ? String(sell.amount) : null,
          outAmount: buy ? String(buy.amount) : null,
          inUsdValue: sell ? sell.usdVolume : null,
          outUsdValue: buy ? buy.usdVolume : null,
          signature: (sell ?? buy)!.txHash,
        };
      })
      .slice(0, limit);

    if (Output.isJson()) {
      Output.json({
        trades,
        next,
      });
      return;
    }

    if (trades.length === 0) {
      throw new Error("No trades found.");
    }

    Output.table({
      type: "horizontal",
      headers: {
        time: "Time",
        input: "Input",
        output: "Output",
        signature: "Tx Signature",
      },
      rows: trades.map((t) => ({
        time: new Date(t.time).toLocaleString(),
        input: t.inAmount
          ? `${t.inAmount} ${t.inputToken?.symbol ?? "?"} (${Output.formatDollar(t.inUsdValue ?? undefined)})`
          : chalk.gray("\u2014"),
        output: t.outAmount
          ? `${t.outAmount} ${t.outputToken?.symbol ?? "?"} (${Output.formatDollar(t.outUsdValue ?? undefined)})`
          : chalk.gray("\u2014"),
        signature: t.signature,
      })),
    });

    if (next) {
      console.log("\nNext offset:", next);
    }
  }

  private static async reclaim(opts: {
    key?: string;
    token?: string;
  }): Promise<void> {
    const signer = await Signer.load(opts.key ?? Config.load().activeKey);
    const holdings = await UltraClient.getHoldings(signer.address);

    // Extract reclaimable mints from holdings ATAs
    const reclaimableMints: string[] = [];
    for (const [mint, accounts] of Object.entries(holdings.tokens)) {
      const ata = accounts.find((acc) => acc.isAssociatedTokenAccount);
      if (ata?.reclaimableLamports && BigInt(ata.reclaimableLamports) > 0n) {
        reclaimableMints.push(mint);
      }
    }

    // Filter to single token if --token provided
    let mints = reclaimableMints;
    if (opts.token) {
      const mint = isAddress(opts.token)
        ? opts.token
        : (await DatapiClient.resolveToken(opts.token)).id;
      mints = reclaimableMints.includes(mint) ? [mint] : [];
    }
    if (mints.length === 0) {
      throw new Error("No reclaimable token accounts found.");
    }

    // Chunk mints into batches of 200 and craft
    const MAX_MINTS_PER_REQUEST = 200;
    const batches: string[][] = [];
    for (let i = 0; i < mints.length; i += MAX_MINTS_PER_REQUEST) {
      batches.push(mints.slice(i, i + MAX_MINTS_PER_REQUEST));
    }
    const craftResponses = await Promise.all(
      batches.map((batch) =>
        UltraClient.postReclaimCraft({
          owner: signer.address,
          mints: batch,
        })
      )
    );

    // Aggregate across chunks
    const allTransactions: { requestId: string; transaction: string }[] = [];
    let netLamportsReclaimed = 0n;
    let networkFeeLamports = 0n;
    let totalValueReclaimed = 0;
    let skippedCount = 0;

    for (const r of craftResponses) {
      if (r.error) {
        throw new Error(r.error);
      }
      allTransactions.push(...r.transactions);
      netLamportsReclaimed += BigInt(r.netLamportsReclaimed);
      networkFeeLamports += BigInt(r.gasCostLamports);
      totalValueReclaimed += r.netReclaimedUsdAmount ?? 0;
      skippedCount += r.skippedMints?.length ?? 0;
    }

    if (allTransactions.length === 0) {
      throw new Error("No reclaimable token accounts found.");
    }

    // Sign and execute each transaction sequentially
    const signatures: string[] = [];
    for (const tx of allTransactions) {
      const signedTx = await signer.signTransaction(
        tx.transaction as Base64EncodedBytes
      );
      const result = await UltraClient.postReclaimExecute({
        requestId: tx.requestId,
        signedTransaction: signedTx,
      });
      if (result.status === "Failed") {
        throw new Error(result.error ?? "Reclaim transaction failed.");
      }
      signatures.push(result.signature);
    }

    if (Output.isJson()) {
      Output.json({
        totalLamportsReclaimed: Number(netLamportsReclaimed),
        totalValueReclaimed: totalValueReclaimed,
        networkFeeLamports: Number(networkFeeLamports),
        signatures,
      });
      return;
    }

    const reclaimedSol = NumberConverter.fromChainAmount(
      netLamportsReclaimed,
      Asset.SOL.decimals
    );
    const networkFee = NumberConverter.fromChainAmount(
      networkFeeLamports,
      Asset.SOL.decimals
    );
    const accountCount = mints.length - skippedCount;

    Output.table({
      type: "vertical",
      rows: [
        {
          label: "SOL Reclaimed",
          value: `${reclaimedSol} SOL (${Output.formatDollar(totalValueReclaimed)})`,
        },
        {
          label: "Accounts Reclaimed",
          value: `${accountCount} token account${accountCount !== 1 ? "s" : ""}`,
        },
        {
          label: "Network Fee",
          value: `${networkFee} SOL`,
        },
        ...signatures.map((sig, i) => ({
          label:
            signatures.length === 1 ? "Tx Signature" : `Tx Signature ${i + 1}`,
          value: sig,
        })),
      ],
    });
  }

  private static parseTimestamp(value: string): string {
    if (/^\d+$/.test(value)) {
      return new Date(Number(value) * 1000).toISOString();
    }
    const ms = new Date(value).getTime();
    if (isNaN(ms)) {
      throw new Error(`Invalid date: ${value}`);
    }
    return new Date(ms).toISOString();
  }
}
