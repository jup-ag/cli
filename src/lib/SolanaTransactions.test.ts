import {
  address,
  getBase64Codec,
  getTransactionCodec,
  type Blockhash,
} from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { TOKEN_2022_PROGRAM_ADDRESS } from "@solana-program/token-2022";
import { describe, expect, test } from "bun:test";

import type { SolanaRpc } from "./SolanaRpc.ts";
import { Signer } from "./Signer.ts";
import {
  buildCloseTokenAccountsTransaction,
  buildSolTransferTransaction,
  buildTokenTransferTransaction,
} from "./SolanaTransactions.ts";

const RECIPIENT = address("7YttLkHdoCtAnBPD22dAvHaLLtH9FJ4XhJvR8H4zhTnx");
const USDC = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const rpc = {
  getLatestBlockhash: async () => ({
    blockhash: "11111111111111111111111111111111" as Blockhash,
    lastValidBlockHeight: 1n,
  }),
} as SolanaRpc;

function expectSenderSignature(transaction: string, sender: string): void {
  const decoded = getTransactionCodec().decode(
    getBase64Codec().encode(transaction)
  );
  expect(decoded.signatures[address(sender)]).toBeNull();
}

describe("native spot transactions", () => {
  test("builds a SOL transfer requiring the sender signature", async () => {
    const signer = await Signer.generate();
    expectSenderSignature(
      await buildSolTransferTransaction(
        rpc,
        signer.transactionSigner,
        RECIPIENT,
        1_000n
      ),
      signer.address
    );
  });

  test("builds a checked token transfer with idempotent recipient ATA creation", async () => {
    const signer = await Signer.generate();
    expectSenderSignature(
      await buildTokenTransferTransaction({
        amount: 1_000_000n,
        decimals: 6,
        mint: USDC,
        recipient: RECIPIENT,
        rpc,
        sender: signer.transactionSigner,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      }),
      signer.address
    );
  });

  test("builds a batched token-account close instruction requiring the owner signature", async () => {
    const signer = await Signer.generate();
    expectSenderSignature(
      await buildCloseTokenAccountsTransaction({
        accounts: [
          address("9xQeWvG816bUx9EPfEZ3rJCeU5B7T6Zpw6wS2pFvZp7B"),
          address("Vote111111111111111111111111111111111111111"),
        ],
        owner: signer.transactionSigner,
        rpc,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      }),
      signer.address
    );
  });

  test("builds a separate Token-2022 batch close instruction", async () => {
    const signer = await Signer.generate();
    expectSenderSignature(
      await buildCloseTokenAccountsTransaction({
        accounts: [address("9xQeWvG816bUx9EPfEZ3rJCeU5B7T6Zpw6wS2pFvZp7B")],
        owner: signer.transactionSigner,
        rpc,
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
      }),
      signer.address
    );
  });
});
