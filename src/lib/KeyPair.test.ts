import { describe, expect, test } from "bun:test";
import { getBase58Decoder } from "@solana/kit";
import { KeyPair } from "./KeyPair.ts";

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
