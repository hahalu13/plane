import { observer } from "mobx-react";
import type { RefObject } from "react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Avatar, Row } from "@plane/ui";
import { getFileURL, findTotalDaysInRange } from "@plane/utils";
// components
import RenderIfVisible from "@/components/core/render-if-visible-HOC";
import { GanttLayoutListItemLoader } from "@/components/ui/loader/layouts/gantt-layout-loader";
import { BLOCK_HEIGHT } from "@/components/gantt-chart/constants";
// hooks
import { useAnalytics } from "@/hooks/store/use-analytics";
import { useTimeLineChart } from "@/hooks/use-timeline-chart";
import { GANTT_TIMELINE_TYPE } from "@plane/types";

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

type TimeGroupedData = {
  timeKey: string; // member user_id
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
  groups: TimeGroupedData[];
  blockIds: string[];
  ganttContainerRef: RefObject<HTMLDivElement>;
};

export const TimeGanttSidebar = observer(function TimeGanttSidebar({
  groups,
  blockIds,
  ganttContainerRef,
}: Props) {
  const { t } = useTranslation();
  const { getBlockById, getNumberOfDaysFromPosition } = useTimeLineChart(GANTT_TIMELINE_TYPE.ISSUE);
  const { selectedUsers, updateSelectedUsers } = useAnalytics();

  if (!groups || groups.length === 0) {
    return <div className="w-full p-4 text-sm text-secondary">{t("analytics.user_work_stats.gantt.no_data")}</div>;
  }

  const toggleUserSelection = (userId: string) => {
    const newSelectedUsers = selectedUsers.includes(userId)
      ? selectedUsers.filter(id => id !== userId)
      : [...selectedUsers, userId];
    
    updateSelectedUsers(newSelectedUsers);
  };

  return (
    <div className="w-full">
      {groups.map((group) => {
        // Get group's merged block ID
        const mergedBlockId = `merged-${group.timeKey}`;
        
        // Filter issues that have dates
        const issuesWithDates = group.issues.filter((issue) => {
          return issue.start_date && issue.target_date;
        });

        // Get the merged block
        const mergedBlock = getBlockById(mergedBlockId);
        const hasMergedBlock = mergedBlock !== null;

        // Always show group - we now create merged blocks for all members
        
        // Calculate group statistics
        const totalIssues = group.issues.length;
        const completedIssues = group.issues.filter((issue) => {
          return issue.state?.name?.toLowerCase().includes("done") || 
                 issue.state?.name?.toLowerCase().includes("completed") ||
                 issue.state?.name?.toLowerCase().includes("closed");
        }).length;
        
        // Calculate merged duration from the merged block or from date range
        const mergedDuration = hasMergedBlock && mergedBlock?.position?.width
          ? getNumberOfDaysFromPosition(mergedBlock.position.width)
          : (group.startDate && group.endDate
            ? findTotalDaysInRange(group.startDate, group.endDate)
            : 0); // Show 0 days for members with no work

        const isSelected = selectedUsers.includes(group.timeKey);
        
        return (
          <RenderIfVisible
            key={group.timeKey}
            root={ganttContainerRef}
            horizontalOffset={100}
            verticalOffset={200}
            shouldRecordHeights={false}
            placeholderChildren={<GanttLayoutListItemLoader />}
          >
            <div className="group/list-block">
              <Row
                className={`group w-full flex items-center gap-2 pr-4 border-b border-subtle-1 cursor-pointer ${isSelected ? 'bg-custom-primary-100/20' : 'bg-layer-transparent hover:bg-layer-transparent-hover'}`}
                style={{
                  height: `${BLOCK_HEIGHT}px`,
                }}
                onClick={() => toggleUserSelection(group.timeKey)}
              >
                <div className="flex h-full flex-grow items-center justify-between gap-2 truncate">
                  <div className="flex items-center gap-2 flex-grow truncate min-w-0">
                    {group.memberData?.avatar_url ? (
                      <Avatar
                        name={group.displayName}
                        src={getFileURL(group.memberData.avatar_url)}
                        size={20}
                        shape="circle"
                      />
                    ) : (
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-custom-background-80 border border-custom-border-200 capitalize overflow-hidden">
                        <span className="text-xs font-medium text-custom-text-200">
                          {group.displayName[0]?.toUpperCase() || "?"}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 truncate">
                      <span className="text-13 font-medium text-primary truncate">{group.displayName}</span>
                      <div className="flex items-center gap-3 mt-1 text-13 text-secondary">
                        <span>{t("analytics.user_work_stats.efficiency.completed")}: {completedIssues}</span>
                        <span>•</span>
                        <span>{totalIssues} {totalIssues === 1 ? t("common.task") : t("common.tasks")}</span>
                        {mergedDuration !== undefined && (
                          <>
                            <span>•</span>
                            <span>{mergedDuration} {t("common.days")}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {mergedDuration !== undefined && (
                    <div className="flex-shrink-0 text-13 text-secondary">
                      <span>
                        {mergedDuration} {mergedDuration === 1 ? t("common.day") : t("common.days")}
                      </span>
                    </div>
                  )}
                </div>
              </Row>
            </div>
          </RenderIfVisible>
        );
      })}
    </div>
  );
});

