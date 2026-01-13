import React from "react";
// plane package imports
import { useTranslation } from "@plane/i18n";
import { cn } from "@plane/utils";

type OverviewData = {
  total_assigned: number;
  total_completed: number;
  completion_rate: number;
  avg_completion_time: number;
  overdue_count: number;
};

type Props = {
  overview: OverviewData;
};

export const OverviewCards: React.FC<Props> = ({ overview }) => {
  const { t } = useTranslation();

  const cards = [
    {
      key: "total_assigned",
      label: t("analytics.user_work_stats.overview.total_assigned"),
      value: overview.total_assigned,
      description: t("analytics.user_work_stats.overview.total_assigned_description"),
    },
    {
      key: "total_completed",
      label: t("analytics.user_work_stats.overview.total_completed"),
      value: overview.total_completed,
      description: t("analytics.user_work_stats.overview.total_completed_description"),
    },
    {
      key: "completion_rate",
      label: t("analytics.user_work_stats.overview.completion_rate"),
      value: `${overview.completion_rate}%`,
      description: t("analytics.user_work_stats.overview.completion_rate_description"),
    },
    {
      key: "avg_completion_time",
      label: t("analytics.user_work_stats.overview.avg_completion_time"),
      value: `${overview.avg_completion_time} ${t("common.days")}`,
      description: t("analytics.user_work_stats.overview.avg_completion_time_description"),
    },
    {
      key: "overdue_count",
      label: t("analytics.user_work_stats.overview.overdue_count"),
      value: overview.overdue_count,
      description: t("analytics.user_work_stats.overview.overdue_count_description"),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:gap-10 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.key} className="flex flex-col gap-3">
          <div className="text-13 text-tertiary">{card.label}</div>
          <div className="flex flex-col gap-1">
            <div className="text-20 font-bold text-primary">{card.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

