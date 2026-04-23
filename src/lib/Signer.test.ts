import {
  address,
  compileTransaction,
  createTransactionMessage,
  getBase64Codec,
  getBase64EncodedWireTransaction,
  getTransactionCodec,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Base64EncodedBytes,
  type Blockhash,
} from "@solana/kit";
import { describe, expect, test } from "bun:test";

import { Signer } from "./Signer.ts";

const TEST_BLOCKHASH = "11111111111111111111111111111111" as Blockhash;

function createUnsignedTransaction(addressStr: string): Base64EncodedBytes {
  const transaction = compileTransaction(
    setTransactionMessageLifetimeUsingBlockhash(
      {
        blockhash: TEST_BLOCKHASH,
        lastValidBlockHeight: 1n,
      },
      setTransactionMessageFeePayer(
        address(addressStr),
        createTransactionMessage({ version: 0 })
      )
    )
  );
  return getBase64EncodedWireTransaction(
    transaction
  ) as unknown as Base64EncodedBytes;
}

describe("signTransaction", () => {
  test("signs a transaction that requires the signer", async () => {
    const signer = await Signer.generate();
    const unsignedTx = createUnsignedTransaction(signer.address);

    const signedTx = await signer.signTransaction(unsignedTx);
    const decodedTx = getTransactionCodec().decode(
      getBase64Codec().encode(signedTx)
    );
    const signerAddress = address(signer.address);

    expect(String(signedTx)).not.toBe(String(unsignedTx));
    expect(decodedTx.signatures[signerAddress]).not.toBeNull();
  });

  test("throws when the signer is not required by the transaction", async () => {
    const requiredSigner = await Signer.generate();
    const wrongSigner = await Signer.generate();
    const unsignedTx = createUnsignedTransaction(requiredSigner.address);

    expect(wrongSigner.signTransaction(unsignedTx)).rejects.toThrow(
      "Attempted to sign a transaction with an address that is not a signer for it"
    );
  });
});
