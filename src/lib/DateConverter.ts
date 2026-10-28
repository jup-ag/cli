export class DateConverter {
  /**
   * Parse a timestamp value and return an ISO string.
   * Accepts Unix seconds (numeric string) or an ISO date string.
   */
  static toISO(value: string): string {
    if (/^\d+$/.test(value)) {
      return new Date(Number(value) * 1000).toISOString();
    }
    const ms = new Date(value).getTime();
    if (isNaN(ms)) {
      throw new Error(`Invalid date: ${value}`);
    }
    return new Date(ms).toISOString();
  }

  /**
   * Parse a timestamp value and return Unix seconds as a string.
   * Accepts Unix seconds (numeric string) or an ISO date string.
   */
  static toUnixSeconds(value: string): string {
    if (/^\d+$/.test(value)) {
      return value;
    }
    const ms = new Date(value).getTime();
    if (isNaN(ms)) {
      throw new Error(`Invalid date: ${value}`);
    }
    return String(Math.floor(ms / 1000));
  }
}
