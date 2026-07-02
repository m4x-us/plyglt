// @vitest-environment jsdom
// ===========================================
// StatsProGate component tests
// ===========================================
// Verifies the Pro upgrade prompt renders its expected content.
// StatsProGate is static — no props, no context dependencies.
// ===========================================

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsProGate } from "./StatsProGate";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("StatsProGate", () => {
  it("renders the Pro upgrade prompt with the feature gate message and heading", () => {
    render(<StatsProGate />);

    // Heading is present and is an h1 — not just any element
    const heading = screen.getByRole("heading", { name: "Learning Stats" });
    expect(heading.tagName.toLowerCase()).toBe("h1");

    // Upgrade message is a paragraph with the exact feature gate copy
    const msg = screen.getByText("Detailed analytics are a Pro feature.");
    expect(msg.tagName.toLowerCase()).toBe("p");

    // Home link points to root
    const link = screen.getByRole("link", { name: /← Home/ });
    expect((link as HTMLAnchorElement).href).toMatch(/\/$/);
  });
});
