"use client";

import { useSyncExternalStore } from "react";

type Updater<T> = T | ((prev: T) => T);

/**
 * One live value shared by every component that reads it. `start` runs
 * when the first reader mounts and its cleanup when the last unmounts,
 * so a realtime channel is opened once no matter how many places show
 * the value. Supabase returns the existing channel for a repeated name,
 * and adding `.on()` to an already-subscribed channel throws, so
 * per-component channels with a fixed name would crash the app.
 */
export function createSharedStore<T>(
  initial: T,
  start: (set: (next: Updater<T>) => void) => () => void,
) {
  let value = initial;
  let stop: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const set = (next: Updater<T>) => {
    value = typeof next === "function" ? (next as (prev: T) => T)(value) : next;
    listeners.forEach((l) => l());
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) stop = start(set);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stop?.();
          stop = null;
          value = initial;
        }
      };
    },
    get: () => value,
    initial,
  };
}

export function useSharedStore<T>(store: ReturnType<typeof createSharedStore<T>>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.initial);
}
