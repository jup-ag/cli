export class DateConverter {
  /**
   * Parse a timestamp string (ISO date or UNIX timestamp) and return Unix seconds.
   * Accepts both ISO 8601 date strings and numeric UNIX timestamps.
   */
  public static parseTimestamp(value: string): string {
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
