// ============================================================
// DifficultyBar.test.tsx — tests for DifficultyBar and stabilityColorClass
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import DifficultyBar, { stabilityColorClass } from "./DifficultyBar";

describe("DifficultyBar", () => {
  afterEach(cleanup);

  it("renders green bar at 0% difficulty (value=1)", () => {
    const { container } = render(<DifficultyBar value={1} />);
    const bar = container.querySelector(".bg-green-500");
    expect(bar).not.toBeNull();
  });

  it("renders yellow bar at ~50% difficulty (value=5)", () => {
    const { container } = render(<DifficultyBar value={5} />);
    const bar = container.querySelector(".bg-yellow-500");
    expect(bar).not.toBeNull();
  });

  it("renders red bar at ~90% difficulty (value=9)", () => {
    const { container } = render(<DifficultyBar value={9} />);
    const bar = container.querySelector(".bg-red-500");
    expect(bar).not.toBeNull();
  });

  it("displays the value formatted to 1 decimal place", () => {
    const { container } = render(<DifficultyBar value={7} />);
    expect(container.textContent).toContain("7.0");
  });
});

describe("stabilityColorClass", () => {
  it("returns green for median ≥ 21 days", () => {
    expect(stabilityColorClass(21)).toBe("bg-green-500");
    expect(stabilityColorClass(60)).toBe("bg-green-500");
  });

  it("returns yellow for median 7–20 days", () => {
    expect(stabilityColorClass(7)).toBe("bg-yellow-500");
    expect(stabilityColorClass(14)).toBe("bg-yellow-500");
  });

  it("returns red for median < 7 days", () => {
    expect(stabilityColorClass(0)).toBe("bg-red-500");
    expect(stabilityColorClass(6)).toBe("bg-red-500");
  });
});
