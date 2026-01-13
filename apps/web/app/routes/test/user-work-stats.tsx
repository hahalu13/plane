import React from "react";
import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
// components
import UserWorkStats from "@/core/components/analytics/user-work-stats/root";
import AnalyticsWrapper from "@/core/components/analytics/analytics-wrapper";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";

const UserWorkStatsTestPage = observer(function UserWorkStatsTestPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  
  // Get workspace slug from URL params or use current workspace
  const workspaceSlug = searchParams.get("workspace_slug") || currentWorkspace?.slug;

  if (!workspaceSlug) {
    return (
      <div className="min-h-screen bg-custom-background-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-custom-text-100 mb-4">
            {t("analytics.user_work_stats.title")} - Test Page
          </h1>
          <p className="text-custom-text-200">
            Please provide a workspace_slug parameter in the URL or ensure you are logged in to a workspace.
          </p>
          <p className="text-custom-text-300 mt-2 text-sm">
            Example: /test/analytics/user-work-stats/?workspace_slug=your-workspace-slug
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-custom-background-100">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-custom-text-100">
            {t("analytics.user_work_stats.title")} - Test Page
          </h1>
          <p className="text-custom-text-200 mt-2">
            This is a test page for the User Work Stats analytics component.
          </p>
          <p className="text-custom-text-300 mt-1 text-sm">
            Workspace: {workspaceSlug}
          </p>
        </div>

        <div className="bg-custom-background-100 rounded-lg border border-custom-border-200">
          <UserWorkStats />
        </div>
      </div>
    </div>
  );
});

export default UserWorkStatsTestPage;
