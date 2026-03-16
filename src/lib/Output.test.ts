import { describe, expect, test } from "bun:test";
import chalk from "chalk";

import { Output } from "./Output.ts";

describe("formatBoolean", () => {
  test("true returns check mark", () => {
    expect(Output.formatBoolean(true)).toBe("✅");
  });

  test("false returns cross mark", () => {
    expect(Output.formatBoolean(false)).toBe("❌");
  });

  test("undefined returns cross mark", () => {
    expect(Output.formatBoolean(undefined)).toBe("❌");
  });
});

describe("formatPercentageChange", () => {
  test("undefined returns em-dash", () => {
    expect(Output.formatPercentageChange(undefined)).toBe(chalk.gray("\u2014"));
  });

  test("zero shows gray with plus prefix", () => {
    const result = Output.formatPercentageChange(0);
    expect(result).toBe(chalk.gray("+0.00%"));
  });

  test("small positive (<=0.5) shows gray", () => {
    const result = Output.formatPercentageChange(0.3);
    expect(result).toBe(chalk.gray("+0.30%"));
  });

  test("large positive (>0.5) shows green", () => {
    const result = Output.formatPercentageChange(1.5);
    expect(result).toBe(chalk.green("+1.50%"));
  });

  test("small negative (>=-0.5) shows gray", () => {
    const result = Output.formatPercentageChange(-0.3);
    expect(result).toBe(chalk.gray("-0.30%"));
  });

  test("large negative (<-0.5) shows red", () => {
    const result = Output.formatPercentageChange(-1.5);
    expect(result).toBe(chalk.red("-1.50%"));
  });

  test("boundary: exactly 0.5 shows gray", () => {
    const result = Output.formatPercentageChange(0.5);
    expect(result).toBe(chalk.gray("+0.50%"));
  });

  test("boundary: exactly -0.5 shows gray", () => {
    const result = Output.formatPercentageChange(-0.5);
    expect(result).toBe(chalk.gray("-0.50%"));
  });
});

describe("formatDollar", () => {
  test("undefined returns gray em-dash", () => {
    expect(Output.formatDollar(undefined)).toBe(chalk.gray("\u2014"));
  });

  test("zero returns gray em-dash", () => {
    expect(Output.formatDollar(0)).toBe(chalk.gray("\u2014"));
  });

  test("small amount uses 5 significant digits", () => {
    const result = Output.formatDollar(1.5);
    expect(result).toContain("1.5");
    expect(result).toContain("$");
  });

  test("large amount (>=1000) uses default formatting", () => {
    const result = Output.formatDollar(1234.56);
    expect(result).toContain("$");
    expect(result).toContain("1");
    expect(result).toContain("234");
  });

  test("negative amount", () => {
    const result = Output.formatDollar(-50);
    expect(result).toContain("$");
    expect(result).toContain("50");
  });
});
