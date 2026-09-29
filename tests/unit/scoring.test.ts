import { describe, expect, it } from "vitest";
import { percentileRank } from "@/lib/seven-metrics";

describe("scoring engine — percentileRank", () => {
  it("ranks the middle of a population at 50 (higher is better)", () => {
    expect(percentileRank(50, [0, 50, 100], true)).toBe(50);
  });

  it("saturates at the scale ends", () => {
    expect(percentileRank(100, [0, 50, 100], true)).toBe(100);
    expect(percentileRank(0, [0, 50, 100], true)).toBe(0);
  });

  it("rewards the best value when lower is better (e.g. bowling average)", () => {
    expect(percentileRank(20, [36, 25, 20], false)).toBe(100);
  });

  it("handles degenerate populations", () => {
    expect(percentileRank(50, [], true)).toBeNull();
    expect(percentileRank(50, [50], true)).toBe(50);
  });
});
