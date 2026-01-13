import React from "react";
import { observer } from "mobx-react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
// plane package imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/ui";
import { TimelineLayoutIcon } from "@plane/propel/icons";
// services
import { AnalyticsService } from "@/services/analytics.service";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { useProject } from "@/hooks/store/use-project";
// local imports
import AnalyticsWrapper from "../analytics-wrapper";
import { OverviewCards } from "./overview-cards";
import { MemberEfficiencyTable } from "./member-efficiency-table";
import { ChartLoader } from "../loaders";
import { EmptyStateCompact } from "@plane/propel/empty-state";

const analyticsService = new AnalyticsService();

type UserWorkStatsResponse = {
  overview: {
    total_assigned: number;
    total_completed: number;
    completion_rate: number;
    avg_completion_time: number;
    overdue_count: number;
  };
  distribution: {
    by_state: Array<{ state_group: string; count: number }>;
    by_priority: Array<{ priority: string; count: number }>;
  };
  activity_trends: {
    created: Array<{ date?: string; week?: string; count: number }>;
    completed: Array<{ date?: string; week?: string; count: number }>;
  };
  member_efficiency: Array<{
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
};

const UserWorkStats = observer(function UserWorkStats() {
  const { t } = useTranslation();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const { selectedProjects } = useAnalytics();
  
  // Get workspace slug from params, URL query, or current workspace
  const workspaceSlug = 
    params.workspaceSlug?.toString() || 
    searchParams.get("workspace_slug") || 
    currentWorkspace?.slug || 
    "";

  // Get query parameters from URL or use defaults
  const userIds = searchParams.get("user_ids") || "";
  
  // Use selectedProjects from analytics store, or fallback to URL params
  const projectIds = selectedProjects?.length > 0 
    ? selectedProjects.join(",") 
    : searchParams.get("project_ids") || "";

  // Update URL when selectedProjects changes
  React.useEffect(() => {
    const currentProjectIds = searchParams.get("project_ids");
    const newProjectIds = selectedProjects?.join(",") || "";
    
    // Only update URL if the project IDs have changed
    if (currentProjectIds !== newProjectIds) {
      const newSearchParams = new URLSearchParams(searchParams.toString());
      if (newProjectIds) {
        newSearchParams.set("project_ids", newProjectIds);
      } else {
        newSearchParams.delete("project_ids");
      }
      router.replace(`?${newSearchParams.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjects]);

  // Fetch all data (no type parameter = returns all data)
  // Note: This page needs the full stats structure (overview, member_efficiency, etc.)
  // so we continue using the user-work-stats endpoint
  const { data, isLoading, error } = useSWR<UserWorkStatsResponse>(
    workspaceSlug ? `user-work-stats-${workspaceSlug}-${userIds}-${projectIds}` : null,
    () =>
      analyticsService.getUserWorkStats<UserWorkStatsResponse>(
        workspaceSlug,
        undefined, // No type = get all data
        {
          user_ids: userIds || undefined,
          project_ids: projectIds || undefined,
        }
      ),
    {
      revalidateIfStale: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      onError: (err) => {
        console.error("User Work Stats API Error:", err);
      },
      onSuccess: (data) => {
        console.log("User Work Stats API Success:", data);
      },
    }
  );

  if (isLoading) {
    return (
      <AnalyticsWrapper i18nTitle="analytics.user_work_stats.title">
        <div className="flex flex-col gap-14">
          <ChartLoader />
        </div>
      </AnalyticsWrapper>
    );
  }

  if (!workspaceSlug) {
    return (
      <AnalyticsWrapper i18nTitle="analytics.user_work_stats.title">
        <EmptyStateCompact
          assetKey="unknown"
          assetClassName="size-20"
          rootClassName="border border-subtle px-5 py-10 md:py-20 md:px-20"
          title={t("analytics.user_work_stats.workspace_required.title")}
          description={t("analytics.user_work_stats.workspace_required.description")}
        />
      </AnalyticsWrapper>
    );
  }

  if (error) {
    console.error("User Work Stats API Error:", error);
    return (
      <AnalyticsWrapper i18nTitle="analytics.user_work_stats.title">
        <EmptyStateCompact
          assetKey="unknown"
          assetClassName="size-20"
          rootClassName="border border-subtle px-5 py-10 md:py-20 md:px-20"
          title={t("analytics.user_work_stats.error.title")}
          description={error?.message || t("analytics.user_work_stats.error.description")}
        />
      </AnalyticsWrapper>
    );
  }

  if (!data) {
    return (
      <AnalyticsWrapper i18nTitle="analytics.user_work_stats.title">
        <div className="flex flex-col gap-14">
          <ChartLoader />
        </div>
      </AnalyticsWrapper>
    );
  }

  const handleNavigateToTimeGantt = () => {
    if (currentWorkspace?.slug) {
      const searchParams = new URLSearchParams();
      if (userIds) searchParams.set("user_ids", userIds);
      if (projectIds) searchParams.set("project_ids", projectIds);
      const queryString = searchParams.toString();
      router.push(`/${currentWorkspace.slug}/analytics/time-gantt${queryString ? `?${queryString}` : ""}`);
    }
  };

  return (
    <div className="px-6 py-4">
      {/* Header with title and Gantt Chart Link */}
      <div className="mb-4 flex items-center justify-between md:mb-6">
        <h1 className="text-20 font-bold">{t("analytics.user_work_stats.title")}</h1>
        <Button
          variant="outline-primary"
          size="md"
          onClick={handleNavigateToTimeGantt}
          className="flex items-center gap-2"
        >
          <TimelineLayoutIcon className="h-4 w-4" />
          {t("analytics.user_work_stats.time_gantt.title")}
        </Button>
      </div>

      <div className="flex flex-col gap-14">
        {/* Overview Cards */}
        <OverviewCards overview={data.overview} />

        {/* Member Efficiency Table */}
        <MemberEfficiencyTable memberEfficiency={data.member_efficiency} />
      </div>
    </div>
  );
});

export { UserWorkStats };

