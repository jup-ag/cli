import type { Command } from "commander";

import { DatapiClient } from "../clients/DatapiClient.ts";
import { LendClient, type LendToken } from "../clients/LendClient.ts";
import { Config } from "../lib/Config.ts";
import { NumberConverter } from "../lib/NumberConverter.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";
import { Swap } from "../lib/Swap.ts";

export class LendCommand {
  public static register(program: Command): void {
    const lend = program
      .command("lend")
      .description("Lending and earning yield");
    const earn = lend
      .command("earn")
      .description("Earn yield by lending tokens");
    earn
      .command("tokens")
      .description("View tokens available for lending with APY")
      .action(() => this.tokens());
    earn
      .command("positions")
      .description("View lending positions with earnings")
      .option("--key <name>", "Key to use (overrides active key)")
      .option("--address <address>", "Wallet address to look up")
      .option("--token <token>", "Filter by token (symbol or mint address)")
      .action((opts) => this.positions(opts));
    earn
      .command("deposit")
      .description("Deposit tokens into lending")
      .requiredOption(
        "--token <token>",
        "Token to deposit (symbol or mint address)"
      )
      .option("--amount <n>", "Amount in human-readable units")
      .option(
        "--raw-amount <n>",
        "Amount in on-chain units (no decimal conversion)"
      )
      .option("--key <name>", "Key to use for signing")
      .action((opts) => this.deposit(opts));
    earn
      .command("withdraw")
      .description("Withdraw tokens from lending")
      .requiredOption(
        "--token <token>",
        "Token to withdraw (symbol, jlToken symbol, or mint address)"
      )
      .option("--amount <n>", "Amount in human-readable units")
      .option(
        "--raw-amount <n>",
        "Amount in on-chain units (no decimal conversion)"
      )
      .option("--key <name>", "Key to use for signing")
      .action((opts) => this.withdraw(opts));
  }

  private static async tokens(): Promise<void> {
    const lendTokens = await LendClient.getTokens();

    const tokens = lendTokens.map((lt) => {
      const price = Number(lt.asset.price);
      const tvl =
        Number(NumberConverter.fromChainAmount(lt.totalAssets, lt.decimals)) *
        price;
      const withdrawable =
        Number(
          NumberConverter.fromChainAmount(
            lt.liquiditySupplyData.withdrawable,
            lt.decimals
          )
        ) * price;
      return {
        token: {
          id: lt.assetAddress,
          symbol: lt.asset.symbol,
          decimals: lt.asset.decimals,
        },
        jlToken: {
          id: lt.address,
          symbol: lt.symbol,
          decimals: lt.decimals,
        },
        apyPct: this.rateToPct(lt.totalRate),
        supplyApyPct: this.rateToPct(lt.supplyRate),
        rewardsApyPct: this.rateToPct(lt.rewardsRate),
        totalTvlUsd: tvl,
        withdrawableUsd: withdrawable,
        priceUsd: price,
      };
    });

    if (Output.isJson()) {
      Output.json({ tokens });
      return;
    }

    Output.table({
      type: "horizontal",
      headers: {
        token: "Token",
        apy: "APY",
        tvl: "TVL",
        withdrawable: "Withdrawable",
      },
      rows: tokens.map((t) => ({
        token: t.token.symbol,
        apy: Output.formatPercentageChange(t.apyPct),
        tvl: Output.formatDollar(t.totalTvlUsd),
        withdrawable: Output.formatDollar(t.withdrawableUsd),
      })),
    });
  }

