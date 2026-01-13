import { observer } from "mobx-react";
import { useState } from "react";
// i18n
import { useTranslation } from "@plane/i18n";
// components
import { PageHead } from "@/components/core/page-title";
import AnalyticsFilterActions from "@/components/analytics/analytics-filter-actions";
import { MemberGanttRoot } from "@/components/analytics/user-work-stats/member-gantt-root";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import type { Route } from "./+types/page";

function MemberGanttPage({ params }: Route.ComponentProps) {
  // i18n
  const { t } = useTranslation();
  // store
  const { currentWorkspace } = useWorkspace();
  
  const pageTitle = currentWorkspace?.name
    ? `${currentWorkspace.name} - ${t("analytics.user_work_stats.gantt.title")}`
    : t("analytics.user_work_stats.gantt.title");

  const [users, setUsers] = useState<Array<{
    user_id: string;
    display_name: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
  }>>([]);

  return (
    <>
      <PageHead title={pageTitle} />
      <div className="flex h-full w-full flex-col overflow-hidden">
        {/* Header with filters */}
        <div className="px-6 py-2 border-b border-subtle flex items-center gap-4 overflow-hidden w-full justify-between bg-surface-1 flex-shrink-0">
          <h1 className="text-lg font-semibold text-primary">
            {t("analytics.user_work_stats.gantt.title")}
          </h1>
          <div className="flex-shrink-0">
            <AnalyticsFilterActions users={users.length > 0 ? users : undefined} />
          </div>
        </div>
        
        {/* Gantt Chart Content */}
        <div className="flex-1 overflow-hidden relative h-full w-full">
          <MemberGanttRoot onUsersLoaded={setUsers} />
        </div>
      </div>
    </>
  );
}

export default observer(MemberGanttPage);

