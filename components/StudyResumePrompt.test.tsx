// @vitest-environment jsdom
// ============================================================
// StudyResumePrompt.test.tsx — behavioral tests for StudyResumePrompt component
// ============================================================
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import StudyResumePrompt from "./StudyResumePrompt";

describe("StudyResumePrompt", () => {
  afterEach(cleanup);

  it("renders the resume heading", () => {
    render(<StudyResumePrompt resumePos={2} resumeTotal={10} onDecline={vi.fn()} onAccept={vi.fn()} />);
    expect(screen.getByText("Resume where you left off?")).toBeDefined();
  });

  it("shows current card position as resumePos + 1 of resumeTotal", () => {
    render(<StudyResumePrompt resumePos={2} resumeTotal={10} onDecline={vi.fn()} onAccept={vi.fn()} />);
    expect(screen.getByText(/Card 3 of 10/)).toBeDefined();
  });

  it("fires onAccept when Resume button is clicked", () => {
    const onAccept = vi.fn();
    render(<StudyResumePrompt resumePos={0} resumeTotal={5} onDecline={vi.fn()} onAccept={onAccept} />);
    fireEvent.click(screen.getByText("Resume →"));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("fires onDecline when Start over button is clicked", () => {
    const onDecline = vi.fn();
    render(<StudyResumePrompt resumePos={0} resumeTotal={5} onDecline={onDecline} onAccept={vi.fn()} />);
    fireEvent.click(screen.getByText("Start over"));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});
