import { describe, it, expect } from "vitest";
import { extFromContentType, normalizeUrl } from "./chapter-upload.functions";

describe("extFromContentType", () => {
  it("returns 'png' for image/png", () => {
    expect(extFromContentType("image/png")).toBe("png");
  });

  it("returns 'webp' for image/webp", () => {
    expect(extFromContentType("image/webp")).toBe("webp");
  });

  it("returns 'gif' for image/gif", () => {
    expect(extFromContentType("image/gif")).toBe("gif");
  });

  it("returns 'jpg' for image/jpeg", () => {
    expect(extFromContentType("image/jpeg")).toBe("jpg");
  });

  it("returns 'jpg' for unknown content types", () => {
    expect(extFromContentType("application/octet-stream")).toBe("jpg");
  });

  it("returns 'jpg' for empty string", () => {
    expect(extFromContentType("")).toBe("jpg");
  });

  it("detects png in longer content-type strings", () => {
    expect(extFromContentType("image/png; charset=utf-8")).toBe("png");
  });
});

describe("normalizeUrl", () => {
  it("returns empty string for empty input", () => {
    expect(normalizeUrl("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeUrl("   ")).toBe("");
  });

  it("converts Google Drive /file/d/ID/view to direct download", () => {
    const input = "https://drive.google.com/file/d/abc123xyz/view?usp=sharing";
    expect(normalizeUrl(input)).toBe("https://drive.google.com/uc?export=download&id=abc123xyz");
  });

  it("converts Google Drive /file/d/ID/edit to direct download", () => {
    const input = "https://drive.google.com/file/d/myFileId/edit";
    expect(normalizeUrl(input)).toBe("https://drive.google.com/uc?export=download&id=myFileId");
  });

  it("converts Google Drive open?id= to direct download", () => {
    const input = "https://drive.google.com/open?id=fileId456";
    expect(normalizeUrl(input)).toBe("https://drive.google.com/uc?export=download&id=fileId456");
  });

  it("passes through regular URLs", () => {
    const url = "https://example.com/image.png";
    expect(normalizeUrl(url)).toBe(url);
  });

  it("passes through googleusercontent.com URLs", () => {
    const url = "https://lh3.googleusercontent.com/some-image";
    expect(normalizeUrl(url)).toBe(url);
  });

  it("trims whitespace from input", () => {
    const url = "  https://example.com/image.png  ";
    expect(normalizeUrl(url)).toBe("https://example.com/image.png");
  });

  it("handles Google Drive URL with both open and id params", () => {
    const input = "https://drive.google.com/uc?export=download&id=existingId";
    expect(normalizeUrl(input)).toBe("https://drive.google.com/uc?export=download&id=existingId");
  });
});
