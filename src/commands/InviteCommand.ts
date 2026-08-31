import {
  address,
  getBase58Decoder,
  getBase58Encoder,
  getProgramDerivedAddress,
  type Base64EncodedBytes,
} from "@solana/kit";
import type { Command } from "commander";
import type { JupiterApi } from "jupiter-api-ts";
import { createHash, randomBytes } from "node:crypto";

import { Asset, resolveToken } from "../lib/Asset.ts";
import { Config } from "../lib/Config.ts";
import { requireJupiterApiKey } from "../lib/JupiterApi.ts";
import { NumberConverter } from "../lib/NumberConverter.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";
import type { SolanaRpc } from "../lib/SolanaRpc.ts";
import { Swap } from "../lib/Swap.ts";

const INVITE_PROGRAM_ADDRESS = address(
  "inv1tEtSwRMtM44tbvJGNiTxMvDfPVnX9StyqXfDfks"
);
const INVITE_CODE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{12}$/;

type Submission = {
  signature: string | null;
  serializedTransaction?: string;
  simulation?: Awaited<ReturnType<SolanaRpc["simulate"]>>;
};

export class InviteCommand {
  static #api: JupiterApi;
  static #rpc: SolanaRpc;

  public static register(
    program: Command,
    rpc: SolanaRpc,
    api: JupiterApi
  ): void {
    this.#rpc = rpc;
    this.#api = api;
    const invite = program
      .command("invite")
      .description("Jupiter Send invites");
    invite
      .command("send")
      .description("Create and send a token invite")
      .option(
        "--token <token>",
        "Token to send (symbol or mint address)",
        "SOL"
      )
      .option("--amount <n>", "Amount in human-readable units")
      .option("--raw-amount <n>", "Amount in on-chain units")
      .option("--key <name>", "Key to use for signing")
      .option("--dry-run", "Preview without submitting the transaction")
      .action((opts) => {
        Config.dryRun = Config.resolveDryRun(opts.dryRun);
        return this.send(opts);
      });
    invite
      .command("clawback")
      .description("Claw back an unclaimed invite")
      .requiredOption("--invite <invitePda>", "Invite PDA from invite list")
      .option("--key <name>", "Key to use for signing")
      .option("--dry-run", "Preview without submitting the transaction")
      .action((opts) => {
        Config.dryRun = Config.resolveDryRun(opts.dryRun);
        return this.clawback(opts);
      });
    this.registerListCommand(invite, "list", "List pending invites", (opts) =>
      this.list(opts, false)
    );
    this.registerListCommand(invite, "history", "List invite history", (opts) =>
      this.list(opts, true)
    );
  }

  private static registerListCommand(
    invite: Command,
    name: string,
    description: string,
    action: (opts: {
      key?: string;
      address?: string;
      page?: string;
    }) => Promise<void>
  ): void {
    invite
      .command(name)
      .description(description)
      .option("--key <name>", "Key to use (overrides active key)")
      .option("--address <address>", "Wallet address to look up")
      .option("--page <n>", "Pagination page number")
      .action(action);
  }

  private static async send(opts: {
    token: string;
    amount?: string;
    rawAmount?: string;
    key?: string;
  }): Promise<void> {
    requireJupiterApiKey();
    Swap.validateAmountOpts(opts);
    const sender = await Signer.load(opts.key ?? Config.load().activeKey);
    const token = (await resolveToken(this.#api, [opts.token]))[0]!;
    const amount =
      opts.rawAmount ??
      NumberConverter.toChainAmount(opts.amount!, token.decimals);
    if (!/^[1-9]\d*$/.test(amount)) {
      throw new Error("--amount must resolve to a positive integer amount.");
    }
    const inviteCode = this.createInviteCode();
    const inviteSigner = await this.deriveInviteSigner(inviteCode);
    const response = await this.#api.send.postSendV1CraftSend({
      body: {
        inviteSigner: inviteSigner.address,
        sender: sender.address,
        amount,
        ...(token.id === Asset.SOL.id ? {} : { mint: token.id }),
      },
    });
    if (response.error || !response.data?.tx) {
      throw new Error("Unable to craft the invite transaction.");
    }
    const submission = await this.submit(
      [sender, inviteSigner],
      response.data.tx
    );
    const invitePda = await this.invitePda(inviteSigner.address);
    this.outputSubmission({
      action: "send",
      inviteCode,
      invitePda,
      expiry: response.data.expiry,
      signature: submission.signature,
      serializedTransaction: submission.serializedTransaction,
      simulation: submission.simulation,
    });
  }

