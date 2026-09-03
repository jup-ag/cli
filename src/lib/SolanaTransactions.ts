import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Base64EncodedWireTransaction,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  findAssociatedTokenPda,
  getBatchInstruction,
  getCloseAccountInstruction,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction,
} from "@solana-program/token";

import type { SolanaRpc } from "./SolanaRpc.ts";

async function compileInstructions(
  rpc: SolanaRpc,
  feePayer: Address,
  instructions: Instruction[]
): Promise<Base64EncodedWireTransaction> {
  const latestBlockhash = await rpc.getLatestBlockhash();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(feePayer, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx)
  );
  return getBase64EncodedWireTransaction(compileTransaction(message));
}

export async function buildSolTransferTransaction(
  rpc: SolanaRpc,
  sender: TransactionSigner,
  recipient: Address,
  amount: bigint
): Promise<Base64EncodedWireTransaction> {
  return compileInstructions(rpc, sender.address, [
    getTransferSolInstruction({
      source: sender,
      destination: recipient,
      amount,
    }),
  ]);
}

export async function buildTokenTransferTransaction(params: {
  amount: bigint;
  decimals: number;
  mint: Address;
  recipient: Address;
  rpc: SolanaRpc;
  sender: TransactionSigner;
  tokenProgram: Address;
}): Promise<Base64EncodedWireTransaction> {
  const { mint, recipient, rpc, sender, tokenProgram } = params;
  const [senderAta] = await findAssociatedTokenPda({
    mint,
    owner: sender.address,
    tokenProgram,
  });
  const [recipientAta] = await findAssociatedTokenPda({
    mint,
    owner: recipient,
    tokenProgram,
  });

  return compileInstructions(rpc, sender.address, [
    getCreateAssociatedTokenIdempotentInstruction({
      payer: sender,
      ata: recipientAta,
      owner: recipient,
      mint,
      tokenProgram,
    }),
    getTransferCheckedInstruction(
      {
        source: senderAta,
        mint,
        destination: recipientAta,
        authority: sender,
        amount: params.amount,
        decimals: params.decimals,
      },
      { programAddress: tokenProgram }
    ),
  ]);
}

export async function buildCloseTokenAccountsTransaction(params: {
  accounts: Address[];
  owner: TransactionSigner;
  rpc: SolanaRpc;
  tokenProgram: Address;
}): Promise<Base64EncodedWireTransaction> {
  const closeInstructions = params.accounts.map((account) =>
    getCloseAccountInstruction(
      {
        account,
        destination: params.owner.address,
        owner: params.owner,
      },
      { programAddress: params.tokenProgram }
    )
  );
  return compileInstructions(params.rpc, params.owner.address, [
    getBatchInstruction(closeInstructions, {
      programAddress: params.tokenProgram,
    }),
  ]);
}