  private static async positions(opts: {
    key?: string;
    address?: string;
    token?: string;
  }): Promise<void> {
    if (opts.address && opts.key) {
      throw new Error("Only one of --address or --key can be provided.");
    }

    const address =
      opts.address ??
      (await Signer.loadAddress(opts.key ?? Config.load().activeKey));

    const allPositions = await LendClient.getPositions(address);
    let activePositions = allPositions.filter((p) => p.shares !== "0");

    if (opts.token) {
      const filter = opts.token.toLowerCase();
      activePositions = activePositions.filter(
        (p) =>
          p.token.asset.symbol.toLowerCase() === filter ||
          p.token.assetAddress.toLowerCase() === filter
      );
    }

    if (activePositions.length === 0) {
      if (Output.isJson()) {
        Output.json({ positions: [] });
        return;
      }
      throw new Error("No active lending positions found.");
    }

    const jlAddresses = activePositions.map((p) => p.token.address).join(",");
    const earnings = await LendClient.getEarnings({
      user: address,
      positions: jlAddresses,
    });
    const earningsMap = new Map(earnings.map((e) => [e.address, e.earnings]));

    const positions = activePositions.map((p) => {
      const price = Number(p.token.asset.price);
      const currentAmount = Number(
        NumberConverter.fromChainAmount(
          p.underlyingAssets,
          p.token.asset.decimals
        )
      );
      const rawEarnings = earningsMap.get(p.token.assetAddress) ?? 0;
      const earningsAmount = Number(
        NumberConverter.fromChainAmount(
          rawEarnings.toString(),
          p.token.asset.decimals
        )
      );
      return {
        token: {
          id: p.token.assetAddress,
          symbol: p.token.asset.symbol,
          decimals: p.token.asset.decimals,
        },
        jlToken: {
          id: p.token.address,
          symbol: p.token.symbol,
          decimals: p.token.decimals,
        },
        positionAmount: currentAmount,
        positionUsd: currentAmount * price,
        earningsAmount,
        earningsUsd: earningsAmount * price,
        apyPct: this.rateToPct(p.token.totalRate),
      };
    });

    if (Output.isJson()) {
      Output.json({ positions });
      return;
    }

    Output.table({
      type: "horizontal",
      headers: {
        token: "Token",
        apy: "APY",
        position: "Position",
        earnings: "Earnings",
      },
      rows: positions.map((p) => ({
        token: p.token.symbol,
        apy: Output.formatPercentageChange(p.apyPct),
        position: `${p.positionAmount.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${p.token.symbol} (${Output.formatDollar(p.positionUsd)})`,
        earnings: Output.formatDollarChange(p.earningsUsd),
      })),
    });
  }

  private static async deposit(opts: {
    token: string;
    amount?: string;
    rawAmount?: string;
    key?: string;
  }): Promise<void> {
    Swap.validateAmountOpts(opts);

    const lendTokens = await LendClient.getTokens();
    const lendToken = this.resolveLendToken(lendTokens, opts.token);

    const settings = Config.load();
    const [signer, inputToken, outputToken] = await Promise.all([
      Signer.load(opts.key ?? settings.activeKey),
      DatapiClient.resolveToken(lendToken.assetAddress),
      DatapiClient.resolveToken(lendToken.address),
    ]);

    const swap = await Swap.execute({
      signer,
      inputToken,
      outputToken,
      amount: opts.amount,
      rawAmount: opts.rawAmount,
    });

    const apyPct = this.rateToPct(lendToken.totalRate);

    if (Config.dryRun) {
      if (Output.isJson()) {
        Output.json({
          dryRun: true,
          token: {
            id: lendToken.assetAddress,
            symbol: lendToken.asset.symbol,
            decimals: lendToken.asset.decimals,
          },
          depositedAmount: swap.inAmount,
          depositedUsd: swap.order.inUsdValue,
          apyPct,
          signature: null,
          transaction: swap.order.transaction,
        });
        return;
      }

      console.log(Output.DRY_RUN_LABEL);
      Output.table({
        type: "vertical",
        rows: [
          {
            label: "Deposited",
            value: `${swap.inAmount} ${lendToken.asset.symbol} (${Output.formatDollar(swap.order.inUsdValue)})`,
          },
          {
            label: "APY",
            value: Output.formatPercentageChange(apyPct),
          },
        ],
      });
      return;
    }

    const { positionAmount, price } = await this.fetchCurrentPosition(
      signer.address,
      lendToken
    );

    if (Output.isJson()) {
      Output.json({
        token: {
          id: lendToken.assetAddress,
          symbol: lendToken.asset.symbol,
          decimals: lendToken.asset.decimals,
        },
        depositedAmount: swap.inAmount,
        depositedUsd: swap.order.inUsdValue,
        positionAmount,
        positionUsd: positionAmount * price,
        apyPct,
        signature: swap.result!.signature,
      });
      return;
    }

    Output.table({
      type: "vertical",
      rows: [
        {
          label: "Deposited",
          value: `${swap.inAmount} ${lendToken.asset.symbol} (${Output.formatDollar(swap.order.inUsdValue)})`,
        },
        {
          label: "Position",
          value: `${positionAmount.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${lendToken.asset.symbol} (${Output.formatDollar(positionAmount * price)})`,
        },
        {
          label: "APY",
          value: Output.formatPercentageChange(apyPct),
        },
        {
          label: "Tx Signature",
          value: swap.result!.signature,
        },
      ],
    });
  }

