import { describe, expect, test } from "bun:test";
import { NumberConverter } from "./NumberConverter.ts";

describe("removeInsignificantZeros", () => {
  test("empty string", () => {
    expect(NumberConverter.removeInsignificantZeros("")).toBe("");
  });

  test("zero values", () => {
    expect(NumberConverter.removeInsignificantZeros("0")).toBe("0");
    expect(NumberConverter.removeInsignificantZeros("000")).toBe("0");
    expect(NumberConverter.removeInsignificantZeros("0.00")).toBe("0");
    expect(NumberConverter.removeInsignificantZeros("0.000")).toBe("0");
  });

  test("strips leading zeros", () => {
    expect(NumberConverter.removeInsignificantZeros("007")).toBe("7");
    expect(NumberConverter.removeInsignificantZeros("00123")).toBe("123");
  });

  test("strips trailing zeros after decimal", () => {
    expect(NumberConverter.removeInsignificantZeros("1.50")).toBe("1.5");
    expect(NumberConverter.removeInsignificantZeros("1.500")).toBe("1.5");
    expect(NumberConverter.removeInsignificantZeros("10.10")).toBe("10.1");
  });

  test("strips entire decimal part if all zeros", () => {
    expect(NumberConverter.removeInsignificantZeros("5.00")).toBe("5");
    expect(NumberConverter.removeInsignificantZeros("100.000")).toBe("100");
  });

  test("preserves significant digits", () => {
    expect(NumberConverter.removeInsignificantZeros("0.001")).toBe("0.001");
    expect(NumberConverter.removeInsignificantZeros("123.456")).toBe("123.456");
  });

  test("preserves leading zero before decimal", () => {
    expect(NumberConverter.removeInsignificantZeros("0.5")).toBe("0.5");
    expect(NumberConverter.removeInsignificantZeros("0.123")).toBe("0.123");
  });
});

describe("fromChainAmount", () => {
  test("amount longer than decimals", () => {
    // 1000000 with 6 decimals = 1
    expect(NumberConverter.fromChainAmount("1000000", 6)).toBe("1");
    // 1500000 with 6 decimals = 1.5
    expect(NumberConverter.fromChainAmount("1500000", 6)).toBe("1.5");
    // 100000000 with 6 decimals = 100
    expect(NumberConverter.fromChainAmount("100000000", 6)).toBe("100");
  });

  test("amount shorter than decimals", () => {
    // 1 with 6 decimals = 0.000001
    expect(NumberConverter.fromChainAmount("1", 6)).toBe("0.000001");
    // 500 with 9 decimals = 0.0000005
    expect(NumberConverter.fromChainAmount("500", 9)).toBe("0.0000005");
  });

  test("amount equal to decimals length", () => {
    // 123456 with 6 decimals = 0.123456
    expect(NumberConverter.fromChainAmount("123456", 6)).toBe("0.123456");
  });

  test("zero amount", () => {
    expect(NumberConverter.fromChainAmount("0", 6)).toBe("0");
  });

  test("accepts bigint", () => {
    expect(NumberConverter.fromChainAmount(1000000n, 6)).toBe("1");
    expect(NumberConverter.fromChainAmount(1500000000n, 9)).toBe("1.5");
  });

  test("with multiplier", () => {
    // 1000000 with 6 decimals = 1, * 2 = 2
    expect(NumberConverter.fromChainAmount("1000000", 6, 2)).toBe("2");
    // 1000000 with 6 decimals = 1, * 0.5 = 0.5
    expect(NumberConverter.fromChainAmount("1000000", 6, 0.5)).toBe("0.5");
  });

  test("multiplier of 1 is no-op", () => {
    expect(NumberConverter.fromChainAmount("1500000", 6, 1)).toBe("1.5");
  });

  test("large amounts (SOL-scale)", () => {
    // 1 SOL = 1000000000 lamports, 9 decimals
    expect(NumberConverter.fromChainAmount("1000000000", 9)).toBe("1");
    expect(NumberConverter.fromChainAmount("1500000000", 9)).toBe("1.5");
    expect(NumberConverter.fromChainAmount("412300000", 9)).toBe("0.4123");
  });
});

describe("toChainAmount", () => {
  test("integer amounts", () => {
    expect(NumberConverter.toChainAmount("1", 6)).toBe("1000000");
    expect(NumberConverter.toChainAmount("100", 6)).toBe("100000000");
  });

  test("decimal amounts", () => {
    expect(NumberConverter.toChainAmount("1.5", 6)).toBe("1500000");
    expect(NumberConverter.toChainAmount("0.5", 6)).toBe("500000");
    expect(NumberConverter.toChainAmount("0.000001", 6)).toBe("1");
  });

  test("truncates excess decimals", () => {
    // 0.0000001 with 6 decimals should truncate to 0
    expect(NumberConverter.toChainAmount("0.0000001", 6)).toBe("0");
    // 1.1234567 with 6 decimals should truncate to 1123456
    expect(NumberConverter.toChainAmount("1.1234567", 6)).toBe("1123456");
  });

  test("zero amount", () => {
    expect(NumberConverter.toChainAmount("0", 6)).toBe("0");
    expect(NumberConverter.toChainAmount("0.0", 6)).toBe("0");
  });

  test("with multiplier", () => {
    // "2" with 6 decimals = 2000000, / 2 = 1000000
    expect(NumberConverter.toChainAmount("2", 6, 2)).toBe("1000000");
  });

  test("multiplier of 1 is no-op", () => {
    expect(NumberConverter.toChainAmount("1.5", 6, 1)).toBe("1500000");
  });

  test("round-trip with fromChainAmount", () => {
    const decimals = 6;
    const cases = ["1000000", "1500000", "500000", "100000000", "1"];
    for (const chainAmount of cases) {
      const human = NumberConverter.fromChainAmount(chainAmount, decimals);
      const backToChain = NumberConverter.toChainAmount(human, decimals);
      expect(backToChain).toBe(chainAmount);
    }
  });

  test("SOL-scale round-trip", () => {
    const decimals = 9;
    const cases = ["1000000000", "1500000000", "412300000"];
    for (const chainAmount of cases) {
      const human = NumberConverter.fromChainAmount(chainAmount, decimals);
      const backToChain = NumberConverter.toChainAmount(human, decimals);
      expect(backToChain).toBe(chainAmount);
    }
  });
});
