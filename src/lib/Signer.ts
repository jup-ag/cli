import {
  createKeyPairSignerFromPrivateKeyBytes,
  getBase64Codec,
  getBase64EncodedWireTransaction,
  getTransactionCodec,
  partiallySignTransaction,
  type Base64EncodedBytes,
  type Base64EncodedWireTransaction,
  type KeyPairSigner,
} from "@solana/kit";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Config } from "./Config.ts";
import { KeyPair } from "./KeyPair.ts";

export class Signer {
  #signer: KeyPairSigner;
  #keyPair: KeyPair;

  private constructor(signer: KeyPairSigner, keyPair: KeyPair) {
    this.#signer = signer;
    this.#keyPair = keyPair;
  }

  private static async fromKeyPair(keyPair: KeyPair): Promise<Signer> {
    const signer = await createKeyPairSignerFromPrivateKeyBytes(
      keyPair.privateKey
    );
    return new Signer(signer, keyPair);
  }

  public static async fromSeedPhrase(phrase: string): Promise<Signer> {
    return this.fromKeyPair(await KeyPair.fromSeedPhrase(phrase));
  }

  public static async fromPrivateKey(key: string): Promise<Signer> {
    return this.fromKeyPair(await KeyPair.fromPrivateKey(key));
  }

  public static async generate(): Promise<Signer> {
    const { keyPair } = await KeyPair.generate();
    return this.fromKeyPair(keyPair);
  }

  public static async load(name: string): Promise<Signer> {
    const path = join(Config.KEYS_DIR, `${name}.json`);
    if (!existsSync(path)) {
      throw new Error(`Key "${name}" does not exist.`);
    }
    const file = readFileSync(path, "utf-8");
    return this.fromKeyPair(await KeyPair.fromPrivateKey(file));
  }

  public save(name: string): void {
    const keyPath = join(Config.KEYS_DIR, `${name}.json`);
    writeFileSync(keyPath, this.#keyPair.toJson());
  }

  public get address(): string {
    return this.#signer.address;
  }

  public async signTransaction(
    transaction: Base64EncodedBytes
  ): Promise<Base64EncodedWireTransaction> {
    const txBytes = getBase64Codec().encode(transaction);
    const decodedTx = getTransactionCodec().decode(txBytes);
    // We use partiallySignTransaction instead of signTransaction since we do
    // not want to assert that the transaction is fully signed
    const signedTx = await partiallySignTransaction(
      [this.#signer.keyPair],
      decodedTx
    );
    return getBase64EncodedWireTransaction(signedTx);
  }
}