  private static async withdraw(opts: {
    token: string;
    amount?: string;
    rawAmount?: string;
    key?: string;
  }): Promise<void> {
    if (opts.amount && opts.rawAmount) {
      throw new Error("Only one of --amount or --raw-amount can be provided.");
    }

    const lendTokens = await LendClient.getTokens();
    const lendToken = this.resolveLendToken(lendTokens, opts.token);

    const settings = Config.load();
    const signer = await Signer.load(opts.key ?? settings.activeKey);

    let rawAmount = opts.rawAmount;

    if (!opts.amount && !opts.rawAmount) {
      // Withdraw entire position — use full shares balance
      const positions = await LendClient.getPositions(signer.address);
      const position = positions.find(
        (p) => p.token.address === lendToken.address
      );
      if (!position || position.shares === "0") {
        throw new Error(
          `No lending position found for ${lendToken.asset.symbol}.`
        );
      }
      rawAmount = position.shares;
    } else if (opts.amount) {
      // Convert underlying amount to jlToken amount using convertToShares
      const chainAmount = NumberConverter.toChainAmount(
        opts.amount,
        lendToken.asset.decimals
      );
      const shares =
        (BigInt(chainAmount) * BigInt(lendToken.convertToShares)) /
        BigInt(10 ** lendToken.decimals);
      rawAmount = shares.toString();
    }

    const [inputToken, outputToken] = await Promise.all([
      DatapiClient.resolveToken(lendToken.address),
      DatapiClient.resolveToken(lendToken.assetAddress),
    ]);

    const swap = await Swap.execute({
      signer,
      inputToken,
      outputToken,
      rawAmount,
    });

    const apyPct = this.rateToPct(lendToken.totalRate);

    if (Config.dryRun) {
      if (Output.isJson()) {
        Output.json({
          dryRun: true,
          token: {
            id: lendToken.assetAddress,
            symbol: lendToken.asset.symbol,
            decimals: lendToken.asset.decimals,
          },
          withdrawnAmount: swap.outAmount,
          withdrawnUsd: swap.order.outUsdValue,
          apyPct,
          signature: null,
          transaction: swap.order.transaction,
        });
        return;
      }

      console.log(Output.DRY_RUN_LABEL);
      Output.table({
        type: "vertical",
        rows: [
          {
            label: "Withdrawn",
            value: `${swap.outAmount} ${lendToken.asset.symbol} (${Output.formatDollar(swap.order.outUsdValue)})`,
          },
          {
            label: "APY",
            value: Output.formatPercentageChange(apyPct),
          },
        ],
      });
      return;
    }

    const { positionAmount, price } = await this.fetchCurrentPosition(
      signer.address,
      lendToken
    );

    if (Output.isJson()) {
      Output.json({
        token: {
          id: lendToken.assetAddress,
          symbol: lendToken.asset.symbol,
          decimals: lendToken.asset.decimals,
        },
        withdrawnAmount: swap.outAmount,
        withdrawnUsd: swap.order.outUsdValue,
        positionAmount,
        positionUsd: positionAmount * price,
        apyPct,
        signature: swap.result!.signature,
      });
      return;
    }

    Output.table({
      type: "vertical",
      rows: [
        {
          label: "Withdrawn",
          value: `${swap.outAmount} ${lendToken.asset.symbol} (${Output.formatDollar(swap.order.outUsdValue)})`,
        },
        {
          label: "Position",
          value: `${positionAmount.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${lendToken.asset.symbol} (${Output.formatDollar(positionAmount * price)})`,
        },
        {
          label: "APY",
          value: Output.formatPercentageChange(apyPct),
        },
        {
          label: "Tx Signature",
          value: swap.result!.signature,
        },
      ],
    });
  }

  private static async fetchCurrentPosition(
    address: string,
    lendToken: LendToken
  ): Promise<{ positionAmount: number; price: number }> {
    const positions = await LendClient.getPositions(address);
    const position = positions.find(
      (p) => p.token.address === lendToken.address
    );
    const price = Number(lendToken.asset.price);
    const positionAmount = position
      ? Number(
          NumberConverter.fromChainAmount(
            position.underlyingAssets,
            lendToken.asset.decimals
          )
        )
      : 0;
    return { positionAmount, price };
  }

  private static resolveLendToken(
    lendTokens: LendToken[],
    input: string
  ): LendToken {
    const query = input.toLowerCase();
    const match = lendTokens.find(
      (lt) =>
        lt.asset.symbol.toLowerCase() === query ||
        lt.assetAddress.toLowerCase() === query ||
        lt.symbol.toLowerCase() === query ||
        lt.address.toLowerCase() === query
    );
    if (!match) {
      const available = lendTokens.map((lt) => lt.asset.symbol).join(", ");
      throw new Error(
        `Token "${input}" is not available for lending. Available: ${available}`
      );
    }
    return match;
  }

  private static rateToPct(rate: string): number {
    return Number(rate) / 100;
  }
}
