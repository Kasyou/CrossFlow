// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIpc } from "../src/hooks/useIpc";
import { usePolling } from "../src/hooks/usePolling";

describe("useIpc", () => {
  beforeEach(() => {
    (window as any).electronAPI = {
      invoke: vi.fn().mockResolvedValue("ok"),
      on: vi.fn().mockReturnValue(vi.fn()),
    };
  });

  it("throws if electronAPI not available", () => {
    delete (window as any).electronAPI;
    expect(() => {
      const { result } = renderHook(() => useIpc());
      // Access result to trigger the throw
      void result.current;
    }).toThrow("electronAPI not available");
  });

  it("returns invoke and on functions", () => {
    const { result } = renderHook(() => useIpc());
    expect(typeof result.current.invoke).toBe("function");
    expect(typeof result.current.on).toBe("function");
  });

  it("invoke calls electronAPI.invoke with channel and args", async () => {
    const { result } = renderHook(() => useIpc());
    await act(async () => {
      await result.current.invoke("test:channel", "arg1", 42);
    });
    expect((window as any).electronAPI.invoke).toHaveBeenCalledWith("test:channel", "arg1", 42);
  });

  it("invoke returns the resolved value", async () => {
    const { result } = renderHook(() => useIpc());
    let val: any;
    await act(async () => {
      val = await result.current.invoke("test:channel");
    });
    expect(val).toBe("ok");
  });

  it("on sets up listener and returns cleanup", () => {
    const { result } = renderHook(() => useIpc());
    const cleanup = result.current.on("some:event", () => {});
    expect((window as any).electronAPI.on).toHaveBeenCalledWith("some:event", expect.any(Function));
    expect(typeof cleanup).toBe("function");
  });
});

describe("usePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls callback immediately on mount when enabled", () => {
    const cb = vi.fn();
    renderHook(() => usePolling(cb, 5000, true));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("calls callback at interval", () => {
    const cb = vi.fn();
    renderHook(() => usePolling(cb, 5000, true));
    expect(cb).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(cb).toHaveBeenCalledTimes(2);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("does NOT call callback when disabled", () => {
    const cb = vi.fn();
    renderHook(() => usePolling(cb, 5000, false));
    expect(cb).not.toHaveBeenCalled();
  });

  it("does NOT poll when disabled", () => {
    const cb = vi.fn();
    renderHook(() => usePolling(cb, 5000, false));
    act(() => { vi.advanceTimersByTime(15000); });
    expect(cb).not.toHaveBeenCalled();
  });

  it("uses latest callback reference", () => {
    const cb1 = vi.fn();
    const { rerender } = renderHook(({ cb }) => usePolling(cb, 5000, true), { initialProps: { cb: cb1 } });
    expect(cb1).toHaveBeenCalledTimes(1);
    const cb2 = vi.fn();
    rerender({ cb: cb2 });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenCalledTimes(1);
  });

  it("cleans up interval on unmount", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => usePolling(cb, 5000, true));
    expect(cb).toHaveBeenCalledTimes(1);
    unmount();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(cb).toHaveBeenCalledTimes(1); // Should not get called again
  });
});
