// @vitest-environment jsdom
// ============================================================
// Section.test.tsx — behavioral tests for settings/Section component
// ============================================================
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Section } from "./Section";

describe("Section", () => {
  afterEach(cleanup);

  it("renders the title prop", () => {
    render(<Section title="Account">placeholder</Section>);
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("renders children inside the section", () => {
    render(<Section title="Test"><p>child content</p></Section>);
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
