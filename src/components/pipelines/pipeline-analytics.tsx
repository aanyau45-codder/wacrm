"use client";

import { useMemo } from "react";
import type { Deal, PipelineStage } from "@/types";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrencyShort, totalsCurrency } from "@/lib/currency";
import { useTranslations } from "next-intl";

interface PipelineAnalyticsProps {
  stages: PipelineStage[];
  deals: Deal[];
}

/**
 * Weighted pipeline value: value × per-stage probability.
 * First stage ≈ 10%, stages interpolate up to 90% before the final stage,
 * final stage (Won) = 100%. Lost deals excluded.
 */
function computeStageProbability(
  stage: PipelineStage,
  sortedStages: PipelineStage[],
): number {
  const n = sortedStages.length;
  if (n <= 1) return 1;
  const index = sortedStages.findIndex((s) => s.id === stage.id);
  if (index < 0) return 0;
  if (index === n - 1) return 1;
  const slots = n - 1;
  if (slots <= 1) return 0.1;
  const t = index / (slots - 1);
  return 0.1 + t * (0.9 - 0.1);
}

export function PipelineAnalytics({ stages, deals }: PipelineAnalyticsProps) {
  const t = useTranslations("Pipelines.analytics");
  const { defaultCurrency: accountCurrency } = useAuth();
  const defaultCurrency = useMemo(
    () => totalsCurrency(deals, accountCurrency),
    [deals, accountCurrency],
  );
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages],
  );

  const stats = useMemo(() => {
    const active = deals.filter((d) => d.status !== "lost");
    const openDeals = active.filter((d) => d.status !== "won");

    const totalCount = active.length;
    const totalValue = active.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const avgValue = totalCount > 0 ? totalValue / totalCount : 0;

    const stageById = new Map(sortedStages.map((s) => [s.id, s]));
    const weightedValue = openDeals.reduce((sum, d) => {
      const stage = stageById.get(d.stage_id);
      if (!stage) return sum;
      const prob = computeStageProbability(stage, sortedStages);
      return sum + Number(d.value || 0) * prob;
    }, 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = (d: Deal) => {
      const ts = d.updated_at ?? d.created_at;
      return ts ? new Date(ts) >= monthStart : false;
    };
    const wonThisMonth = deals.filter(
      (d) => d.status === "won" && thisMonth(d),
    ).length;
    const lostThisMonth = deals.filter(
      (d) => d.status === "lost" && thisMonth(d),
    ).length;

    return {
      totalCount,
      totalValue,
      avgValue,
      weightedValue,
      wonThisMonth,
      lostThisMonth,
    };
  }, [deals, sortedStages]);

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          tone="bg-pastel-lilac text-pastel-lilac-fg"
          label={t("pipelineValue")}
          value={formatCurrencyShort(stats.totalValue, defaultCurrency)}
          sub={`${t("totalDeals")}: ${stats.totalCount} · ${t("avgDealSize")}: ${formatCurrencyShort(stats.avgValue, defaultCurrency)}`}
          tooltip={t("pipelineValueTooltip")}
          t={t}
        />
        <Tile
          tone="bg-pastel-sky text-pastel-sky-fg"
          label={t("weightedValue")}
          value={formatCurrencyShort(stats.weightedValue, defaultCurrency)}
          tooltip={t("weightedValueTooltip")}
          t={t}
        />
        <Tile
          tone="bg-pastel-mint text-pastel-mint-fg"
          label={t("wonThisMonth")}
          value={String(stats.wonThisMonth)}
          tooltip={t("wonThisMonthTooltip")}
          t={t}
        />
        <Tile
          tone="bg-pastel-coral text-pastel-coral-fg"
          label={t("lostThisMonth")}
          value={String(stats.lostThisMonth)}
          tooltip={t("lostThisMonthTooltip")}
          t={t}
        />
      </div>
    </TooltipProvider>
  );
}

function Tile({
  tone,
  label,
  value,
  sub,
  tooltip,
  t,
}: {
  tone: string;
  label: string;
  value: string;
  sub?: string;
  tooltip: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  return (
    <div className={cn("flex min-h-[112px] flex-col justify-between rounded-[22px] p-4 sm:p-5", tone)}>
      <div className="flex items-start gap-1.5">
        <span className="text-[13px] leading-tight font-bold">{label}</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={t("howCalculated", { label })}
                className="ml-auto shrink-0 opacity-60 hover:opacity-100 focus:outline-none"
              />
            }
          >
            <Info className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-left">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-3">
        <p className="text-[26px] leading-none font-extrabold tracking-[-0.02em] sm:text-[30px]">{value}</p>
        {sub ? <p className="mt-1.5 truncate text-xs font-semibold opacity-75">{sub}</p> : null}
      </div>
    </div>
  );
}
