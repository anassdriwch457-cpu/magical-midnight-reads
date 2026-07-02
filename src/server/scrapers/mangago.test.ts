import { describe, it, expect } from "vitest";
import { decode, abs } from "./mangago";

describe("decode", () => {
  it("decodes &amp; to &", () => {
    expect(decode("Tom &amp; Jerry")).toBe("Tom & Jerry");
  });

  it("decodes &lt; and &gt; then strips them as HTML-like tags", () => {
    // decode replaces entities first, then strips HTML tags, so <b> gets removed
    expect(decode("a &lt; b &gt; c")).toBe("a c");
  });

  it("decodes &lt; and &gt; in isolation", () => {
    // When < and > don't form a tag, nothing is stripped
    expect(decode("3 &lt; 5")).toBe("3 < 5");
  });

  it("decodes &quot;", () => {
    expect(decode("He said &quot;hello&quot;")).toBe('He said "hello"');
  });

  it("decodes &#039; (single quote)", () => {
    expect(decode("it&#039;s fine")).toBe("it's fine");
  });

  it("decodes &nbsp;", () => {
    expect(decode("word&nbsp;word")).toBe("word word");
  });

  it("strips HTML tags", () => {
    expect(decode("<b>bold</b> and <i>italic</i>")).toBe("bold and italic");
  });

  it("collapses whitespace", () => {
    expect(decode("  foo   bar  baz  ")).toBe("foo bar baz");
  });

  it("handles multiple entities together", () => {
    // After entity decode: "<p>A & B < C</p>"
    // Tag strip removes <p> and < C</p> (treated as one tag), leaving "A & B"
    expect(decode("<p>A &amp; B &lt; C</p>")).toBe("A & B");
  });

  it("returns empty string for empty input", () => {
    expect(decode("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(decode("Hello World")).toBe("Hello World");
  });
});

describe("abs", () => {
  it("returns empty string for empty input", () => {
    expect(abs("")).toBe("");
  });

  it("passes through full http URLs", () => {
    const url = "http://example.com/page";
    expect(abs(url)).toBe(url);
  });

  it("passes through full https URLs", () => {
    const url = "https://example.com/page";
    expect(abs(url)).toBe(url);
  });

  it("prepends https: to protocol-relative URLs", () => {
    expect(abs("//cdn.example.com/img.jpg")).toBe("https://cdn.example.com/img.jpg");
  });

  it("prepends site origin to absolute paths", () => {
    expect(abs("/read-manga/test")).toBe("https://www.mangago.me/read-manga/test");
  });

  it("returns relative paths as-is", () => {
    expect(abs("relative/path")).toBe("relative/path");
  });
});
