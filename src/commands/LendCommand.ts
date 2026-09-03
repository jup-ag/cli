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
type BorrowVault = JupiterApiTypes.LendBorrowBorrowVault;
type BorrowPosition = JupiterApiTypes.LendBorrowBorrowPosition;
type BorrowToken = JupiterApiTypes.LendBorrowToken;
type BorrowMarket = JupiterApiTypes.LendBorrowMarket;

const MIN_I128 = "-170141183460469231731687303715884105728";

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
      .description("Lending, borrowing, and earning yield");
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
    const borrow = lend
      .command("borrow")
      .description("Borrow against collateral");
    borrow
      .command("vaults")
      .description("View borrow vaults with LTV and rates")
      .option("--market <market>", "Borrow market (main or ethena)", "main")
      .action((opts) => this.borrowVaults(opts));
    borrow
      .command("positions")
      .description("View borrow positions")
      .option("--key <name>", "Key to use (overrides active key)")
      .option("--address <address>", "Wallet address to look up")
      .option("--vault <id>", "Filter by vault ID")
      .option("--market <market>", "Borrow market (main or ethena)", "main")
      .action((opts) => this.borrowPositions(opts));
    borrow
      .command("operate")
      .description("Deposit, borrow, repay, or withdraw in one transaction")
      .requiredOption("--vault <id>", "Vault ID from `lend borrow vaults`")
      .option(
        "--position <id>",
        "Position NFT ID (0 creates a new position)",
        "0"
      )
      .option(
        "--collateral <amount>",
        "Collateral delta (positive deposits, negative withdraws, or 'all')"
      )
      .option(
        "--debt <amount>",
        "Debt delta (positive borrows, negative repays, or 'all')"
      )
      .option("--raw-collateral <n>", "Collateral delta in on-chain units")
      .option("--raw-debt <n>", "Debt delta in on-chain units")
      .option("--market <market>", "Borrow market (main or ethena)", "main")
      .option("--key <name>", "Key to use for signing")
      .option("--dry-run", "Preview without submitting the transaction")
      .action((opts) => {
        Config.dryRun = Config.resolveDryRun(opts.dryRun);
        return this.borrowOperate(opts);
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
    const address = await this.#resolveAddress(opts);

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
        Output.json({ address, positions: [] });
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
      Output.json({ address, positions });
      return;
    }

    Output.table({
      type: "vertical",
      rows: [{ label: "Address", value: address }],
    });
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
    const response = await this.#api.lend.lend.postLendV1EarnDeposit({
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
          address: signer.address,
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
          { label: "Address", value: signer.address },
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
        address: signer.address,
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
        { label: "Address", value: signer.address },
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
      const response = await this.#api.lend.lend.postLendV1EarnRedeem({
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
      const response = await this.#api.lend.lend.postLendV1EarnWithdraw({
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
          address: signer.address,
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
          { label: "Address", value: signer.address },
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
        address: signer.address,
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
        { label: "Address", value: signer.address },
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
    const response = await this.#api.lend.lend.getLendV1EarnTokens();
    if (response.error || !response.data) {
      throw new Error("Unable to get Lend tokens.");
    }
    return response.data;
  }

  static async #getPositions(
    users: string
  ): Promise<JupiterApiTypes.LendUserPositionsResponse> {
    const response = await this.#api.lend.lend.getLendV1EarnPositions({
      query: { users },
    });
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
    const response = await this.#api.lend.lend.getLendV1EarnEarnings({
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

  private static async borrowVaults(opts: { market?: string }): Promise<void> {
    requireJupiterApiKey();
    const market = this.#parseMarket(opts.market);
    const vaults = await this.#getBorrowVaults(market);
    const rows = vaults.map((vault) => this.#mapBorrowVault(vault));

    if (Output.isJson()) {
      Output.json({ market, vaults: rows });
      return;
    }

    Output.table({
      type: "horizontal",
      headers: {
        vault: "Vault",
        pair: "Pair",
        ltv: "LTV",
        borrowApy: "Borrow APY",
        borrowable: "Borrowable",
      },
      rows: rows.map((vault) => ({
        vault: String(vault.vaultId),
        pair: `${vault.supplyToken.symbol}/${vault.borrowToken.symbol}`,
        ltv: this.#formatPct(vault.ltvPct),
        borrowApy: Output.formatPercentageChange(
          vault.borrowApyPct ?? undefined
        ),
        borrowable: Output.formatDollar(vault.borrowableUsd),
      })),
    });
  }

  private static async borrowPositions(opts: {
    key?: string;
    address?: string;
    vault?: string;
    market?: string;
  }): Promise<void> {
    requireJupiterApiKey();
    const market = this.#parseMarket(opts.market);
    const address = await this.#resolveAddress(opts);

    let positions = (await this.#getBorrowPositions(address, market)).filter(
      (position) =>
        position.supply !== "0" ||
        position.borrow !== "0" ||
        position.dustBorrow !== "0"
    );

    if (opts.vault) {
      const vaultId = this.#parseVaultId(opts.vault);
      positions = positions.filter((position) => position.vaultId === vaultId);
    }

    if (positions.length === 0) {
      if (Output.isJson()) {
        Output.json({ address, market, positions: [] });
        return;
      }
      throw new Error("No active borrow positions found.");
    }

    const rows = positions.map((position) => this.#mapBorrowPosition(position));

    if (Output.isJson()) {
      Output.json({ address, market, positions: rows });
      return;
    }

    Output.table({
      type: "vertical",
      rows: [{ label: "Address", value: address }],
    });
    Output.table({
      type: "horizontal",
      headers: {
        position: "Position",
        vault: "Vault",
        collateral: "Collateral",
        debt: "Debt",
        ltv: "LTV",
      },
      rows: rows.map((position) => ({
        position: String(position.positionId),
        vault: String(position.vaultId),
        collateral: this.#formatTokenValue(
          position.collateralAmount,
          position.supplyToken.symbol,
          position.collateralUsd
        ),
        debt: this.#formatTokenValue(
          position.debtAmount,
          position.borrowToken.symbol,
          position.debtUsd
        ),
        ltv: this.#formatPct(position.ltvPct),
      })),
    });
  }

  private static async borrowOperate(opts: {
    vault: string;
    position?: string;
    collateral?: string;
    debt?: string;
    rawCollateral?: string;
    rawDebt?: string;
    market?: string;
    key?: string;
  }): Promise<void> {
    requireJupiterApiKey();
    this.#validateOperateAmountOpts(opts);

    const market = this.#parseMarket(opts.market);
    const vaultId = this.#parseVaultId(opts.vault);
    const positionId = this.#parsePositionId(opts.position ?? "0");
    const vault = (await this.#getBorrowVaults(market)).find(
      (candidate) => candidate.id === vaultId
    );
    if (!vault) {
      throw new Error(
        `Vault ${vaultId} was not found in the ${market} market.`
      );
    }

    const settings = Config.load();
    const signer = await Signer.load(opts.key ?? settings.activeKey);
    const colAmount = this.#resolveOperateAmount(
      opts.collateral,
      opts.rawCollateral,
      vault.supplyToken.decimals,
      "collateral"
    );
    const debtAmount = this.#resolveOperateAmount(
      opts.debt,
      opts.rawDebt,
      vault.borrowToken.decimals,
      "debt"
    );

    const response = await this.#api.lend.borrow.buildBorrowOperateTransaction({
      body: {
        vaultId,
        positionId,
        signer: signer.address,
        colAmount,
        debtAmount,
      },
      query: { market },
    });
    if (response.error || !response.data) {
      throw new Error("Unable to build the Lend borrow transaction.");
    }

    const nftId = response.data.nftId;
    const supplyToken = this.#borrowToken(vault.supplyToken);
    const borrowToken = this.#borrowToken(vault.borrowToken);
    const collateralDelta = this.#formatOperateDelta(
      colAmount,
      vault.supplyToken.decimals
    );
    const debtDelta = this.#formatOperateDelta(
      debtAmount,
      vault.borrowToken.decimals
    );
    const submission = await this.#submitTransaction(
      signer,
      response.data.transaction
    );

    if (Config.dryRun) {
      if (Output.isJson()) {
        Output.json({
          dryRun: true,
          address: signer.address,
          market,
          vaultId,
          positionId: nftId,
          supplyToken,
          borrowToken,
          collateralDelta,
          debtDelta,
          serializedTransaction: submission.serializedTransaction,
          simulation: submission.simulation!,
        });
        return;
      }

      console.log(Output.DRY_RUN_LABEL);
      Output.table({
        type: "vertical",
        rows: [
          { label: "Address", value: signer.address },
          { label: "Market", value: market },
          { label: "Vault", value: String(vaultId) },
          { label: "Position", value: String(nftId) },
          {
            label: "Collateral",
            value: `${collateralDelta} ${supplyToken.symbol}`,
          },
          {
            label: "Debt",
            value: `${debtDelta} ${borrowToken.symbol}`,
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

    const current = await this.#fetchBorrowPosition(
      signer.address,
      nftId,
      market
    );

    if (Output.isJson()) {
      Output.json({
        address: signer.address,
        market,
        vaultId,
        positionId: nftId,
        supplyToken,
        borrowToken,
        collateralDelta,
        debtDelta,
        collateralAmount: current?.collateralAmount ?? 0,
        collateralUsd: current?.collateralUsd ?? 0,
        debtAmount: current?.debtAmount ?? 0,
        debtUsd: current?.debtUsd ?? 0,
        ltvPct: current?.ltvPct ?? null,
        signature: submission.signature!,
      });
      return;
    }

    Output.table({
      type: "vertical",
      rows: [
        { label: "Address", value: signer.address },
        { label: "Market", value: market },
        { label: "Vault", value: String(vaultId) },
        { label: "Position", value: String(nftId) },
        {
          label: "Collateral",
          value: `${collateralDelta} ${supplyToken.symbol}`,
        },
        {
          label: "Debt",
          value: `${debtDelta} ${borrowToken.symbol}`,
        },
        {
          label: "Position Collateral",
          value: current
            ? this.#formatTokenValue(
                current.collateralAmount,
                supplyToken.symbol,
                current.collateralUsd
              )
            : "0",
        },
        {
          label: "Position Debt",
          value: current
            ? this.#formatTokenValue(
                current.debtAmount,
                borrowToken.symbol,
                current.debtUsd
              )
            : "0",
        },
        { label: "Tx Signature", value: submission.signature! },
      ],
    });
  }

  static async #getBorrowVaults(market: BorrowMarket): Promise<BorrowVault[]> {
    const response = await this.#api.lend.borrow.listBorrowVaults({
      query: { market },
    });
    if (response.error || !response.data) {
      throw new Error("Unable to get borrow vaults.");
    }
    return response.data;
  }

  static async #getBorrowPositions(
    users: string,
    market: BorrowMarket
  ): Promise<BorrowPosition[]> {
    const response = await this.#api.lend.borrow.listBorrowPositions({
      query: { users, market },
    });
    if (response.error || !response.data) {
      throw new Error("Unable to get borrow positions.");
    }
    return response.data;
  }

  static async #fetchBorrowPosition(
    address: string,
    positionId: number,
    market: BorrowMarket
  ) {
    const positions = await this.#getBorrowPositions(address, market);
    const position = positions.find((candidate) => candidate.id === positionId);
    return position ? this.#mapBorrowPosition(position) : null;
  }

  static #mapBorrowVault(vault: BorrowVault) {
    const supply = this.#tokenUsd(vault.totalSupply, vault.supplyToken);
    const borrow = this.#tokenUsd(vault.totalBorrow, vault.borrowToken);
    const borrowable = this.#tokenUsd(vault.borrowable, vault.borrowToken);
    const withdrawable = this.#tokenUsd(vault.withdrawable, vault.supplyToken);
    return {
      vaultId: vault.id,
      address: vault.address,
      supplyToken: this.#borrowToken(vault.supplyToken),
      borrowToken: this.#borrowToken(vault.borrowToken),
      ltvPct: this.#factorToPct(vault.collateralFactor),
      liquidationThresholdPct: this.#factorToPct(vault.liquidationThreshold),
      supplyApyPct: vault.supplyRate ? this.rateToPct(vault.supplyRate) : null,
      borrowApyPct: vault.borrowRate ? this.rateToPct(vault.borrowRate) : null,
      totalSupplyUsd: supply.usd,
      totalBorrowUsd: borrow.usd,
      borrowableUsd: borrowable.usd,
      withdrawableUsd: withdrawable.usd,
      minimumBorrowingAmount: Number(
        NumberConverter.fromChainAmount(
          vault.minimumBorrowing ?? "0",
          vault.borrowToken.decimals
        )
      ),
      totalPositions: vault.totalPositions ?? null,
    };
  }

  static #mapBorrowPosition(position: BorrowPosition) {
    const vault = position.vault;
    const debtRaw =
      position.dustBorrow && position.dustBorrow !== "0"
        ? position.dustBorrow
        : position.borrow;
    const collateral = this.#tokenUsd(position.supply, vault.supplyToken);
    const debt = this.#tokenUsd(debtRaw, vault.borrowToken);
    return {
      positionId: position.id,
      positionPubkey: position.address,
      vaultId: position.vaultId,
      supplyToken: this.#borrowToken(vault.supplyToken),
      borrowToken: this.#borrowToken(vault.borrowToken),
      collateralAmount: collateral.amount,
      collateralUsd: collateral.usd,
      debtAmount: debt.amount,
      debtUsd: debt.usd,
      ltvPct: collateral.usd > 0 ? (debt.usd / collateral.usd) * 100 : null,
      isLiquidated: position.isLiquidated,
    };
  }

  static #borrowToken(token: BorrowToken): {
    id: string;
    symbol: string;
    decimals: number;
  } {
    return {
      id: token.address,
      symbol: token.uiSymbol || token.symbol,
      decimals: token.decimals,
    };
  }

  static #tokenUsd(
    amount: string | undefined,
    token: BorrowToken
  ): { amount: number; usd: number } {
    const human = Number(
      NumberConverter.fromChainAmount(amount ?? "0", token.decimals)
    );
    return { amount: human, usd: human * Number(token.price) };
  }

  static async #resolveAddress(opts: {
    key?: string;
    address?: string;
  }): Promise<string> {
    if (opts.address && opts.key) {
      throw new Error("Only one of --address or --key can be provided.");
    }
    return (
      opts.address ??
      (await Signer.loadAddress(opts.key ?? Config.load().activeKey))
    );
  }

  static #parseMarket(value?: string): BorrowMarket {
    const market = (value ?? "main").toLowerCase();
    if (market !== "main" && market !== "ethena") {
      throw new Error("Invalid --market. Must be main or ethena.");
    }
    return market;
  }

  static #parseVaultId(value: string): number {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Invalid --vault. Must be a positive integer.");
    }
    return id;
  }

  static #parsePositionId(value: string): number {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 0) {
      throw new Error("Invalid --position. Must be a non-negative integer.");
    }
    return id;
  }

  static #validateOperateAmountOpts(opts: {
    collateral?: string;
    debt?: string;
    rawCollateral?: string;
    rawDebt?: string;
  }): void {
    if (
      !opts.collateral &&
      !opts.debt &&
      !opts.rawCollateral &&
      !opts.rawDebt
    ) {
      throw new Error(
        "Provide --collateral, --debt, --raw-collateral, or --raw-debt."
      );
    }
  }

  static #resolveOperateAmount(
    human: string | undefined,
    raw: string | undefined,
    decimals: number,
    kind: "collateral" | "debt"
  ): string {
    if (human && raw) {
      throw new Error(
        `Only one of --${kind} or --raw-${kind} can be provided.`
      );
    }
    if (!human && !raw) {
      return "0";
    }
    if (raw) {
      return raw;
    }
    if (human!.toLowerCase() === "all") {
      return MIN_I128;
    }
    return NumberConverter.toChainAmount(human!, decimals);
  }

  static #formatOperateDelta(raw: string, decimals: number): string {
    if (raw === MIN_I128) {
      return "all";
    }
    return NumberConverter.fromChainAmount(raw, decimals);
  }

  static #formatTokenValue(
    amount: number,
    symbol: string,
    usd: number
  ): string {
    return `${amount.toLocaleString("en-US", {
      maximumFractionDigits: 6,
    })} ${symbol} (${Output.formatDollar(usd)})`;
  }

  static #formatPct(value: number | null): string {
    if (value === null) {
      return "\u2014";
    }
    return `${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
  }

  static #factorToPct(factor: string | undefined): number | null {
    if (factor === undefined) {
      return null;
    }
    return Number(factor) / 10;
  }

  private static rateToPct(rate: string): number {
    return Number(rate) / 100;
  }
}
