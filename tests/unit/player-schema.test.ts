import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { playerRecordSchema } from "@/lib/player-schema";

const DATA_DIR = join(import.meta.dirname, "..", "..", "src", "data");

describe("player data schema validation", () => {
  it("every record in every era JSON file matches the player schema", () => {
    const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json") && f !== "series-calibration.json"); // calibration output, not player records
    expect(files.length).toBeGreaterThan(0);

    let total = 0;
    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(DATA_DIR, file), "utf-8"));
      expect(Array.isArray(raw), `${file} should be a JSON array`).toBe(true);
      for (const record of raw) {
        const result = playerRecordSchema.safeParse(record);
        if (!result.success) {
          expect.unreachable(
            `${file}: invalid record ${JSON.stringify(record).slice(0, 120)} — ${JSON.stringify(result.error.issues).slice(0, 300)}`
          );
        }
        total++;
      }
    }
    expect(total).toBeGreaterThan(0);
  });
});
