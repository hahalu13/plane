import React, { useMemo } from "react";
// plane package imports
import { useTranslation } from "@plane/i18n";
import { AreaChart } from "@plane/propel/charts/area-chart";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { Card } from "@plane/ui";
import { renderFormattedDate } from "@plane/utils";
// local imports
import AnalyticsSectionWrapper from "../../analytics-section-wrapper";

type ActivityTrendsData = {
  created: Array<{ date?: string; week?: string; count: number }>;
  completed: Array<{ date?: string; week?: string; count: number }>;
};

type Props = {
  activityTrends: ActivityTrendsData;
};

export const ActivityTrendsChart: React.FC<Props> = ({ activityTrends }) => {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    // Combine created and completed data by date/week
    const dataMap = new Map<string, { created: number; completed: number; name: string }>();

    activityTrends.created.forEach((item) => {
      const key = item.date || item.week || "";
      const name = item.date ? renderFormattedDate(item.date) : item.week || key;
      dataMap.set(key, {
        created: item.count,
        completed: 0,
        name,
      });
    });

    activityTrends.completed.forEach((item) => {
      const key = item.date || item.week || "";
      const name = item.date ? renderFormattedDate(item.date) : item.week || key;
      const existing = dataMap.get(key);
      if (existing) {
        existing.completed = item.count;
      } else {
        dataMap.set(key, {
          created: 0,
          completed: item.count,
          name,
        });
      }
    });

    // Sort by key (date/week)
    return Array.from(dataMap.values()).sort((a, b) => {
      const aKey = activityTrends.created.find((item) => {
        const key = item.date || item.week || "";
        const name = item.date ? renderFormattedDate(item.date) : item.week || key;
        return name === a.name;
      });
      const bKey = activityTrends.created.find((item) => {
        const key = item.date || item.week || "";
        const name = item.date ? renderFormattedDate(item.date) : item.week || key;
        return name === b.name;
      });
      const aDate = aKey?.date || aKey?.week || "";
      const bDate = bKey?.date || bKey?.week || "";
      return aDate.localeCompare(bDate);
    });
  }, [activityTrends]);

  const areas = useMemo(
    () => [
      {
        key: "completed",
        label: t("analytics.user_work_stats.activity_trends.completed"),
        fill: "#19803833",
        fillOpacity: 1,
        stackId: "bar-one",
        showDot: false,
        smoothCurves: true,
        strokeColor: "#198038",
        strokeOpacity: 1,
      },
      {
        key: "created",
        label: t("analytics.user_work_stats.activity_trends.created"),
        fill: "#1192E833",
        fillOpacity: 1,
        stackId: "bar-one",
        showDot: false,
        smoothCurves: true,
        strokeColor: "#1192E8",
        strokeOpacity: 1,
      },
    ],
    [t]
  );

  const hasData = chartData.length > 0;

  return (
    <AnalyticsSectionWrapper
      title={t("analytics.user_work_stats.activity_trends.title")}
      className="col-span-1"
    >
      <Card>
        {hasData ? (
          <AreaChart
            className="h-[350px] w-full"
            data={chartData}
            areas={areas}
            xAxis={{
              key: "name",
              label: t("common.date"),
              dy: 30,
            }}
            yAxis={{
              key: "created",
              label: t("common.count"),
              offset: -60,
              dx: -26,
            }}
          />
        ) : (
          <EmptyStateCompact
            assetKey="unknown"
            assetClassName="size-20"
            rootClassName="border border-subtle px-5 py-10"
            title={t("analytics.user_work_stats.activity_trends.no_data_title")}
            description={t("analytics.user_work_stats.activity_trends.no_data_subtitle")}
          />
        )}
      </Card>
    </AnalyticsSectionWrapper>
  );
};

