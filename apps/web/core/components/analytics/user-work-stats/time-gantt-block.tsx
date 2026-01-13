import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
// components
import { SIDEBAR_WIDTH } from "@/components/gantt-chart/constants";
// hooks
import { useTimeLineChart } from "@/hooks/use-timeline-chart";
import { GANTT_TIMELINE_TYPE } from "@plane/types";
import { findTotalDaysInRange } from "@plane/utils";
// components
import { getBlockViewDetails } from "@/components/issues/issue-layouts/utils";

type MergedBlockData = {
  id: string;
  name: string;
  start_date: string | null;
  target_date: string | null;
  originalIssues?: Array<{
    id: string;
    name: string;
    start_date: string | null;
    target_date: string | null;
    project?: {
      name: string;
      identifier: string;
    };
  }>;
  memberId?: string;
};

type Props = {
  blockId: string;
};

export const TimeGanttBlock = observer(function TimeGanttBlock({ blockId }: Props) {
  const { t } = useTranslation();
  const { getBlockById } = useTimeLineChart(GANTT_TIMELINE_TYPE.ISSUE);

  const block = getBlockById(blockId);
  if (!block || !block.data) return null;

  const mergedData = block.data as MergedBlockData;
  
  // Use merged time range
  const startDate = mergedData.start_date;
  const targetDate = mergedData.target_date;
  
  if (!startDate && !targetDate) return null;

  // Handle cases where only one date is available
  const hasStartDateOnly = startDate && !targetDate;
  const hasTargetDateOnly = !startDate && targetDate;
  
  const issueForViewDetails = {
    start_date: startDate ?? undefined,
    target_date: targetDate ?? undefined,
  };
  
  if (hasStartDateOnly && !issueForViewDetails.target_date) {
    const currentDate = new Date().toISOString().split('T')[0];
    issueForViewDetails.target_date = currentDate;
  }
  else if (hasTargetDateOnly && !issueForViewDetails.start_date && targetDate) {
    const targetDateObj = new Date(targetDate);
    const startDateObj = new Date(targetDateObj);
    startDateObj.setDate(startDateObj.getDate() - 1);
    issueForViewDetails.start_date = startDateObj.toISOString().split('T')[0];
  }
  
  // Use blue color for merged blocks
  const stateColor = "#3b82f6";
  const { blockStyle } = getBlockViewDetails(issueForViewDetails, stateColor);
  
  const finalBlockStyle: React.CSSProperties = {
    ...blockStyle,
    backgroundColor: stateColor,
    ...(blockStyle.maskImage ? { maskImage: blockStyle.maskImage } : {}),
  };

  const duration = findTotalDaysInRange(startDate, targetDate) || 0;

  return (
    <button
      type="button"
      id={`merged-block-${blockId}`}
      className="relative flex h-full w-full cursor-pointer items-center rounded-sm space-between overflow-hidden border-0 p-0 bg-transparent"
      style={finalBlockStyle}
    >
      {/* Reduced opacity overlay to let background color show through more clearly */}
      <div className="absolute left-0 top-0 h-full w-full bg-surface-1/20 pointer-events-none" />
      <div
        className="sticky w-auto overflow-hidden truncate px-2.5 py-1 text-13 font-medium flex-1 z-10 flex items-center gap-1.5"
        style={{ 
          left: `${SIDEBAR_WIDTH}px`,
          color: '#ffffff',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)'
        }}
      >
        <span className="flex-1 truncate min-w-0">
          {mergedData.name}
        </span>
        {duration > 0 && (
          <span className="flex-shrink-0 text-xs opacity-90">
            ({duration} {duration === 1 ? t("common.day") : t("common.days")})
          </span>
        )}
      </div>
    </button>
  );
});

