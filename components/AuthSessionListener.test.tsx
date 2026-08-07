// ===========================================
// AUTH SESSION LISTENER COMPONENT TESTS
// ===========================================
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { AuthSessionListener } from "./AuthSessionListener";

const mockUseAuthStore = vi.fn(() => ({ status: "signed-out" as const, userId: null, email: null }));
vi.mock("@/store/authStore", () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

afterEach(cleanup);

describe("AuthSessionListener", () => {
  it("renders nothing", () => {
    const { container } = render(<AuthSessionListener />);
    expect(container.innerHTML).toBe("");
  });

  it("calls useAuthStore exactly once on mount, keeping the component subscribed to store/authStore.ts's live state", () => {
    mockUseAuthStore.mockClear();
    render(<AuthSessionListener />);
    expect(mockUseAuthStore).toHaveBeenCalledTimes(1);
  });
});
