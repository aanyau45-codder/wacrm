"use client";

import { createClient } from "@/lib/supabase/client";
import { createSharedStore, useSharedStore } from "@/lib/shared-store";
import type { Conversation } from "@/types";

/**
 * Count of conversations with at least one unread inbound message for
 * the current user. Used by the sidebar and the mobile tab bar to
 * surface a dot on the Inbox entry when the user is elsewhere.
 *
 * One shared realtime channel (distinct from the inbox page's
 * "inbox-realtime") serves every caller.
 */
const store = createSharedStore(0, (set) => {
  const supabase = createClient();
  let cancelled = false;
  // Live mirror of {id: unread_count} so INSERT/UPDATE/DELETE events
  // can adjust the total without refetching.
  let counts = new Map<string, number>();

  // Initial load. RLS scopes this to the signed-in user automatically —
  // no explicit user_id filter needed here.
  void (async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, unread_count");
    if (cancelled || error || !data) return;

    const map = new Map<string, number>();
    let sum = 0;
    for (const row of data as { id: string; unread_count: number }[]) {
      const n = row.unread_count ?? 0;
      map.set(row.id, n);
      if (n > 0) sum += 1;
    }
    counts = map;
    set(sum);
  })();

  const channel = supabase
    .channel("total-unread-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const oldRow = payload.old as Partial<Conversation>;
          if (oldRow.id) counts.delete(oldRow.id);
        } else {
          const row = payload.new as Conversation;
          counts.set(row.id, row.unread_count ?? 0);
        }
        // Recompute — cheap, conversations per user stay small.
        let sum = 0;
        for (const n of counts.values()) if (n > 0) sum += 1;
        set(sum);
      },
    )
    .subscribe();

  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
});

export function useTotalUnread(): number {
  return useSharedStore(store);
}
