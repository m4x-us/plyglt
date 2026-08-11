// ============================================================
// StudyUnitNotFound.test.tsx — Tests for the "Unit not found" dead-end guard
// ============================================================
// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import StudyUnitNotFound from "./StudyUnitNotFound";

const mockExitMandatoryMode = vi.fn(() => Promise.resolve());
vi.mock("@/lib/tauriInterrupt", () => ({
  exitMandatoryMode: () => mockExitMandatoryMode(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StudyUnitNotFound", () => {
  it("renders the error message and a Home button — this state must never be a dead end", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<StudyUnitNotFound mode="interrupt" unitId="" onHome={vi.fn()} />);
    expect(screen.getByText("Unit not found.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Home/ })).toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it("always calls exitMandatoryMode before onHome, unconditionally — the window may still be mandatory-mode-locked even though mode is no longer 'interrupt' by construction at this render", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onHome = vi.fn();
    render(<StudyUnitNotFound mode="interrupt" unitId="" onHome={onHome} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Home/ }));
    });
    expect(mockExitMandatoryMode).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it("still calls onHome when exitMandatoryMode rejects — force-quit must never be the only way out", async () => {
    mockExitMandatoryMode.mockRejectedValueOnce(new Error("IPC failed"));
    const onHome = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<StudyUnitNotFound mode={null} unitId="u1" onHome={onHome} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Home/ }));
    });
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("ERR-IPC-EXIT"), expect.any(Error));
    errorSpy.mockRestore();
  });

  it("logs the mode and unitId that led to this dead-end guard, so a recurrence is diagnosable", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<StudyUnitNotFound mode="global" unitId="a1-unit-01" onHome={vi.fn()} />);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/ERR-STUDY-UNIT-NOT-FOUND.*mode="global" unitId="a1-unit-01"/)
    );
    errorSpy.mockRestore();
  });
});
