import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { isToday, isPast } from "date-fns";

export interface DueFollowUp {
  id: number;
  followUpAt: string;
  followUpNote: string | null;
  followUpType: string | null;
  customer: { id: number; name: string; channel: string };
  assignedAgent: { id: number; name: string } | null;
}

export function useFollowUpNotifications() {
  const notifiedIds = useRef<Set<number>>(new Set());
  const permissionRequested = useRef(false);

  const { data: followUps = [] } = useQuery<DueFollowUp[]>({
    queryKey: ["follow-ups"],
    queryFn: () => apiGet("/follow-ups"),
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!permissionRequested.current && "Notification" in window && Notification.permission === "default") {
      permissionRequested.current = true;
      Notification.requestPermission();
    }
  }, []);

  const overdueItems = followUps.filter(
    (f) => isPast(new Date(f.followUpAt)) && !isToday(new Date(f.followUpAt))
  );
  const todayItems = followUps.filter((f) => isToday(new Date(f.followUpAt)));
  const dueItems: DueFollowUp[] = [...overdueItems, ...todayItems];

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    for (const fu of dueItems) {
      if (!notifiedIds.current.has(fu.id)) {
        notifiedIds.current.add(fu.id);
        try {
          const n = new Notification(`Follow-up: ${fu.customer.name}`, {
            body: fu.followUpNote ?? "You have a follow-up due now.",
            icon: "/crm/favicon.ico",
            tag: `follow-up-${fu.id}`,
            requireInteraction: true,
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch {
        }
      }
    }
  }, [dueItems.map((f) => f.id).join(",")]);

  return {
    dueItems,
    overdueItems,
    todayItems,
    totalDue: dueItems.length,
  };
}
