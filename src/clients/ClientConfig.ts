import { Config } from "../lib/Config.ts";

export class ClientConfig {
  static readonly #API_KEY = Config.load().apiKey;

  public static readonly host = this.#API_KEY
    ? "https://api.jup.ag"
    : "https://lite-api.jup.ag";

  public static readonly headers: Record<string, string> = {
    "x-client-platform": "jupiter.cli",
    ...(this.#API_KEY && {
      "x-api-key": this.#API_KEY,
    }),
  };
}