  private static async clawback(opts: {
    invite: string;
    key?: string;
  }): Promise<void> {
    requireJupiterApiKey();
    const sender = await Signer.load(opts.key ?? Config.load().activeKey);
    const response = await this.#api.send.postSendV1CraftClawback({
      body: { invitePDA: opts.invite, sender: sender.address },
    });
    if (response.error || !response.data?.tx) {
      throw new Error("Unable to craft the invite clawback transaction.");
    }
    const submission = await this.submit([sender], response.data.tx);
    this.outputSubmission({
      action: "clawback",
      invitePda: opts.invite,
      signature: submission.signature,
      serializedTransaction: submission.serializedTransaction,
      simulation: submission.simulation,
    });
  }

  private static async list(
    opts: { key?: string; address?: string; page?: string },
    history: boolean
  ): Promise<void> {
    requireJupiterApiKey();
    if (opts.key && opts.address) {
      throw new Error("Only one of --address or --key can be provided.");
    }
    const page = opts.page === undefined ? undefined : this.page(opts.page);
    const wallet =
      opts.address ??
      (await Signer.loadAddress(opts.key ?? Config.load().activeKey));
    const response = history
      ? await this.#api.send.getSendV1InviteHistory({
          query: { address: wallet, ...(page === undefined ? {} : { page }) },
        })
      : await this.#api.send.getSendV1PendingInvites({
          query: { address: wallet, ...(page === undefined ? {} : { page }) },
        });
    if (response.error || !response.data) {
      throw new Error(`Unable to get invite ${history ? "history" : "list"}.`);
    }
    const invites = response.data.invites.map((invite) => ({
      invitePda: invite.invite_pda,
      sender: invite.sender,
      receiver: invite.receiver,
      mint: invite.mint,
      amount: invite.amount,
      expiry: invite.expiry,
      createdAt: invite.creation_time,
      confirmed: invite.confirmed === 1,
      action: invite.action,
    }));
    if (Output.isJson()) {
      Output.json({ invites, hasMoreData: response.data.hasMoreData });
      return;
    }
    Output.table({
      type: "horizontal",
      headers: {
        invitePda: "Invite PDA",
        mint: "Mint",
        amount: "Amount",
        expiry: "Expiry",
        receiver: "Receiver",
        confirmed: "Confirmed",
      },
      rows: invites,
    });
    if (response.data.hasMoreData && page !== undefined) {
      console.log(`\nNext page: ${page + 1}`);
    }
  }

  private static async submit(
    signers: Signer[],
    tx: string
  ): Promise<Submission> {
    const signedTransaction = await Signer.signTransactionWith(
      signers,
      tx as Base64EncodedBytes
    );
    if (Config.dryRun) {
      return {
        signature: null,
        serializedTransaction: signedTransaction,
        simulation: await this.#rpc.simulate(signedTransaction),
      };
    }
    return { signature: await this.#rpc.send(signedTransaction) };
  }

  private static async invitePda(inviteSigner: string): Promise<string> {
    const [invitePda] = await getProgramDerivedAddress({
      programAddress: INVITE_PROGRAM_ADDRESS,
      seeds: [
        new TextEncoder().encode("invite"),
        getBase58Encoder().encode(inviteSigner),
      ],
    });
    return invitePda;
  }

  private static createInviteCode(): string {
    return getBase58Decoder().decode(randomBytes(13)).slice(0, 12);
  }

  private static async deriveInviteSigner(inviteCode: string): Promise<Signer> {
    if (!INVITE_CODE_PATTERN.test(inviteCode)) {
      throw new Error("Invite code must be a 12-character base58 string.");
    }
    const seed = createHash("sha256")
      .update(`invite:${inviteCode}`)
      .digest("hex");
    return Signer.fromPrivateKey(seed);
  }

  private static outputSubmission(data: {
    action: string;
    signature: string | null;
    inviteCode?: string;
    invitePda: string;
    expiry?: string;
    serializedTransaction?: string;
    simulation?: Awaited<ReturnType<SolanaRpc["simulate"]>>;
  }): void {
    if (Output.isJson()) {
      Output.json({ ...(Config.dryRun ? { dryRun: true } : {}), ...data });
      return;
    }
    if (Config.dryRun) {
      console.log(Output.DRY_RUN_LABEL);
    }
    Output.table({
      type: "vertical",
      rows: [
        { label: "Action", value: data.action },
        ...(data.inviteCode
          ? [{ label: "Invite Code", value: data.inviteCode }]
          : []),
        { label: "Invite PDA", value: data.invitePda },
        ...(data.expiry ? [{ label: "Expiry", value: data.expiry }] : []),
        ...(!Config.dryRun
          ? [{ label: "Tx Signature", value: data.signature ?? "" }]
          : [
              {
                label: "Serialized Transaction",
                value: data.serializedTransaction!,
              },
              {
                label: "Simulation",
                value: data.simulation!.success ? "Success" : "Failed",
              },
              ...(data.simulation!.error
                ? [{ label: "Simulation Error", value: data.simulation!.error }]
                : []),
            ]),
      ],
    });
  }

  private static page(value: string): number {
    const page = Number(value);
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new Error("--page must be a positive integer.");
    }
    return page;
  }
}
