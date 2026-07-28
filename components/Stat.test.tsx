// ============================================================
// Stat.test.tsx — Tests for Stat display component
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Stat } from "./Stat";

describe("Stat", () => {
  afterEach(cleanup);
  it("renders the value prop", () => {
    render(<Stat value={42} label="Reviewed" />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders the label prop", () => {
    render(<Stat value={0} label="Still due" />);
    expect(screen.getByText("Still due")).toBeInTheDocument();
  });

  it("renders a string value", () => {
    render(<Stat value="87%" label="Correct" />);
    expect(screen.getByText("87%")).toBeInTheDocument();
  });

  it("applies highlight color class when highlight is true", () => {
    const { container } = render(<Stat value={90} label="Correct" highlight />);
    expect(container.innerHTML).toContain("text-green-400");
  });

  it("does not apply highlight color when highlight is false", () => {
    const { container } = render(<Stat value={10} label="Reviewed" highlight={false} />);
    expect(container.innerHTML).not.toContain("text-green-400");
  });
});
