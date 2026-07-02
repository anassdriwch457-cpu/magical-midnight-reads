import { describe, it, expect } from "vitest";
import { hexToOklch } from "./theme";

describe("hexToOklch", () => {
  it("converts pure black (#000000)", () => {
    const { l, c, h } = hexToOklch("#000000");
    expect(l).toBeCloseTo(0, 2);
    expect(c).toBeCloseTo(0, 2);
  });

  it("converts pure white (#ffffff)", () => {
    const { l, c } = hexToOklch("#ffffff");
    expect(l).toBeCloseTo(1, 1);
    expect(c).toBeCloseTo(0, 2);
  });

  it("converts pure red (#ff0000)", () => {
    const { l, c, h } = hexToOklch("#ff0000");
    expect(l).toBeGreaterThan(0.4);
    expect(l).toBeLessThan(0.7);
    expect(c).toBeGreaterThan(0.15);
    // Red in oklch is roughly 29 degrees
    expect(h).toBeGreaterThan(15);
    expect(h).toBeLessThan(45);
  });

  it("converts pure green (#00ff00)", () => {
    const { l, c, h } = hexToOklch("#00ff00");
    expect(l).toBeGreaterThan(0.8);
    expect(c).toBeGreaterThan(0.15);
    // Green in oklch is roughly 142 degrees
    expect(h).toBeGreaterThan(120);
    expect(h).toBeLessThan(160);
  });

  it("converts pure blue (#0000ff)", () => {
    const { l, c, h } = hexToOklch("#0000ff");
    expect(l).toBeGreaterThan(0.3);
    expect(l).toBeLessThan(0.5);
    expect(c).toBeGreaterThan(0.15);
    // Blue in oklch is roughly 264 degrees
    expect(h).toBeGreaterThan(250);
    expect(h).toBeLessThan(280);
  });

  it("accepts hex without # prefix", () => {
    const withHash = hexToOklch("#d946ef");
    const withoutHash = hexToOklch("d946ef");
    expect(withHash.l).toBeCloseTo(withoutHash.l, 5);
    expect(withHash.c).toBeCloseTo(withoutHash.c, 5);
    expect(withHash.h).toBeCloseTo(withoutHash.h, 5);
  });

  it("returns positive hue values", () => {
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff"];
    for (const color of colors) {
      const { h } = hexToOklch(color);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });

  it("returns lightness between 0 and 1", () => {
    const colors = ["#000000", "#ffffff", "#808080", "#d946ef", "#1a1a2e"];
    for (const color of colors) {
      const { l } = hexToOklch(color);
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(1);
    }
  });

  it("returns non-negative chroma", () => {
    const colors = ["#000000", "#ffffff", "#ff0000", "#d946ef"];
    for (const color of colors) {
      const { c } = hexToOklch(color);
      expect(c).toBeGreaterThanOrEqual(0);
    }
  });

  it("converts a mid-gray correctly (achromatic, near-zero chroma)", () => {
    const { l, c } = hexToOklch("#808080");
    expect(l).toBeGreaterThan(0.4);
    expect(l).toBeLessThan(0.7);
    expect(c).toBeLessThan(0.01);
  });
});
