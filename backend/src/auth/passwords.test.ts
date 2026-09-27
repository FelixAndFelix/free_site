import { describe, expect, it } from "vitest";
import { runningHashCount, withHashSlot } from "./passwords";

describe("withHashSlot", () => {
  it("runs at most two operations at once and all of them eventually", async () => {
    let peak = 0;
    const operation = async (index: number) => {
      peak = Math.max(peak, runningHashCount());
      await new Promise((resolve) => setTimeout(resolve, 5));
      return index;
    };

    const results = await Promise.all(Array.from({ length: 10 }, (_, index) => withHashSlot(() => operation(index))));

    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(peak).toBe(2);
    expect(runningHashCount()).toBe(0);
  });

  it("frees the slot when an operation fails", async () => {
    await expect(withHashSlot(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(runningHashCount()).toBe(0);
  });
});
