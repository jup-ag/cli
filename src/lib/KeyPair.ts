import { ed25519 } from "@noble/curves/ed25519.js";
import { HDKey } from "@scure/bip32";
import { generateMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import {
  getBase16Encoder,
  getBase58Encoder,
  getBase64Encoder,
} from "@solana/kit";
import slip10 from "micro-key-producer/slip10.js";

export class KeyPair {
  public readonly privateKey: Uint8Array;
  public readonly publicKey: Uint8Array;

  constructor(privateKey: Uint8Array, publicKey: Uint8Array) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
  }

  public static async generate(mnemonicLength: 12 | 24 = 24) {
    const mnemonic = generateMnemonic(
      wordlist,
      mnemonicLength === 12 ? 128 : 256
    );
    const keyPair = await this.fromSeedPhrase(mnemonic);
    return {
      keyPair,
      mnemonic,
    };
  }

  public static async fromSeedPhrase(
    phrase: string,
    derivationPath: string = "m/44'/501'/0'/0'"
  ): Promise<KeyPair> {
    const seed = mnemonicToSeedSync(phrase);
    const useBip32 = derivationPath
      .split("/")
      .slice(1)
      .some((seg) => !seg.endsWith("'"));
    const hd = useBip32
      ? // Use BIP32 for paths with any non-hardened segments (e.g. m/44'/501'/0'/0/0)
        HDKey.fromMasterSeed(seed).derive(derivationPath)
      : // Use SLIP10 for all-hardened paths (e.g. m/44'/501'/0'/0')
        slip10.fromMasterSeed(seed).derive(derivationPath);
    if (!hd.privateKey) {
      throw new Error("Failed to derive private key");
    }
    return new KeyPair(hd.privateKey, ed25519.getPublicKey(hd.privateKey));
  }

  public static async fromPrivateKey(key: string): Promise<KeyPair> {
    let bytes: Uint8Array | undefined = undefined;

    // Try to decode as Uint8Array string
    try {
      const data = JSON.parse(
        key.startsWith("[") && key.endsWith("]") ? key : `[${key}]`
      );
      if (
        Array.isArray(data) &&
        data.every((v) => typeof v === "number" && v >= 0 && v <= 255)
      ) {
        const buffer = new Uint8Array(data);
        if (buffer.length === 32 || buffer.length === 64) {
          bytes = buffer;
        }
      }
    } catch (_) {}

    // Try to decode as hex
    try {
      bytes ??= getBase16Encoder().encode(key) as Uint8Array;
    } catch (_) {}

    // Try to decode as base58
    try {
      bytes ??= getBase58Encoder().encode(key) as Uint8Array;
    } catch (_) {}

    // Try to decode as base64
    try {
      bytes ??= getBase64Encoder().encode(key) as Uint8Array;
    } catch (_) {}

    // If all decoding fails, this is not a valid private key
    // Valid private keys must be either 32 or 64 bytes (for ed25519)
    if (bytes == null || (bytes.length !== 32 && bytes.length !== 64)) {
      throw new Error("Invalid private key format");
    }

    const privateKey = bytes.slice(0, 32);
    return new KeyPair(privateKey, ed25519.getPublicKey(privateKey));
  }

  public toJson(): string {
    return JSON.stringify([...this.privateKey, ...this.publicKey]);
  }
}
