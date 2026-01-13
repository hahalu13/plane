// plane web components
import { observer } from "mobx-react";
// hooks
import { useAnalytics } from "@/hooks/store/use-analytics";
import { useProject } from "@/hooks/store/use-project";
// components
import { ProjectSelect } from "./select/project";
import { UserSelect } from "./select/user";

type Props = {
  users?: Array<{
    user_id: string;
    display_name: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
  }>;
};

const AnalyticsFilterActions = observer(function AnalyticsFilterActions({ users }: Props) {
  const { selectedProjects, selectedUsers, updateSelectedProjects, updateSelectedUsers } = useAnalytics();
  const { joinedProjectIds } = useProject();
  return (
    <div className="flex items-center justify-end gap-2">
      {users && users.length > 0 && (
        <UserSelect
          value={selectedUsers}
          onChange={(val) => {
            updateSelectedUsers(val ?? []);
          }}
          users={users}
        />
      )}
      <ProjectSelect
        value={selectedProjects}
        onChange={(val) => {
          updateSelectedProjects(val ?? []);
        }}
        projectIds={joinedProjectIds}
      />
    </div>
  );
});

export default AnalyticsFilterActions;
