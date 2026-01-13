import React, { useMemo } from "react";
import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import { UserRound } from "lucide-react";
// plane package imports
import { useTranslation } from "@plane/i18n";
import { Avatar } from "@plane/ui";
import { getFileURL } from "@plane/utils";
import { cn } from "@plane/utils";
// local imports
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import { InsightTable } from "../insight-table";
import { exportCSV } from "../export";
import { useParams } from "next/navigation";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    export: {
      key: string;
      value: (row: Row<TData>) => string | number;
      label?: string;
    };
  }
}

type MemberEfficiencyData = Array<{
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email: string;
  avatar_url?: string;
  total_issues: number;
  completed_issues: number;
  pending_issues: number;
  overdue_issues: number;
  completion_rate: number;
  avg_completion_time: number;
}>;

type Props = {
  memberEfficiency: MemberEfficiencyData;
};

export const MemberEfficiencyTable: React.FC<Props> = ({ memberEfficiency }) => {
  const { t } = useTranslation();
  const params = useParams();
  const workspaceSlug = params.workspaceSlug?.toString() || "";

  const getDisplayName = (member: MemberEfficiencyData[0]) => {
    return (
      member.display_name ||
      `${member.first_name || ""} ${member.last_name || ""}`.trim() ||
      member.email ||
      t("common.unassigned")
    );
  };

  const getAvatarUrl = (member: MemberEfficiencyData[0]) => {
    return member.avatar_url || null;
  };

  const formatCompletionRate = (rate: number) => {
    return `${rate.toFixed(1)}%`;
  };

  const formatCompletionTime = (time: number) => {
    if (time < 1) {
      return `< 1 ${t("common.days")}`;
    }
    return `${time.toFixed(1)} ${t("common.days")}`;
  };

  const columnsLabels = useMemo(
    () => ({
      user: t("analytics.user_work_stats.efficiency.user"),
      total_issues: t("analytics.user_work_stats.efficiency.total_issues"),
      completed: t("analytics.user_work_stats.efficiency.completed"),
      completion_rate: t("analytics.user_work_stats.efficiency.completion_rate"),
      avg_completion_time: t("analytics.user_work_stats.efficiency.avg_completion_time"),
      pending: t("analytics.user_work_stats.efficiency.pending"),
      overdue: t("analytics.user_work_stats.efficiency.overdue"),
    }),
    [t]
  );

  const columns: ColumnDef<MemberEfficiencyData[0]>[] = useMemo(
    () => [
      {
        id: "user",
        accessorFn: (row) => getDisplayName(row),
        header: () => <div className="text-left">{columnsLabels.user}</div>,
        cell: ({ row }) => {
          const member = row.original;
          const displayName = getDisplayName(member);
          const avatarUrl = getAvatarUrl(member);
          const initials = displayName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          return (
            <div className="flex items-center gap-2.5">
              {avatarUrl ? (
                <Avatar
                  name={displayName}
                  src={getFileURL(avatarUrl)}
                  size={24}
                  shape="circle"
                />
              ) : (
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-custom-background-80 border border-custom-border-200 capitalize overflow-hidden">
                  {displayName && displayName !== t("common.unassigned") ? (
                    <span className="text-xs font-medium text-custom-text-200">
                      {initials || displayName[0]?.toUpperCase() || "?"}
                    </span>
                  ) : (
                    <UserRound className="h-3 w-3 text-custom-text-400" />
                  )}
                </div>
              )}
              <span className="break-words text-secondary">{displayName}</span>
            </div>
          );
        },
        meta: {
          export: {
            key: columnsLabels.user,
            value: (row) => getDisplayName(row.original),
          },
        },
      },
      {
        accessorKey: "total_issues",
        header: () => <div className="text-right">{columnsLabels.total_issues}</div>,
        cell: ({ row }) => <div className="text-right">{row.original.total_issues}</div>,
        meta: {
          export: {
            key: columnsLabels.total_issues,
            value: (row) => row.original.total_issues.toString(),
          },
        },
      },
      {
        accessorKey: "completed_issues",
        header: () => <div className="text-right">{columnsLabels.completed}</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <span className="font-medium text-green-600 dark:text-green-400">
              {row.original.completed_issues}
            </span>
          </div>
        ),
        meta: {
          export: {
            key: columnsLabels.completed,
            value: (row) => row.original.completed_issues.toString(),
          },
        },
      },
      {
        accessorKey: "completion_rate",
        header: () => <div className="text-right">{columnsLabels.completion_rate}</div>,
        cell: ({ row }) => {
          const rate = row.original.completion_rate;
          return (
            <div className="text-right">
              <span
                className={cn(
                  "font-medium",
                  rate >= 80
                    ? "text-green-600 dark:text-green-400"
                    : rate >= 50
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-red-600 dark:text-red-400"
                )}
              >
                {formatCompletionRate(rate)}
              </span>
            </div>
          );
        },
        meta: {
          export: {
            key: columnsLabels.completion_rate,
            value: (row) => formatCompletionRate(row.original.completion_rate),
          },
        },
      },
      {
        accessorKey: "avg_completion_time",
        header: () => <div className="text-right">{columnsLabels.avg_completion_time}</div>,
        cell: ({ row }) => (
          <div className="text-right">{formatCompletionTime(row.original.avg_completion_time)}</div>
        ),
        meta: {
          export: {
            key: columnsLabels.avg_completion_time,
            value: (row) => formatCompletionTime(row.original.avg_completion_time),
          },
        },
      },
      {
        accessorKey: "pending_issues",
        header: () => <div className="text-right">{columnsLabels.pending}</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <span className="font-medium text-yellow-600 dark:text-yellow-400">
              {row.original.pending_issues}
            </span>
          </div>
        ),
        meta: {
          export: {
            key: columnsLabels.pending,
            value: (row) => row.original.pending_issues.toString(),
          },
        },
      },
      {
        accessorKey: "overdue_issues",
        header: () => <div className="text-right">{columnsLabels.overdue}</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <span className="font-medium text-red-600 dark:text-red-400">
              {row.original.overdue_issues}
            </span>
          </div>
        ),
        meta: {
          export: {
            key: columnsLabels.overdue,
            value: (row) => row.original.overdue_issues.toString(),
          },
        },
      },
    ],
[columnsLabels, t, getDisplayName, formatCompletionTime]
  );

  return (
    <AnalyticsSectionWrapper
      title={t("analytics.user_work_stats.efficiency.title")}
      className="col-span-1"
    >
      <InsightTable
        analyticsType="work-items"
        data={memberEfficiency as any}
        isLoading={false}
        columns={columns as any}
        columnsLabels={columnsLabels}
        headerText={t("analytics.user_work_stats.efficiency.user")}
        onExport={(rows) => memberEfficiency && exportCSV(rows, columns as any, workspaceSlug)}
        enablePagination={true}
        pageSize={10}
      />
    </AnalyticsSectionWrapper>
  );
};

