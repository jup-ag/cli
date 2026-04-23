import type { Base64EncodedBytes } from "@solana/kit";
import type { Command } from "commander";

import { Config } from "../lib/Config.ts";
import { Output } from "../lib/Output.ts";
import { Signer } from "../lib/Signer.ts";

export class SignCommand {
  public static register(program: Command): void {
    program
      .command("sign")
      .description("Sign a serialized base64 Solana transaction")
      .requiredOption("--tx <base64>", "Unsigned base64 transaction bytes")
      .option("--key <name>", "Key to use for signing")
      .action((opts: { tx: string; key?: string }) => this.sign(opts));
  }

  private static async sign(opts: { tx: string; key?: string }): Promise<void> {
    const signer = await Signer.load(opts.key ?? Config.load().activeKey);
    const signedTransaction = await signer.signTransaction(
      opts.tx as Base64EncodedBytes
    );

    if (Output.isJson()) {
      Output.json({
        signer: signer.address,
        signedTransaction,
      });
      return;
    }

    Output.table({
      type: "vertical",
      rows: [
        { label: "Signer", value: signer.address },
        { label: "Signed Tx", value: signedTransaction },
      ],
    });
  }
}
