import { describe, expect, it } from "vitest";
import { addSlugSuffix, firstAvailableSlug, slugify } from "./slug";

describe("slugify", () => {
  it("normalizes Polish letters and symbols", () => {
    expect(slugify("Łódź — żółć, 2026!"));
    expect(slugify("Łódź — żółć, 2026!")).toBe("lodz-zolc-2026");
  });

  it("uses a safe fallback for empty and reserved values", () => {
    expect(slugify("   !!!")).toBe("bez-tytulu");
    expect(slugify("notatki")).toBe("bez-tytulu");
  });

  it("keeps the full slug, including its suffix, within 80 characters", () => {
    const base = slugify("a".repeat(120));
    const suffixed = addSlugSuffix(base, 2);
    expect(base).toHaveLength(80);
    expect(suffixed).toHaveLength(80);
    expect(suffixed.endsWith("-2")).toBe(true);
  });

  it("selects the first free numeric suffix", () => {
    expect(firstAvailableSlug("Mój pomysł", ["moj-pomysl", "moj-pomysl-2"])).toBe("moj-pomysl-3");
  });
});
