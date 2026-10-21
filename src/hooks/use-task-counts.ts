"use client";

import { createClient } from "@/lib/supabase/client";
import { createSharedStore, useSharedStore } from "@/lib/shared-store";
import { kampalaStartOfDay, kampalaToday, addDays } from "@/lib/calling/dates";

export interface TaskCounts {
  /** Open tasks already past their due time. */
  overdue: number;
  /** Open tasks due later today (Kampala). */
  today: number;
}

/**
 * My open task counts for the nav badges (sidebar + mobile More sheet).
 * One shared realtime channel; any change to tasks re-counts, and a
 * minute timer moves "today" tasks into "overdue" as time passes.
 */
const store = createSharedStore<TaskCounts>({ overdue: 0, today: 0 }, (set) => {
  const supabase = createClient();
  let cancelled = false;

  const count = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId || cancelled) return;
    const now = new Date();
    const endOfToday = kampalaStartOfDay(addDays(kampalaToday(now), 1));
    const { data, error } = await supabase
      .from("tasks")
      .select("due_at")
      .eq("user_id", userId)
      .is("done_at", null)
      .lt("due_at", endOfToday)
      .limit(500);
    // Before migration 045 the table doesn't exist; just show nothing.
    if (cancelled || error) return;
    const nowIso = now.toISOString();
    const overdue = (data ?? []).filter((t) => (t.due_at as string) < nowIso).length;
    set({ overdue, today: (data ?? []).length - overdue });
  };

  void count();
  const timer = window.setInterval(() => void count(), 60_000);
  const channel = supabase
    .channel("tasks-counts")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => void count())
    .subscribe();

  return () => {
    cancelled = true;
    window.clearInterval(timer);
    supabase.removeChannel(channel);
  };
});

export function useTaskCounts(): TaskCounts {
  return useSharedStore(store);
}
