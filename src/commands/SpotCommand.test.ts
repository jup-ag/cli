import { describe, expect, test } from "bun:test";

import { SpotCommand } from "./SpotCommand.ts";

// Access the private static history() handler through the class without
// invoking commander. Only the limit validation path is exercised, so no
// network or keypair is needed.
function historyWithLimit(limit: string): Promise<unknown> {
  // @ts-expect-error test access to private static method
  return SpotCommand.history({ limit });
}

describe("SpotCommand.history --limit validation", () => {
  test("rejects limit above the documented maximum of 15", async () => {
    expect(historyWithLimit("16")).rejects.toThrow(
      "--limit must be between 1 and 15."
    );
    expect(historyWithLimit("1000")).rejects.toThrow(
      "--limit must be between 1 and 15."
    );
  });

  test("rejects non-positive and non-numeric limits", async () => {
    expect(historyWithLimit("0")).rejects.toThrow(
      "--limit must be a positive number."
    );
    expect(historyWithLimit("-3")).rejects.toThrow(
      "--limit must be a positive number."
    );
    expect(historyWithLimit("abc")).rejects.toThrow(
      "--limit must be a positive number."
    );
  });
});
