import { expect, test } from "bun:test";
import { Command } from "commander";
import type { JupiterApi } from "jupiter-api-ts";

import { Signer } from "../lib/Signer.ts";
import type { SolanaRpc } from "../lib/SolanaRpc.ts";
import { InviteCommand } from "./InviteCommand.ts";

type InviteCodeMethods = {
  createInviteCode(): string;
  deriveInviteSigner(inviteCode: string): ReturnType<typeof Signer.generate>;
};

const inviteCode = InviteCommand as unknown as InviteCodeMethods;

test("invite registers send, clawback, list, and history", () => {
  const program = new Command();

  InviteCommand.register(
    program,
    undefined as unknown as SolanaRpc,
    undefined as unknown as JupiterApi
  );

  const invite = program.commands.find(
    (command) => command.name() === "invite"
  )!;
  expect(invite.commands.map((command) => command.name())).toEqual([
    "send",
    "clawback",
    "list",
    "history",
  ]);
});

test("creates 12-character base58 invite codes", () => {
  expect(inviteCode.createInviteCode()).toMatch(/^[1-9A-HJ-NP-Za-km-z]{12}$/);
});

test("derives the same signer from the same invite code", async () => {
  const code = "123456789ABC";
  const first = await inviteCode.deriveInviteSigner(code);
  const second = await inviteCode.deriveInviteSigner(code);

  expect(first.address).toBe(second.address);
});

test("rejects invalid invite codes", async () => {
  await expect(inviteCode.deriveInviteSigner("invalid-code")).rejects.toThrow(
    "Invite code must be a 12-character base58 string."
  );
});
