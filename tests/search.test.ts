import { describe, expect, it } from "vitest";
import { normalize, tokens } from "@/lib/search";

describe("arabic normalisation", () => {
  it("folds letter variants and harakat", () => {
    expect(normalize("أَحْمَر")).toBe(normalize("احمر"));
    expect(normalize("مكتبة")).toBe("مكتبه");
    expect(normalize("مستشفى")).toBe("مستشفي");
  });
  it("drops the definite article and stop words", () => {
    expect(tokens("العطر في الرياض")).toEqual(["عطر", "رياض"]);
  });
});
