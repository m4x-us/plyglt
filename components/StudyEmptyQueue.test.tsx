// ============================================================
// StudyEmptyQueue.test.tsx — Tests for the "Nothing ready" empty state
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import StudyEmptyQueue from "./StudyEmptyQueue";

const mockExitMandatoryMode = vi.fn(() => Promise.resolve());
vi.mock("@/lib/tauriInterrupt", () => ({
  exitMandatoryMode: () => mockExitMandatoryMode(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StudyEmptyQueue", () => {
  it("renders the 'Nothing ready' message", () => {
    render(<StudyEmptyQueue isInterrupt={false} onHome={vi.fn()} />);
    expect(screen.getByText("Nothing ready.")).toBeInTheDocument();
    expect(screen.getByText("Check back later.")).toBeInTheDocument();
  });

  it("calls onHome directly when not in interrupt mode, without calling exitMandatoryMode", async () => {
    const onHome = vi.fn();
    render(<StudyEmptyQueue isInterrupt={false} onHome={onHome} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Home/ }));
    });
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(mockExitMandatoryMode).not.toHaveBeenCalled();
  });

  it("calls exitMandatoryMode before onHome when in interrupt mode", async () => {
    const onHome = vi.fn();
    render(<StudyEmptyQueue isInterrupt={true} onHome={onHome} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Home/ }));
    });
    expect(mockExitMandatoryMode).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("still calls onHome when exitMandatoryMode rejects in interrupt mode", async () => {
    mockExitMandatoryMode.mockRejectedValueOnce(new Error("IPC failed"));
    const onHome = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<StudyEmptyQueue isInterrupt={true} onHome={onHome} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Home/ }));
    });
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ERR-IPC-EXIT"), expect.any(Error));
    errorSpy.mockRestore();
  });
});
