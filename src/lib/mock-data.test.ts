import { describe, it, expect } from "vitest";
import { mockSeries, mockChapters, mockSiteSettings } from "./mock-data";

describe("mockSeries", () => {
  it("contains at least one series", () => {
    expect(mockSeries.length).toBeGreaterThan(0);
  });

  it("has 12 series entries", () => {
    expect(mockSeries).toHaveLength(12);
  });

  it("each series has required fields", () => {
    for (const s of mockSeries) {
      expect(s.id).toBeTruthy();
      expect(s.slug).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.type).toMatch(/^(manga|novel)$/);
      expect(s.status).toMatch(/^(ongoing|completed|hiatus)$/);
      expect(s.description).toBeTruthy();
      expect(s.cover_url).toMatch(/^https:\/\//);
      expect(Array.isArray(s.genres)).toBe(true);
      expect(s.genres.length).toBeGreaterThan(0);
      expect(typeof s.views).toBe("number");
      expect(typeof s.rating).toBe("number");
      expect(s.rating).toBeGreaterThanOrEqual(0);
      expect(s.rating).toBeLessThanOrEqual(5);
      expect(s.created_at).toBeTruthy();
      expect(s.updated_at).toBeTruthy();
    }
  });

  it("has unique ids", () => {
    const ids = mockSeries.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique slugs", () => {
    const slugs = mockSeries.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("includes both manga and novel types", () => {
    const types = new Set(mockSeries.map((s) => s.type));
    expect(types.has("manga")).toBe(true);
    expect(types.has("novel")).toBe(true);
  });

  it("includes at least one trending series", () => {
    expect(mockSeries.some((s) => s.is_trending)).toBe(true);
  });

  it("includes at least one popular series", () => {
    expect(mockSeries.some((s) => s.is_popular)).toBe(true);
  });
});

describe("mockChapters", () => {
  it("generates chapters for each series", () => {
    expect(mockChapters.length).toBe(mockSeries.length * 4);
  });

  it("each chapter has required fields", () => {
    for (const ch of mockChapters) {
      expect(ch.id).toBeTruthy();
      expect(ch.series_id).toBeTruthy();
      expect(typeof ch.number).toBe("number");
      expect(ch.title).toBeTruthy();
      expect(typeof ch.is_premium).toBe("boolean");
      expect(typeof ch.coin_cost).toBe("number");
      expect(ch.created_at).toBeTruthy();
    }
  });

  it("first chapter of each series is premium with a coin cost", () => {
    for (const s of mockSeries) {
      const seriesChapters = mockChapters.filter((c) => c.series_id === s.id);
      const premium = seriesChapters.filter((c) => c.is_premium);
      expect(premium.length).toBe(1);
      expect(premium[0].coin_cost).toBeGreaterThan(0);
    }
  });

  it("non-premium chapters have zero coin cost", () => {
    const nonPremium = mockChapters.filter((c) => !c.is_premium);
    for (const ch of nonPremium) {
      expect(ch.coin_cost).toBe(0);
    }
  });

  it("chapter series_ids reference valid series", () => {
    const seriesIds = new Set(mockSeries.map((s) => s.id));
    for (const ch of mockChapters) {
      expect(seriesIds.has(ch.series_id)).toBe(true);
    }
  });
});

describe("mockSiteSettings", () => {
  it("has a site_name", () => {
    expect(mockSiteSettings.site_name).toBeTruthy();
  });

  it("has an seo_description", () => {
    expect(mockSiteSettings.seo_description).toBeTruthy();
  });
});
