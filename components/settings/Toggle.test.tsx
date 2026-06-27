// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Toggle } from "./Toggle";

afterEach(cleanup);

describe("Toggle", () => {
  it("renders the label text", () => {
    render(<Toggle label="Enable reminders" checked={false} onChange={() => {}} />);
    expect(screen.getByText("Enable reminders")).toBeDefined();
  });

  it("renders the description when provided", () => {
    render(<Toggle label="L" description="Some detail" checked={false} onChange={() => {}} />);
    expect(screen.getByText("Some detail")).toBeDefined();
  });

  it("does not render description element when omitted", () => {
    render(<Toggle label="L" checked={false} onChange={() => {}} />);
    expect(screen.queryByText("Some detail")).toBeNull();
  });

  it("fires onChange with toggled value when clicked", () => {
    const onChange = vi.fn();
    render(<Toggle label="L" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("fires onChange with false when currently checked", () => {
    const onChange = vi.fn();
    render(<Toggle label="L" checked={true} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("sets aria-checked to match the checked prop", () => {
    const { rerender } = render(<Toggle label="L" checked={false} onChange={() => {}} />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
    rerender(<Toggle label="L" checked={true} onChange={() => {}} />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });
});
