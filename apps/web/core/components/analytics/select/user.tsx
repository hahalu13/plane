import { observer } from "mobx-react";
// plane package imports
import { useTranslation } from "@plane/i18n";
import { getButtonStyling } from "@plane/propel/button";
import { ChevronDownIcon, UserPropertyIcon } from "@plane/propel/icons";
import { Avatar } from "@plane/ui";
import { CustomSearchSelect } from "@plane/ui";
import { cn, getFileURL } from "@plane/utils";

type User = {
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
};

type Props = {
  value: string[] | undefined;
  onChange: (val: string[] | null) => void;
  users: User[];
};

export const UserSelect = observer(function UserSelect(props: Props) {
  const { value, onChange, users } = props;
  const { t } = useTranslation();

  const options = users?.map((user) => {
    const displayName =
      user.display_name ||
      `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
      user.email ||
      t("common.unassigned");

    return {
      value: user.user_id,
      query: `${displayName} ${user.email}`,
      content: (
        <div className="flex max-w-[300px] items-center gap-2">
          {user.avatar_url ? (
            <Avatar
              name={displayName}
              src={getFileURL(user.avatar_url)}
              size={16}
              shape="circle"
            />
          ) : (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-custom-background-80 border border-custom-border-200 capitalize overflow-hidden">
              <span className="text-[10px] font-medium text-custom-text-200">
                {displayName[0]?.toUpperCase() || "?"}
              </span>
            </div>
          )}
          <span className="flex-grow truncate">{displayName}</span>
        </div>
      ),
    };
  });

  const selectedUsers = users?.filter((u) => value?.includes(u.user_id)) || [];
  const displayText =
    value && value.length > 3
      ? t("analytics.common.members_count", { count: value.length })
      : value && value.length > 0
        ? selectedUsers.map((u) => u.display_name || u.email).join(", ")
        : t("analytics.common.all_members");

  return (
    <CustomSearchSelect
      value={value ?? []}
      onChange={(val: string[]) => onChange(val)}
      options={options}
      className="border-none p-0"
      customButton={
        <div className={cn(getButtonStyling("secondary", "lg"), "gap-2")}>
          <UserPropertyIcon className="h-4 w-4" />
          {displayText}
          <ChevronDownIcon className="h-3 w-3" aria-hidden="true" />
        </div>
      }
      customButtonClassName="border-none p-0 bg-transparent hover:bg-transparent w-auto h-auto"
      multiple
    />
  );
});

