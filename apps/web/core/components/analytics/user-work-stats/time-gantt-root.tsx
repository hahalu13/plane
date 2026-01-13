import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import { autorun } from "mobx";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { GANTT_TIMELINE_TYPE } from "@plane/types";
import type { IGanttBlock } from "@plane/types";
// components
import { TimeLineTypeContext } from "@/components/gantt-chart/contexts";
import { GanttChartRoot } from "@/components/gantt-chart/root";
// services
import { AnalyticsService } from "@/services/analytics.service";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useAnalytics } from "@/hooks/store/use-analytics";
import { useTimeLineChart } from "@/hooks/use-timeline-chart";
// local imports
import { ChartLoader } from "../loaders";
import { TimeGanttSidebar } from "./time-gantt-sidebar";
import { TimeGanttBlock } from "./time-gantt-block";

const analyticsService = new AnalyticsService();

type GanttIssue = {
  id: string;
  name: string;
  start_date: string | null;
  target_date: string | null;
  sort_order: number | null;
  state: {
    name: string;
    color: string;
  };
  priority: string;
  project: {
    name: string;
    identifier: string;
  };
};

type MemberGanttData = {
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  issues: GanttIssue[];
};

// Time-grouped data structure
type TimeGroupedData = {
  timeKey: string; // e.g., "2026-01", "2026-01-01", or project identifier
  displayName: string;
  issues: GanttIssue[];
  startDate: string | null;
  endDate: string | null;
  memberData?: {
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
  };
};

type Props = {
  onUsersLoaded?: (users: Array<{
    user_id: string;
    display_name: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
  }>) => void;
  startDate?: string;
  endDate?: string;
};

