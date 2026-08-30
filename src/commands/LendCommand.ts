import type { Base64EncodedBytes } from "@solana/kit";
import type { Command } from "commander";
import type { JupiterApi, JupiterApiTypes } from "jupiter-api-ts";

import { Config } from "../lib/Config.ts";
import { requireJupiterApiKey } from "../lib/JupiterApi.ts";
import { NumberConverter } from "../lib/NumberConverter.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";
import type { SolanaRpc } from "../lib/SolanaRpc.ts";

type LendToken = JupiterApiTypes.LendTokenInfo;

type LendTransactionSubmission = {
  serializedTransaction: string;
  signature?: string;
  simulation?: {
    success: boolean;
    error?: string;
  };
};

export class LendCommand {
  static #api: JupiterApi;
  static #rpc: SolanaRpc;

  public static register(
    program: Command,
    rpc: SolanaRpc,
    api: JupiterApi
  ): void {
    this.#rpc = rpc;
    this.#api = api;
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
      .option("--dry-run", "Preview without submitting the transaction")
      .action((opts) => {
        Config.dryRun = Config.resolveDryRun(opts.dryRun);
        return this.deposit(opts);
      });
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
      .option("--dry-run", "Preview without submitting the transaction")
      .action((opts) => {
        Config.dryRun = Config.resolveDryRun(opts.dryRun);
        return this.withdraw(opts);
      });
  }

