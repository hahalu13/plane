import { observer } from "mobx-react";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
// i18n
import { useTranslation } from "@plane/i18n";
// components
import { PageHead } from "@/components/core/page-title";
import AnalyticsFilterActions from "@/components/analytics/analytics-filter-actions";
import { TimeGanttRoot } from "@/components/analytics/user-work-stats/time-gantt-root";
import { DateRangeDropdown } from "@/components/dropdowns/date-range";
// utils
import { renderFormattedPayloadDate } from "@plane/utils";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import type { Route } from "./+types/page";

function TimeGanttPage({ params }: Route.ComponentProps) {
  // i18n
  const { t } = useTranslation();
  // store
  const { currentWorkspace } = useWorkspace();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const pageTitle = currentWorkspace?.name
    ? `${currentWorkspace.name} - ${t("analytics.user_work_stats.time_gantt.title")}`
    : t("analytics.user_work_stats.time_gantt.title");

  const [users, setUsers] = useState<Array<{
    user_id: string;
    display_name: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
  }>>([]);

  // Get current month start and end dates as default
  const getCurrentMonthRange = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: startOfMonth, to: endOfMonth };
  }, []);

  // Get date range from URL or use current month as default
  const startDateFromUrl = searchParams.get("start_date");
  const endDateFromUrl = searchParams.get("end_date");
  
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>(() => {
    if (startDateFromUrl && endDateFromUrl) {
      return {
        from: new Date(startDateFromUrl),
        to: new Date(endDateFromUrl),
      };
    }
    return getCurrentMonthRange;
  });

  // Update URL when date range changes
  useEffect(() => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    if (dateRange.from && dateRange.to) {
      newSearchParams.set("start_date", renderFormattedPayloadDate(dateRange.from));
      newSearchParams.set("end_date", renderFormattedPayloadDate(dateRange.to));
    } else {
      newSearchParams.delete("start_date");
      newSearchParams.delete("end_date");
    }
    router.replace(`?${newSearchParams.toString()}`);
  }, [dateRange, router, searchParams]);

  // Initialize date range from URL on mount if not set
  useEffect(() => {
    if (!startDateFromUrl || !endDateFromUrl) {
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.set("start_date", renderFormattedPayloadDate(getCurrentMonthRange.from));
      newSearchParams.set("end_date", renderFormattedPayloadDate(getCurrentMonthRange.to));
      router.replace(`?${newSearchParams.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHead title={pageTitle} />
      <div className="flex h-full w-full flex-col overflow-hidden">
        {/* Header with filters */}
        <div className="px-6 py-2 border-b border-subtle flex items-center gap-4 overflow-hidden w-full justify-between bg-surface-1 flex-shrink-0">
          <h1 className="text-lg font-semibold text-primary">
            {t("analytics.user_work_stats.time_gantt.title")}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <DateRangeDropdown
              value={dateRange}
              onSelect={(val) => {
                setDateRange(val || {});
              }}
              placeholder={{
                from: t("analytics.date_range.start_date"),
                to: t("analytics.date_range.end_date"),
              }}
              buttonVariant="secondary"
            />
            <AnalyticsFilterActions users={users.length > 0 ? users : undefined} />
          </div>
        </div>
        
        {/* Gantt Chart Content */}
        <div className="flex-1 overflow-hidden relative h-full w-full">
          <TimeGanttRoot 
            onUsersLoaded={setUsers}
            startDate={dateRange.from ? renderFormattedPayloadDate(dateRange.from) : undefined}
            endDate={dateRange.to ? renderFormattedPayloadDate(dateRange.to) : undefined}
          />
        </div>
      </div>
    </>
  );
}

export default observer(TimeGanttPage);

