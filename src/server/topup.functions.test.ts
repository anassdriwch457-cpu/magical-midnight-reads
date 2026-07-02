import { describe, it, expect } from "vitest";
import { COIN_PACKAGES } from "./topup.functions";

describe("COIN_PACKAGES", () => {
  it("contains at least one package", () => {
    expect(COIN_PACKAGES.length).toBeGreaterThan(0);
  });

  it("each package has required fields", () => {
    for (const pkg of COIN_PACKAGES) {
      expect(pkg.id).toBeTruthy();
      expect(typeof pkg.coins).toBe("number");
      expect(typeof pkg.bonus).toBe("number");
      expect(typeof pkg.price).toBe("number");
      expect(pkg.label).toBeTruthy();
    }
  });

  it("has unique ids", () => {
    const ids = COIN_PACKAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all prices are positive", () => {
    for (const pkg of COIN_PACKAGES) {
      expect(pkg.price).toBeGreaterThan(0);
    }
  });

  it("all coin amounts are positive", () => {
    for (const pkg of COIN_PACKAGES) {
      expect(pkg.coins).toBeGreaterThan(0);
    }
  });

  it("bonuses are non-negative", () => {
    for (const pkg of COIN_PACKAGES) {
      expect(pkg.bonus).toBeGreaterThanOrEqual(0);
    }
  });

  it("packages are sorted by ascending price", () => {
    for (let i = 1; i < COIN_PACKAGES.length; i++) {
      expect(COIN_PACKAGES[i].price).toBeGreaterThan(COIN_PACKAGES[i - 1].price);
    }
  });

  it("packages are sorted by ascending coin amount", () => {
    for (let i = 1; i < COIN_PACKAGES.length; i++) {
      expect(COIN_PACKAGES[i].coins).toBeGreaterThan(COIN_PACKAGES[i - 1].coins);
    }
  });

  it("has exactly one popular package", () => {
    const popular = COIN_PACKAGES.filter((p) => "popular" in p && p.popular === true);
    expect(popular).toHaveLength(1);
  });

  it("higher-tier packages offer better value (lower price per coin)", () => {
    const valuePerCoin = COIN_PACKAGES.map((p) => ({
      id: p.id,
      pricePerCoin: p.price / (p.coins + p.bonus),
    }));
    for (let i = 1; i < valuePerCoin.length; i++) {
      expect(valuePerCoin[i].pricePerCoin).toBeLessThan(valuePerCoin[i - 1].pricePerCoin);
    }
  });
});
