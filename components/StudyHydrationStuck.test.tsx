// ============================================================
// StudyHydrationStuck.test.tsx — Tests for the stuck-hydration retry screen (Task #644)
// ============================================================
// @vitest-environment jsdom
// Round-7 audit finding (Agent A / Agent B, convergent, Rule 14): this component
// had no co-located test, unlike every sibling in components/ — its one
// interactive element (the Retry button's window.location.reload() call) was
// asserted nowhere in the codebase.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import StudyHydrationStuck from "./StudyHydrationStuck";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StudyHydrationStuck", () => {
  it("renders the retry message and a Retry button", () => {
    render(<StudyHydrationStuck />);
    expect(screen.getByText("Couldn't load your progress.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  // Deletion Test: removing the onClick handler (or changing it to a no-op) makes
  // this fail — reload is called exactly once, only after the click.
  it("calls window.location.reload exactly once when the Retry button is clicked", () => {
    const reloadSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });

    render(<StudyHydrationStuck />);
    expect(reloadSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });
});