  private static async tokens(): Promise<void> {
    requireJupiterApiKey();
    const lendTokens = await this.#getTokens();

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
    requireJupiterApiKey();
    if (opts.address && opts.key) {
      throw new Error("Only one of --address or --key can be provided.");
    }

    const address =
      opts.address ??
      (await Signer.loadAddress(opts.key ?? Config.load().activeKey));

    const allPositions = await this.#getPositions(address);
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
    const earnings = await this.#getEarnings({
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
    requireJupiterApiKey();
    this.#validateAmountOpts(opts);

    const lendTokens = await this.#getTokens();
    const lendToken = this.resolveLendToken(lendTokens, opts.token);

    const settings = Config.load();
    const signer = await Signer.load(opts.key ?? settings.activeKey);
    const rawAmount =
      opts.rawAmount ??
      NumberConverter.toChainAmount(opts.amount!, lendToken.asset.decimals);
    const response = await this.#api.lend.lend.post({
      body: {
        asset: lendToken.assetAddress,
        signer: signer.address,
        amount: rawAmount,
      },
    });
    if (response.error || !response.data) {
      throw new Error("Unable to build the Lend deposit transaction.");
    }

    const apyPct = this.rateToPct(lendToken.totalRate);
    const depositedAmount = NumberConverter.fromChainAmount(
      rawAmount,
      lendToken.asset.decimals
    );
    const submission = await this.#submitTransaction(
      signer,
      response.data.transaction
    );

    if (Config.dryRun) {
      if (Output.isJson()) {
        Output.json({
          dryRun: true,
          token: {
            id: lendToken.assetAddress,
            symbol: lendToken.asset.symbol,
            decimals: lendToken.asset.decimals,
          },
          depositedAmount,
          apyPct,
          serializedTransaction: submission.serializedTransaction,
          simulation: submission.simulation!,
        });
        return;
      }

      console.log(Output.DRY_RUN_LABEL);
      Output.table({
        type: "vertical",
        rows: [
          {
            label: "Deposited",
            value: `${depositedAmount} ${lendToken.asset.symbol}`,
          },
          {
            label: "APY",
            value: Output.formatPercentageChange(apyPct),
          },
          {
            label: "Serialized Transaction",
            value: submission.serializedTransaction,
          },
          {
            label: "Simulation",
            value: submission.simulation!.success ? "Passed" : "Failed",
          },
          ...(submission.simulation!.error
            ? [{ label: "Error", value: submission.simulation!.error }]
            : []),
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
        depositedAmount,
        positionAmount,
        positionUsd: positionAmount * price,
        apyPct,
        signature: submission.signature!,
      });
      return;
    }

    Output.table({
      type: "vertical",
      rows: [
        {
          label: "Deposited",
          value: `${depositedAmount} ${lendToken.asset.symbol}`,
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
          value: submission.signature!,
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
    requireJupiterApiKey();
    this.#validateWithdrawAmountOpts(opts);

    const lendTokens = await this.#getTokens();
    const lendToken = this.resolveLendToken(lendTokens, opts.token);

    const settings = Config.load();
    const signer = await Signer.load(opts.key ?? settings.activeKey);

    let withdrawnRawAmount: string;
    let transaction: string;

    if (!opts.amount && !opts.rawAmount) {
      const positions = await this.#getPositions(signer.address);
      const position = positions.find(
        (p) => p.token.address === lendToken.address
      );
      if (!position || position.shares === "0") {
        throw new Error(
          `No lending position found for ${lendToken.asset.symbol}.`
        );
      }
      const response = await this.#api.lend.lend.post7({
        body: {
          asset: lendToken.assetAddress,
          signer: signer.address,
          shares: position.shares,
        },
      });
      if (response.error || !response.data) {
        throw new Error("Unable to build the Lend redeem transaction.");
      }
      transaction = response.data.transaction;
      withdrawnRawAmount = (
        (BigInt(position.shares) * BigInt(lendToken.convertToAssets)) /
        BigInt(10 ** lendToken.decimals)
      ).toString();
    } else {
      withdrawnRawAmount =
        opts.rawAmount ??
        NumberConverter.toChainAmount(opts.amount!, lendToken.asset.decimals);
      const response = await this.#api.lend.lend.post3({
        body: {
          asset: lendToken.assetAddress,
          signer: signer.address,
          amount: withdrawnRawAmount,
        },
      });
      if (response.error || !response.data) {
        throw new Error("Unable to build the Lend withdraw transaction.");
      }
      transaction = response.data.transaction;
    }

    const apyPct = this.rateToPct(lendToken.totalRate);
    const withdrawnAmount = NumberConverter.fromChainAmount(
      withdrawnRawAmount,
      lendToken.asset.decimals
    );
    const submission = await this.#submitTransaction(signer, transaction);

    if (Config.dryRun) {
      if (Output.isJson()) {
        Output.json({
          dryRun: true,
          token: {
            id: lendToken.assetAddress,
            symbol: lendToken.asset.symbol,
            decimals: lendToken.asset.decimals,
          },
          withdrawnAmount,
          apyPct,
          serializedTransaction: submission.serializedTransaction,
          simulation: submission.simulation!,
        });
        return;
      }

      console.log(Output.DRY_RUN_LABEL);
      Output.table({
        type: "vertical",
        rows: [
          {
            label: "Withdrawn",
            value: `${withdrawnAmount} ${lendToken.asset.symbol}`,
          },
          {
            label: "APY",
            value: Output.formatPercentageChange(apyPct),
          },
          {
            label: "Serialized Transaction",
            value: submission.serializedTransaction,
          },
          {
            label: "Simulation",
            value: submission.simulation!.success ? "Passed" : "Failed",
          },
          ...(submission.simulation!.error
            ? [{ label: "Error", value: submission.simulation!.error }]
            : []),
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
        withdrawnAmount,
        positionAmount,
        positionUsd: positionAmount * price,
        apyPct,
        signature: submission.signature!,
      });
      return;
    }

    Output.table({
      type: "vertical",
      rows: [
        {
          label: "Withdrawn",
          value: `${withdrawnAmount} ${lendToken.asset.symbol}`,
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
          value: submission.signature!,
        },
      ],
    });
  }

  private static async fetchCurrentPosition(
    address: string,
    lendToken: LendToken
  ): Promise<{ positionAmount: number; price: number }> {
    const positions = await this.#getPositions(address);
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

  static async #getTokens(): Promise<JupiterApiTypes.LendTokensResponse> {
    const response = await this.#api.lend.lend.get();
    if (response.error || !response.data) {
      throw new Error("Unable to get Lend tokens.");
    }
    return response.data;
  }

  static async #getPositions(
    users: string
  ): Promise<JupiterApiTypes.LendUserPositionsResponse> {
    const response = await this.#api.lend.lend.get2({ query: { users } });
    if (response.error || !response.data) {
      throw new Error("Unable to get Lend positions.");
    }
    return response.data;
  }

  static async #getEarnings({
    user,
    positions,
  }: {
    user: string;
    positions: string;
  }): Promise<JupiterApiTypes.LendUserEarningsResponse[]> {
    const response = await this.#api.lend.lend.get3({
      query: { user, positions },
    });
    if (response.error || !response.data) {
      throw new Error("Unable to get Lend earnings.");
    }
    return [response.data];
  }

  static #validateAmountOpts(opts: {
    amount?: string;
    rawAmount?: string;
  }): void {
    if (!opts.amount && !opts.rawAmount) {
      throw new Error("Either --amount or --raw-amount must be provided.");
    }
    this.#validateWithdrawAmountOpts(opts);
  }

  static #validateWithdrawAmountOpts(opts: {
    amount?: string;
    rawAmount?: string;
  }): void {
    if (opts.amount && opts.rawAmount) {
      throw new Error("Only one of --amount or --raw-amount can be provided.");
    }
  }

  static async #submitTransaction(
    signer: Signer,
    transaction: string
  ): Promise<LendTransactionSubmission> {
    const serializedTransaction = await signer.signTransaction(
      transaction as Base64EncodedBytes
    );
    if (Config.dryRun) {
      return {
        serializedTransaction,
        simulation: await this.#rpc.simulate(serializedTransaction),
      };
    }
    return {
      serializedTransaction,
      signature: await this.#rpc.send(serializedTransaction),
    };
  }

  private static rateToPct(rate: string): number {
    return Number(rate) / 100;
  }
}
