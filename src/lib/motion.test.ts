import { describe, it, expect } from "vitest";
import { SPRING, EASE, pageVariants, staggerContainer, staggerItem } from "./motion";

describe("SPRING presets", () => {
  it("has soft, snap, and breath presets", () => {
    expect(SPRING.soft).toBeDefined();
    expect(SPRING.snap).toBeDefined();
    expect(SPRING.breath).toBeDefined();
  });

  it("all presets use spring type", () => {
    expect(SPRING.soft.type).toBe("spring");
    expect(SPRING.snap.type).toBe("spring");
    expect(SPRING.breath.type).toBe("spring");
  });

  it("snap is stiffer than soft", () => {
    expect(SPRING.snap.stiffness).toBeGreaterThan(SPRING.soft.stiffness);
  });

  it("breath has lower stiffness (slower) than soft", () => {
    expect(SPRING.breath.stiffness).toBeLessThan(SPRING.soft.stiffness);
  });

  it("snap has lower mass than soft (snappier)", () => {
    expect(SPRING.snap.mass).toBeLessThan(SPRING.soft.mass);
  });

  it("breath has higher mass than soft (heavier)", () => {
    expect(SPRING.breath.mass).toBeGreaterThan(SPRING.soft.mass);
  });
});

describe("EASE", () => {
  it("is a 4-element cubic bezier array", () => {
    expect(EASE).toHaveLength(4);
    for (const v of EASE) {
      expect(typeof v).toBe("number");
    }
  });
});

describe("pageVariants", () => {
  it("defines initial, enter, and exit states", () => {
    expect(pageVariants.initial).toBeDefined();
    expect(pageVariants.enter).toBeDefined();
    expect(pageVariants.exit).toBeDefined();
  });

  it("initial state has zero opacity", () => {
    const initial = pageVariants.initial as Record<string, unknown>;
    expect(initial.opacity).toBe(0);
  });

  it("enter state has full opacity", () => {
    const enter = pageVariants.enter as Record<string, unknown>;
    expect(enter.opacity).toBe(1);
  });

  it("exit state has zero opacity", () => {
    const exit = pageVariants.exit as Record<string, unknown>;
    expect(exit.opacity).toBe(0);
  });
});

describe("staggerContainer", () => {
  it("returns variants with default stagger", () => {
    const variants = staggerContainer();
    expect(variants.initial).toBeDefined();
    expect(variants.enter).toBeDefined();
    expect(variants.exit).toBeDefined();
  });

  it("uses custom stagger value", () => {
    const variants = staggerContainer(0.1);
    const enter = variants.enter as { transition: { staggerChildren: number } };
    expect(enter.transition.staggerChildren).toBe(0.1);
  });

  it("uses default stagger of 0.045", () => {
    const variants = staggerContainer();
    const enter = variants.enter as { transition: { staggerChildren: number } };
    expect(enter.transition.staggerChildren).toBe(0.045);
  });
});

describe("staggerItem", () => {
  it("defines initial, enter, and exit states", () => {
    expect(staggerItem.initial).toBeDefined();
    expect(staggerItem.enter).toBeDefined();
    expect(staggerItem.exit).toBeDefined();
  });

  it("initial state starts invisible", () => {
    const initial = staggerItem.initial as Record<string, unknown>;
    expect(initial.opacity).toBe(0);
  });

  it("enter state is fully visible", () => {
    const enter = staggerItem.enter as Record<string, unknown>;
    expect(enter.opacity).toBe(1);
  });
});
