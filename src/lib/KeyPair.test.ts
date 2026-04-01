import { getBase58Decoder } from "@solana/kit";
import { describe, expect, test } from "bun:test";

import { KeyPair } from "./KeyPair.ts";

// Test mnemonic from Solana cookbook:
// https://solana.com/developers/cookbook/wallets/restore-from-mnemonic
const TEST_MNEMONIC =
  "neither lonely flavor argue grass remind eye tag avocado spot unusual intact";

describe("generate", () => {
  test("generates a valid keypair with 24-word mnemonic", async () => {
    const { keyPair, mnemonic } = await KeyPair.generate(24);
    expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keyPair.privateKey.length).toBe(32);
    expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keyPair.publicKey.length).toBe(32);
    expect(mnemonic.split(" ").length).toBe(24);
  });

  test("generates a valid keypair with 12-word mnemonic", async () => {
    const { keyPair, mnemonic } = await KeyPair.generate(12);
    expect(keyPair.privateKey.length).toBe(32);
    expect(keyPair.publicKey.length).toBe(32);
    expect(mnemonic.split(" ").length).toBe(12);
  });

  test("generates unique keypairs", async () => {
    const a = await KeyPair.generate();
    const b = await KeyPair.generate();
    expect(a.keyPair.publicKey).not.toEqual(b.keyPair.publicKey);
  });
});

describe("fromSeedPhrase", () => {
  test("deterministic: same phrase produces same keypair", async () => {
    const { mnemonic } = await KeyPair.generate();
    const a = await KeyPair.fromSeedPhrase(mnemonic);
    const b = await KeyPair.fromSeedPhrase(mnemonic);
    expect(a.privateKey).toEqual(b.privateKey);
    expect(a.publicKey).toEqual(b.publicKey);
  });

  test("different phrases produce different keypairs", async () => {
    const a = await KeyPair.generate();
    const b = await KeyPair.generate();
    const kpA = await KeyPair.fromSeedPhrase(a.mnemonic);
    const kpB = await KeyPair.fromSeedPhrase(b.mnemonic);
    expect(kpA.publicKey).not.toEqual(kpB.publicKey);
  });

  test("default derivation path matches explicit m/44'/501'/0'/0'", async () => {
    const { mnemonic } = await KeyPair.generate();
    const defaultPath = await KeyPair.fromSeedPhrase(mnemonic);
    const explicitPath = await KeyPair.fromSeedPhrase(
      mnemonic,
      "m/44'/501'/0'/0'"
    );
    expect(defaultPath.privateKey).toEqual(explicitPath.privateKey);
    expect(defaultPath.publicKey).toEqual(explicitPath.publicKey);
  });

  test("custom derivation path is deterministic", async () => {
    const { mnemonic } = await KeyPair.generate();
    const path = "m/44'/501'/2'/0'";
    const a = await KeyPair.fromSeedPhrase(mnemonic, path);
    const b = await KeyPair.fromSeedPhrase(mnemonic, path);
    expect(a.privateKey).toEqual(b.privateKey);
    expect(a.publicKey).toEqual(b.publicKey);
  });
});

describe("fromSeedPhrase — uses SLIP10 for all-hardened paths", () => {
  const toAddress = (kp: KeyPair) => getBase58Decoder().decode(kp.publicKey);

  test("derives correct addresses for m/44'/501'/x'/0'", async () => {
    for (const { index, address } of [
      { index: 0, address: "5vftMkHL72JaJG6ExQfGAsT2uGVHpRR7oTNUPMs68Y2N" },
      { index: 6, address: "BNMDY3tCyYbayMzBjZm8RW59unpDWcQRfVmWXCJhLb7D" },
      { index: 9, address: "6frdqXQAgJMyKwmZxkLYbdGjnYTvUceh6LNhkQt2siQp" },
    ]) {
      const kp = await KeyPair.fromSeedPhrase(
        TEST_MNEMONIC,
        `m/44'/501'/${index}'/0'`
      );
      expect(toAddress(kp)).toBe(address);
    }
  });

  test("derives correct addresses for m/44'/501'/x'", async () => {
    for (const { index, address } of [
      { index: 0, address: "ZtSqp8BQkKFvahawCS9Mf15gzFuedeWWDkYap3qQEe4" },
      { index: 2, address: "7Y9pZgwuas2FbVqGKi5yPBKnxeCNxQK8EHCaS3EbXbg8" },
      { index: 3, address: "7HWpiMRzpi2BQVVBWQLtSi6yYrSAEJxwAYE1jfYmytan" },
    ]) {
      const kp = await KeyPair.fromSeedPhrase(
        TEST_MNEMONIC,
        `m/44'/501'/${index}'`
      );
      expect(toAddress(kp)).toBe(address);
    }
  });

  test("different account indices derive different keypairs", async () => {
    const a = await KeyPair.fromSeedPhrase(TEST_MNEMONIC, "m/44'/501'/0'/0'");
    const b = await KeyPair.fromSeedPhrase(TEST_MNEMONIC, "m/44'/501'/1'/0'");
    expect(a.publicKey).not.toEqual(b.publicKey);
    expect(a.privateKey).not.toEqual(b.privateKey);
  });
});

