import {
  createKeyPairSignerFromPrivateKeyBytes,
  getBase64Codec,
  getBase64EncodedWireTransaction,
  getTransactionCodec,
  partiallySignTransactionWithSigners,
  type Base64EncodedBytes,
  type Base64EncodedWireTransaction,
  type TransactionPartialSigner,
} from "@solana/kit";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createKeychainSigner } from "@solana/keychain";

import { Config } from "./Config.ts";
import { KeychainConfig } from "./KeychainConfig.ts";
import { KeyPair } from "./KeyPair.ts";

export class Signer {
  #signer: TransactionPartialSigner;
  #keyPair: KeyPair | null;

  private constructor(
    signer: TransactionPartialSigner,
    keyPair: KeyPair | null
  ) {
    this.#signer = signer;
    this.#keyPair = keyPair;
  }

  private static async fromKeyPair(keyPair: KeyPair): Promise<Signer> {
    const signer = await createKeyPairSignerFromPrivateKeyBytes(
      keyPair.privateKey
    );
    return new Signer(signer, keyPair);
  }

  public static async fromSeedPhrase(
    phrase: string,
    derivationPath?: string
  ): Promise<Signer> {
    return this.fromKeyPair(
      await KeyPair.fromSeedPhrase(phrase, derivationPath)
    );
  }

  public static async fromPrivateKey(key: string): Promise<Signer> {
    return this.fromKeyPair(await KeyPair.fromPrivateKey(key));
  }

  public static async generate(): Promise<Signer> {
    const { keyPair } = await KeyPair.generate();
    return this.fromKeyPair(keyPair);
  }

  public static async load(name: string): Promise<Signer> {
    if (KeychainConfig.isKeychainKey(name)) {
      const config = KeychainConfig.load(name);
      const signer = await createKeychainSigner(config.signerConfig);
      return new Signer(signer, null);
    }

    const path = join(Config.KEYS_DIR, `${name}.json`);
    if (!existsSync(path)) {
      throw new Error(`Key "${name}" does not exist.`);
    }
    const file = readFileSync(path, "utf-8");
    return this.fromKeyPair(await KeyPair.fromPrivateKey(file));
  }

  public static async loadAddress(name: string): Promise<string> {
    if (KeychainConfig.isKeychainKey(name)) {
      return KeychainConfig.load(name).resolvedAddress;
    }
    return (await this.load(name)).address;
  }

  public save(name: string): void {
    if (!this.#keyPair) {
      throw new Error("Cannot save a keychain-backed signer.");
    }
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
    const signedTx = await partiallySignTransactionWithSigners(
      [this.#signer],
      decodedTx
    );
    return getBase64EncodedWireTransaction(signedTx);
  }
}
