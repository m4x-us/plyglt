// ============================================================
// BuyModal.test.tsx — Tests for BuyModal subscription upgrade dialog
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { BuyModal } from "./BuyModal";
import { CHECKOUT_URLS } from "@/lib/entitlement";

afterEach(cleanup);

describe("BuyModal", () => {
  it("renders annual subscription pricing option", () => {
    render(<BuyModal onClose={vi.fn()} onActivate={vi.fn()} />);
    expect(screen.getByText("Annual")).toBeInTheDocument();
  });

  it("fires onClose when Maybe later button is clicked", () => {
    const onClose = vi.fn();
    render(<BuyModal onClose={onClose} onActivate={vi.fn()} />);
    fireEvent.click(screen.getByText("Maybe later"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fires onActivate with annual checkout URL and calls onClose when pricing row is clicked", () => {
    const onActivate = vi.fn();
    const onClose = vi.fn();
    render(<BuyModal onClose={onClose} onActivate={onActivate} />);
    const annualBtn = screen
      .getAllByRole("button")
      .find((btn) => btn.textContent?.includes("Annual"))!;
    fireEvent.click(annualBtn);
    expect(onActivate).toHaveBeenCalledWith(CHECKOUT_URLS.annual);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("contains no 'lifetime' text — regression guard against Task #001", () => {
    const { container } = render(
      <BuyModal onClose={vi.fn()} onActivate={vi.fn()} />
    );
    expect(container.textContent).not.toMatch(/lifetime/i);
  });
});