describe("fromSeedPhrase — uses BIP32 for non-hardened paths", () => {
  const toAddress = (kp: KeyPair) => getBase58Decoder().decode(kp.publicKey);

  test("derives correct address for m/44'/501'/0'/0/0", async () => {
    const kp = await KeyPair.fromSeedPhrase(
      "flee artwork post brown april bulk wash limb melody zoo rib law",
      "m/44'/501'/0'/0/0"
    );
    expect(toAddress(kp)).toBe("F8oiKU5wmZs8jZQng1zyzbcHPkvECSwHitFJvuc5rQGP");
  });

  test("same non-hardened path is deterministic", async () => {
    const a = await KeyPair.fromSeedPhrase(TEST_MNEMONIC, "m/44'/501'/0'/0");
    const b = await KeyPair.fromSeedPhrase(TEST_MNEMONIC, "m/44'/501'/0'/0");
    expect(a.privateKey).toEqual(b.privateKey);
    expect(a.publicKey).toEqual(b.publicKey);
  });

  test("trailing hardened vs non-hardened segment derive different keypairs", async () => {
    const hardened = await KeyPair.fromSeedPhrase(
      TEST_MNEMONIC,
      "m/44'/501'/0'/0'"
    );
    const nonHardened = await KeyPair.fromSeedPhrase(
      TEST_MNEMONIC,
      "m/44'/501'/0'/0"
    );
    expect(hardened.publicKey).not.toEqual(nonHardened.publicKey);
  });
});

describe("fromPrivateKey", () => {
  test("decodes JSON array format (64-byte, Solana CLI style)", async () => {
    const { keyPair } = await KeyPair.generate();
    const json = keyPair.toJson();
    const restored = await KeyPair.fromPrivateKey(json);
    expect(restored.privateKey).toEqual(keyPair.privateKey);
    expect(restored.publicKey).toEqual(keyPair.publicKey);
  });

  test("decodes base58 private key", async () => {
    const { keyPair } = await KeyPair.generate();
    const base58 = getBase58Decoder().decode(keyPair.privateKey);
    const restored = await KeyPair.fromPrivateKey(base58);
    expect(restored.privateKey).toEqual(keyPair.privateKey);
    expect(restored.publicKey).toEqual(keyPair.publicKey);
  });

  test("rejects invalid input", async () => {
    await expect(KeyPair.fromPrivateKey("not-a-key")).rejects.toThrow(
      "Invalid private key format"
    );
  });

  test("rejects empty string", async () => {
    await expect(KeyPair.fromPrivateKey("")).rejects.toThrow(
      "Invalid private key format"
    );
  });
});

describe("toJson", () => {
  test("produces 64-byte JSON array", async () => {
    const { keyPair } = await KeyPair.generate();
    const json = keyPair.toJson();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(64);
    expect(parsed.every((v: number) => v >= 0 && v <= 255)).toBe(true);
  });

  test("round-trips through fromPrivateKey", async () => {
    const { keyPair } = await KeyPair.generate();
    const json = keyPair.toJson();
    const restored = await KeyPair.fromPrivateKey(json);
    expect(restored.toJson()).toBe(json);
  });
});
