import { describe, it, expect } from "vitest";
import { resolveImage, PLACEHOLDER_COVER } from "./image";

describe("resolveImage", () => {
  it("returns placeholder for null", () => {
    expect(resolveImage(null)).toBe(PLACEHOLDER_COVER);
  });

  it("returns placeholder for undefined", () => {
    expect(resolveImage(undefined)).toBe(PLACEHOLDER_COVER);
  });

  it("returns placeholder for empty string", () => {
    expect(resolveImage("")).toBe(PLACEHOLDER_COVER);
  });

  it("passes through https URLs", () => {
    const url = "https://example.com/image.png";
    expect(resolveImage(url)).toBe(url);
  });

  it("passes through http URLs", () => {
    const url = "http://example.com/image.jpg";
    expect(resolveImage(url)).toBe(url);
  });

  it("is case-insensitive for protocol detection", () => {
    const url = "HTTPS://example.com/image.png";
    expect(resolveImage(url)).toBe(url);
  });

  it("rewrites /src/assets/ paths to public bucket URL", () => {
    const result = resolveImage("/src/assets/cover.png");
    expect(result).toBe(
      "https://rjwdxbnsnrahvogcyxld.supabase.co/storage/v1/object/public/chapter-images/seed/cover.png",
    );
  });

  it("rewrites nested /src/assets/ paths", () => {
    const result = resolveImage("/src/assets/manga/vol1/page1.jpg");
    expect(result).toBe(
      "https://rjwdxbnsnrahvogcyxld.supabase.co/storage/v1/object/public/chapter-images/seed/manga/vol1/page1.jpg",
    );
  });

  it("returns non-http, non-asset paths as-is", () => {
    const path = "/images/cover.png";
    expect(resolveImage(path)).toBe(path);
  });
});

describe("PLACEHOLDER_COVER", () => {
  it("is a valid https URL", () => {
    expect(PLACEHOLDER_COVER).toMatch(/^https:\/\//);
  });
});