export const TimeGanttRoot = observer(function TimeGanttRoot(props?: Props) {
  const { onUsersLoaded, startDate, endDate } = props || {};
  const { t } = useTranslation();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const { selectedProjects, selectedUsers, updateSelectedUsers } = useAnalytics();
  const timelineStore = useTimeLineChart(GANTT_TIMELINE_TYPE.ISSUE);
  const { initGantt, setBlockIds } = timelineStore;
  
  // Track client-side mount to avoid hydration mismatch
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Get workspace slug
  const workspaceSlug =
    params.workspaceSlug?.toString() ||
    searchParams.get("workspace_slug") ||
    currentWorkspace?.slug ||
    "";

  // Get query parameters from URL or store
  const userIdsFromUrl = searchParams.get("user_ids") || "";
  const userIds = selectedUsers?.length > 0
    ? selectedUsers.join(",")
    : userIdsFromUrl;
  
  const projectIds = selectedProjects?.length > 0
    ? selectedProjects.join(",")
    : searchParams.get("project_ids") || "";

  // Initialize selectedUsers from URL on mount
  useEffect(() => {
    if (userIdsFromUrl && (!selectedUsers || selectedUsers.length === 0)) {
      const userIdsArray = userIdsFromUrl.split(",").filter(Boolean);
      if (userIdsArray.length > 0) {
        updateSelectedUsers(userIdsArray);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update URL when selectedUsers changes
  useEffect(() => {
    const currentUserIds = searchParams.get("user_ids") || "";
    const newUserIds = selectedUsers?.join(",") || "";
    
    // Only update URL if the user IDs have changed
    if (currentUserIds !== newUserIds) {
      const newSearchParams = new URLSearchParams(searchParams.toString());
      if (newUserIds) {
        newSearchParams.set("user_ids", newUserIds);
      } else {
        newSearchParams.delete("user_ids");
      }
      router.replace(`?${newSearchParams.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUsers]);

  // Fetch gantt data using getUserWorkStats with gantt type
  // This API is specifically designed for gantt chart data
  const { data: ganttData, isLoading, error } = useSWR<MemberGanttData[]>(
    workspaceSlug ? `user-work-stats-gantt-${workspaceSlug}-${userIds}-${projectIds}-${startDate}-${endDate}` : null,
    () =>
      analyticsService.getUserWorkStats<MemberGanttData[]>(
        workspaceSlug,
        "gantt",
        {
          user_ids: userIds || undefined,
          project_ids: projectIds || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        }
      ),
    {
      revalidateIfStale: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  // ganttData should already be an array from getUserWorkStats API
  const normalizedGanttData = useMemo<MemberGanttData[]>(() => {
    if (!ganttData) return [];
    // getUserWorkStats with "gantt" type should return an array directly
    if (Array.isArray(ganttData)) return ganttData;
    // Fallback: if it's an object, try to extract array
    if (typeof ganttData === 'object') {
      if (Array.isArray((ganttData as Record<string, unknown>).data)) return (ganttData as Record<string, unknown>).data;
      if (Array.isArray((ganttData as Record<string, unknown>).members)) return (ganttData as Record<string, unknown>).members;
      if (Array.isArray((ganttData as Record<string, unknown>).gantt)) return (ganttData as Record<string, unknown>).gantt;
    }
    return [];
  }, [ganttData]);

  // Extract users from gantt data and notify parent
  useEffect(() => {
    if (normalizedGanttData && normalizedGanttData.length > 0 && onUsersLoaded) {
      const users = normalizedGanttData.map((member: MemberGanttData) => ({
        user_id: member.user_id,
        display_name: member.display_name,
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        avatar_url: member.avatar_url,
      }));
      onUsersLoaded(users);
    }
  }, [normalizedGanttData, onUsersLoaded]);

  // Group issues by member and merge tasks with merged time ranges
  const timeGroupedData = useMemo(() => {
    if (!normalizedGanttData || normalizedGanttData.length === 0) {
      return [];
    }

    // Process each member's issues and merge them
    const timeGroups: TimeGroupedData[] = [];
    
    normalizedGanttData.forEach((member: MemberGanttData) => {
      // Filter issues that have at least one date
      const issuesWithDates = member.issues.filter((issue: GanttIssue) => {
        return issue.start_date || issue.target_date;
      });

      // Calculate merged time range for all member's issues
      let minStartDate: string | null = null;
      let maxEndDate: string | null = null;

      issuesWithDates.forEach((issue: GanttIssue) => {
        if (issue.start_date) {
          if (!minStartDate || issue.start_date < minStartDate) {
            minStartDate = issue.start_date;
          }
        }
        if (issue.target_date) {
          if (!maxEndDate || issue.target_date > maxEndDate) {
            maxEndDate = issue.target_date;
          }
        }
      });

      // Always create a merged block for each member, even if they have no dated issues
      const displayName =
        member.display_name ||
        `${member.first_name || ""} ${member.last_name || ""}`.trim() ||
        member.email ||
        t("common.unassigned");

      timeGroups.push({
        timeKey: member.user_id,
        displayName,
        issues: issuesWithDates,
        startDate: minStartDate,
        endDate: maxEndDate,
        memberData: {
          first_name: member.first_name,
          last_name: member.last_name,
          email: member.email,
          avatar_url: member.avatar_url,
        },
      });
    });

    // Sort by display name
    return timeGroups.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [normalizedGanttData, t]);

  // Convert time-grouped data to blocks format (one merged block per member)
  const { blockIds, blocksMap } = useMemo(() => {
    if (!timeGroupedData || timeGroupedData.length === 0) {
      return { blockIds: [], blocksMap: {} };
    }

    const allBlockIds: string[] = [];
    const blocks: Record<string, IGanttBlock> = {};

    timeGroupedData.forEach((group) => {
      // Create one merged block per member using the member's user_id as block ID
      // and merged time range (always create, even if no dates)
      const blockId = `merged-${group.timeKey}`;
      allBlockIds.push(blockId);

        // Create a merged issue object for the block
        const mergedIssue: GanttIssue = {
          id: blockId,
          name: `${group.displayName} (${group.issues.length} ${group.issues.length === 1 ? t("common.task") : t("common.tasks")})`,
          start_date: group.startDate,
          target_date: group.endDate,
          sort_order: null,
          state: {
            name: "Merged",
            color: "#3b82f6", // Blue color for merged blocks
          },
          priority: "none",
          project: {
            name: "",
            identifier: "",
          },
        };

        blocks[blockId] = {
          id: blockId,
          name: mergedIssue.name,
          start_date: group.startDate || undefined,
          target_date: group.endDate || undefined,
          sort_order: undefined,
          data: {
            ...mergedIssue,
            originalIssues: group.issues, // Store original issues for reference
            memberId: group.timeKey,
          },
        };
    });

    return { blockIds: allBlockIds, blocksMap: blocks };
  }, [timeGroupedData]);

  // Initialize gantt chart only once on mount
  useEffect(() => {
    initGantt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set block IDs when they change
  useEffect(() => {
    if (blockIds && blockIds.length > 0) {
      setBlockIds(blockIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockIds]);

  // Use refs to track previous values for autorun optimization
  // Initialize with empty object to avoid hydration mismatch
  const blocksMapRef = useRef<Record<string, IGanttBlock>>({});
  const previousBlockIdsLengthRef = useRef<number>(0);
  const blocksMapKeysRef = useRef<string>("");
  const autorunDisposerRef = useRef<(() => void) | null>(null);
  const hasTriggeredTodayRef = useRef<boolean>(false);

  // Update blocksMap ref when blocksMap changes
  // Use useEffect to avoid hydration mismatch
  useEffect(() => {
    if (Object.keys(blocksMap).length > 0) {
      blocksMapRef.current = blocksMap;
    }
  }, [blocksMap]);

  // Setup autorun for ongoing updates when timeline view changes (week/month/quarter)
  // Use a ref to track blockIds length to detect actual changes
  useEffect(() => {
    const currentBlockIdsLength = blockIds.length;
    const currentBlocksMapKeys = Object.keys(blocksMap).sort().join(",");
    const blocksMapChanged = blocksMapKeysRef.current !== currentBlocksMapKeys;
    const blockIdsChanged = previousBlockIdsLengthRef.current !== currentBlockIdsLength;
    
    if (currentBlockIdsLength === 0 || Object.keys(blocksMap).length === 0) {
      // Only clean up if we had set up autorun before
      if (autorunDisposerRef.current) {
        autorunDisposerRef.current();
        autorunDisposerRef.current = null;
      }
      previousBlockIdsLengthRef.current = 0;
      blocksMapKeysRef.current = "";
      return;
    }

    const updateBlocks = (timelineStore as Record<string, unknown>).updateBlocks as ((getDataById: (id: string) => unknown) => void) | undefined;
    if (!updateBlocks) return;

    // Only recreate autorun if blockIds or blocksMap actually changed
    // This prevents autorun from being recreated on every render
    if (autorunDisposerRef.current && !blockIdsChanged && !blocksMapChanged) {
      // Autorun is already set up and data hasn't changed, just update the ref
      blocksMapRef.current = blocksMap;
      return;
    }

    // Clean up previous autorun if it exists
    if (autorunDisposerRef.current) {
      autorunDisposerRef.current();
    }

    // Update refs
    previousBlockIdsLengthRef.current = currentBlockIdsLength;
    blocksMapKeysRef.current = currentBlocksMapKeys;

    // Create getDataById function that accesses the current blocksMap from ref
    const getDataById = (id: string) => {
      const block = blocksMapRef.current[id];
      if (!block) return null;
      const mergedData = block.data as MergedBlockData;
      
      // For merged blocks, use the merged time range
      // Even if both dates are null, return the block data so it gets rendered
      if (mergedData.start_date || mergedData.target_date || (mergedData.start_date === null && mergedData.target_date === null)) {
        return {
          id: block.id,
          name: block.name,
          sort_order: block.sort_order ?? null,
          start_date: mergedData.start_date,
          target_date: mergedData.target_date,
          project_id: null, // Merged blocks don't have a single project
        };
      }
      
      return null;
    };

    // Create autorun that will reactively update blocks when timeline view changes
    autorunDisposerRef.current = autorun(() => {
      // Access observable properties to make autorun reactive
      // Access currentView to trigger on view change (week/month/quarter)
      const _currentView = (timelineStore as Record<string, unknown>).currentView;
      const storeBlockIds = (timelineStore as Record<string, unknown>).blockIds;
      const currentViewData = (timelineStore as Record<string, unknown>).currentViewData;
      
      // Access deep properties to ensure autorun tracks changes
      // Access these properties to make autorun reactive to view data changes
      const _viewKey = (currentViewData as Record<string, unknown> | undefined)?.key; // Access key to track view type changes (week/month/quarter)
      const startDate = (currentViewData as Record<string, unknown> | undefined)?.data?.startDate as string | undefined;
      const dayWidth = (currentViewData as Record<string, unknown> | undefined)?.data?.dayWidth as number | undefined;
      const _endDate = (currentViewData as Record<string, unknown> | undefined)?.data?.endDate;
      const _currentDate = (currentViewData as Record<string, unknown> | undefined)?.data?.currentDate;
      
      // Only update if we have blockIds and view data is ready
      // This ensures blocks are updated when view switches and data is available
      if (storeBlockIds && storeBlockIds.length > 0 && currentViewData && startDate && dayWidth) {
        try {
          // Bind updateBlocks to timelineStore to ensure correct 'this' context
          // updateBlocks will calculate block positions based on currentViewData
          updateBlocks.call(timelineStore, getDataById);
        } catch (error) {
          console.error("Error in autorun updateBlocks:", error);
        }
      }
    });

    return () => {
      // Only clean up if component is unmounting or data actually changed
      if (autorunDisposerRef.current) {
        autorunDisposerRef.current();
        autorunDisposerRef.current = null;
      }
    };
  }, [blockIds, blocksMap, timelineStore]);

  // Trigger "Today" button only once when page first loads
  useEffect(() => {
    if (!hasTriggeredTodayRef.current && blockIds && blockIds.length > 0 && blocksMap && Object.keys(blocksMap).length > 0) {
      hasTriggeredTodayRef.current = true;
      const timer = setTimeout(() => {
        const todayButton = document.querySelector('[data-testid="gantt-today-button"]') as HTMLButtonElement;
        if (todayButton) {
          todayButton.click();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [blockIds, blocksMap]);

  // Show loader during SSR or initial load to avoid hydration mismatch
  if (!isMounted || isLoading) {
    return <ChartLoader />;
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <EmptyStateCompact
          title={t("analytics.user_work_stats.gantt.error.title")}
          description={t("analytics.user_work_stats.gantt.error.description")}
        />
      </div>
    );
  }

  if (!normalizedGanttData || normalizedGanttData.length === 0 || timeGroupedData.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <EmptyStateCompact
          title={t("analytics.user_work_stats.gantt.no_data")}
          description={t("analytics.user_work_stats.gantt.no_data_description")}
        />
      </div>
    );
  }

  return (
    <TimeLineTypeContext.Provider value={GANTT_TIMELINE_TYPE.ISSUE}>
      <div className="h-full w-full">
        <GanttChartRoot
          border={false}
          title={t("analytics.user_work_stats.time_gantt.title")}
          loaderTitle={t("analytics.user_work_stats.time_gantt.title")}
          blockIds={blockIds}
          blockUpdateHandler={() => {}} // Read-only for analytics
          blockToRender={(data: { id: string }) => <TimeGanttBlock blockId={data.id} />}
          sidebarToRender={(props) => <TimeGanttSidebar groups={timeGroupedData} blockIds={blockIds} {...props} />}
          enableBlockLeftResize={false}
          enableBlockRightResize={false}
          enableBlockMove={false}
          enableReorder={false}
          enableAddBlock={false}
          enableSelection={true}
          enableDependency={false}
          showAllBlocks={true}
          showToday={true}
        />
      </div>
    </TimeLineTypeContext.Provider>
  );
});

