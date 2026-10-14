import { describe, expect, it, vi } from "vitest";
import { createSharedStore } from "./shared-store";

describe("createSharedStore", () => {
  it("starts once for many readers and stops after the last leaves", () => {
    const stop = vi.fn();
    const start = vi.fn(() => stop);
    const store = createSharedStore(0, start);

    const offA = store.subscribe(() => {});
    const offB = store.subscribe(() => {});
    const offC = store.subscribe(() => {});
    expect(start).toHaveBeenCalledTimes(1);

    offA();
    offB();
    expect(stop).not.toHaveBeenCalled();
    offC();
    expect(stop).toHaveBeenCalledTimes(1);

    store.subscribe(() => {});
    expect(start).toHaveBeenCalledTimes(2);
  });

  it("pushes updates to every reader and resets when idle", () => {
    let set!: (n: number | ((p: number) => number)) => void;
    const store = createSharedStore(0, (s) => {
      set = s;
      return () => {};
    });
    const a = vi.fn();
    const b = vi.fn();
    const offA = store.subscribe(a);
    const offB = store.subscribe(b);

    set(3);
    set((n) => n + 1);
    expect(store.get()).toBe(4);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(2);

    offA();
    offB();
    expect(store.get()).toBe(0);
  });
});
