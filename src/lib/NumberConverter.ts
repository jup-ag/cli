export class NumberConverter {
  /**
   * Removes leading or trailing insignificant zeros from a string that represents
   * a floating point number.
   */
  public static removeInsignificantZeros(str: string): string {
    if (str.length === 0) {
      // Edge case: empty string
      return "";
    }
    if (Number(str) === 0) {
      // Edge case: number is zero
      return "0";
    }

    let start = 0;
    while (start < str.length && str[start] === "0" && str[start + 1] !== ".") {
      start++;
    }

    let end = str.length - 1;
    if (str.includes(".")) {
      while (end >= 0 && (str[end] === "0" || str[end] === ".")) {
        end--;
        if (str[end] === ".") {
          end--;
          break;
        }
      }
    }

    return str.substring(start, end + 1);
  }

  public static fromChainAmount(
    amount: string | bigint,
    decimals: number,
    multiplier?: number | undefined
  ): string {
    const amountString = amount.toString();

    let postDecimals: string;
    if (amountString.length <= decimals) {
      const zerosToPad = "0".repeat(decimals - amountString.length);
      postDecimals = this.removeInsignificantZeros(
        `0${"."}${zerosToPad}${amountString}`
      );
    } else {
      const position = amountString.length - decimals;
      const integerPart = amountString.substring(0, position);
      const fractionalPart = amountString.substring(position);
      postDecimals = this.removeInsignificantZeros(
        `${integerPart}${"."}${fractionalPart}`
      );
    }
    if (!multiplier || multiplier === 1) {
      return postDecimals;
    }

    return this.removeInsignificantZeros(
      (Number(postDecimals) * multiplier).toFixed(decimals)
    );
  }

  public static toChainAmount(
    amount: string,
    decimals: number,
    multiplier?: number | undefined
  ): string {
    const [integerPart, fractionalPart] = amount.split(".");
    const postDecimals = this.removeInsignificantZeros(
      (integerPart ?? "") +
        (fractionalPart ?? "").padEnd(decimals, "0").slice(0, decimals)
    );
    if (!multiplier || multiplier === 1) {
      return postDecimals;
    }

    return this.removeInsignificantZeros(
      Math.round(Number(postDecimals) / multiplier).toFixed(0)
    );
  }

  public static fromMicroUsd(amount: string | number): number {
    return Number(this.fromChainAmount(amount.toString(), 6));
  }

  public static toMicroUsd(amount: string): string {
    return this.toChainAmount(amount, 6);
  }
}
