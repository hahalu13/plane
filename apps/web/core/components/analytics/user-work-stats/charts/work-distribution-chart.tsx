import React, { useMemo } from "react";
// plane package imports
import { STATE_GROUPS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { PieChart } from "@plane/propel/charts/pie-chart";
import { BarChart } from "@plane/propel/charts/bar-chart";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { Card } from "@plane/ui";
import { capitalizeFirstLetter } from "@plane/utils";
// local imports
import AnalyticsSectionWrapper from "../../analytics-section-wrapper";

type DistributionData = {
  by_state: Array<{ state_group: string; count: number }>;
  by_priority: Array<{ priority: string; count: number }>;
};

type Props = {
  distribution: DistributionData;
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#DC2626",
  high: "#F59E0B",
  medium: "#3B82F6",
  low: "#10B981",
  none: "#6B7280",
};

export const WorkDistributionChart: React.FC<Props> = ({ distribution }) => {
  const { t } = useTranslation();

  const stateData = useMemo(() => {
    if (!distribution.by_state || distribution.by_state.length === 0) return [];
    return distribution.by_state.map((item) => ({
      id: item.state_group,
      key: item.state_group,
      value: item.count,
      name: capitalizeFirstLetter(item.state_group),
      color: STATE_GROUPS[item.state_group as keyof typeof STATE_GROUPS]?.color ?? "#6B7280",
    }));
  }, [distribution.by_state]);

  const priorityData = useMemo(() => {
    if (!distribution.by_priority || distribution.by_priority.length === 0) return [];
    return distribution.by_priority.map((item) => ({
      key: item.priority,
      name: capitalizeFirstLetter(item.priority),
      count: item.count,
    }));
  }, [distribution.by_priority]);

  const priorityBars = useMemo(
    () => [
      {
        key: "count",
        label: t("common.count"),
        stackId: "bar-one",
        fill: (payload: { key: string }) => PRIORITY_COLORS[payload.key] || "#6B7280",
        textClassName: "",
        showPercentage: false,
        showTopBorderRadius: () => true,
        showBottomBorderRadius: () => true,
      },
    ],
    [t]
  );

  const _hasData = stateData.length > 0 || priorityData.length > 0;

  return (
    <div className="grid grid-cols-1 gap-14 md:grid-cols-2">
      {/* State Distribution */}
      <AnalyticsSectionWrapper
        title={t("analytics.user_work_stats.distribution.by_state")}
        className="col-span-1"
      >
        <Card className="h-full">
          {stateData.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2 w-full h-[300px]">
              <PieChart
                className="size-full"
                dataKey="value"
                margin={{
                  top: 0,
                  right: -10,
                  bottom: 12,
                  left: -10,
                }}
                data={stateData}
                cells={stateData.map((item) => ({
                  key: item.key,
                  fill: item.color,
                }))}
                showTooltip
                tooltipLabel={t("analytics.common.count")}
                paddingAngle={5}
                cornerRadius={4}
                innerRadius="50%"
                showLabel={false}
              />
              <div className="flex items-center">
                <div className="w-full space-y-4">
                  {distribution.by_state.map((group) => (
                    <div key={group.state_group} className="flex items-center justify-between gap-2 text-11">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="h-2.5 w-2.5 rounded-xs"
                          style={{
                            backgroundColor:
                              STATE_GROUPS[group.state_group as keyof typeof STATE_GROUPS]?.color ?? "var(--background-color-accent-primary)"
                          }}
                        />
                        <div className="whitespace-nowrap">{STATE_GROUPS[group.state_group as keyof typeof STATE_GROUPS]?.label ?? group.state_group}</div>
                      </div>
                      <div>{group.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyStateCompact
              assetKey="unknown"
              assetClassName="size-20"
              rootClassName="border border-subtle px-5 py-10"
              title={t("analytics.user_work_stats.distribution.no_data")}
            />
          )}
        </Card>
      </AnalyticsSectionWrapper>

      {/* Priority Distribution */}
      <AnalyticsSectionWrapper
        title={t("analytics.user_work_stats.distribution.by_priority")}
        className="col-span-1"
      >
        <Card className="h-full">
          {priorityData.length > 0 ? (
            <div className="h-[300px] w-full">
              <BarChart
                className="h-full w-full"
                data={priorityData}
                bars={priorityBars}
                margin={{
                  bottom: 30,
                }}
                xAxis={{
                  key: "name",
                  label: t("common.priority"),
                  dy: 30,
                }}
                yAxis={{
                  key: "count",
                  label: t("common.count"),
                  offset: -60,
                  dx: -26,
                }}
              />
            </div>
          ) : (
            <EmptyStateCompact
              assetKey="unknown"
              assetClassName="size-20"
              rootClassName="border border-subtle px-5 py-10"
              title={t("analytics.user_work_stats.distribution.no_data")}
            />
          )}
        </Card>
      </AnalyticsSectionWrapper>
    </div>
  );
};

