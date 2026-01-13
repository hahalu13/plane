# Django imports
from django.db.models import (
    Count,
    F,
    Q,
    Avg,
    Case,
    When,
    Value,
    IntegerField,
    FloatField,
    ExpressionWrapper,
    DurationField,
)
from django.db.models.functions import TruncMonth, Cast, Concat
from django.db.models import DateField
from django.db import models
from django.utils import timezone
from datetime import datetime
import logging

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import allow_permission, ROLE
from plane.app.views.base import BaseAPIView
from plane.db.models import Issue, User, ProjectMember, WorkspaceMember
from plane.utils.issue_filters import issue_filters
from plane.utils.date_utils import get_analytics_filters

# Use plane.api logger which is configured in settings
logger = logging.getLogger("plane.api")


class UserWorkStatsEndpoint(BaseAPIView):
    """
    Endpoint for user work statistics analytics.
    Provides comprehensive statistics about user work including:
    - Overview metrics (total assigned, completed, completion rate, avg completion time)
    - Work distribution (by state, priority)
    - Activity trends over time
    - Member efficiency comparison
    """

    def initialize_workspace(self, slug: str) -> None:
        """Initialize workspace filters similar to AdvanceAnalyticsBaseView"""
        self._workspace_slug = slug
        self.filters = get_analytics_filters(
            slug=slug,
            type="analytics",
            user=self.request.user,
            date_filter=None,  # Don't filter by date for overall stats
            project_ids=self.request.GET.get("project_ids", None),
        )

    def _get_base_queryset(self, request):
        """Get base queryset for assigned issues"""
        # Get query parameters
        user_ids = request.GET.get("user_ids", "")
        
        # Parse user IDs if provided
        user_id_list = []
        if user_ids:
            user_id_list = [uid.strip() for uid in user_ids.split(",") if uid.strip()]

        # Get base filters from initialized filters
        base_filters = self.filters["base_filters"]
        
        # Create a copy of query params without start_date and end_date
        # These are handled separately in get_gantt_data to avoid conflicts
        query_params_copy = request.query_params.copy()
        if "start_date" in query_params_copy:
            query_params_copy.pop("start_date")
        if "end_date" in query_params_copy:
            query_params_copy.pop("end_date")
        
        # Get additional filters from request (for state, priority, etc.)
        # Exclude start_date and end_date to avoid conflicts with date range filtering
        filters = issue_filters(query_params_copy, "GET")

        # Log base filters for debugging
        logger.info(
            f"[DEBUG] Base queryset filters - workspace: {self._workspace_slug}, "
            f"base_filters keys: {list(base_filters.keys())}, "
            f"base_filters: {base_filters}, "
            f"additional_filters keys: {list(filters.keys())}, "
            f"user_ids: {user_id_list}, "
            f"current_user: {request.user.id if request.user else None}"
        )
        
        # Check total issues in workspace before filtering
        total_issues_in_workspace = Issue.issue_objects.filter(
            workspace__slug=self._workspace_slug
        ).count()
        
        # Check issues with base filters only
        issues_with_base_filters = Issue.issue_objects.filter(**base_filters).count()
        
        # Check issues with assignees
        issues_with_assignees = Issue.issue_objects.filter(
            **base_filters,
            assignees__isnull=False
        ).count()
        
        # Check issues without assignees (to see if that's the issue)
        issues_without_assignees = Issue.issue_objects.filter(
            **base_filters,
            assignees__isnull=True
        ).count()
        
        logger.info(
            f"[DEBUG] Base queryset statistics - "
            f"total_issues_in_workspace: {total_issues_in_workspace}, "
            f"issues_with_base_filters: {issues_with_base_filters}, "
            f"issues_with_assignees: {issues_with_assignees}, "
            f"issues_without_assignees: {issues_without_assignees}"
        )
        
        # If no issues with assignees, log a warning with more details
        if issues_with_assignees == 0 and issues_with_base_filters > 0:
            logger.warning(
                f"[WARNING] No assigned issues found! "
                f"Total issues with base filters: {issues_with_base_filters}, "
                f"But none have assignees. "
                f"This API only returns issues that are assigned to users."
            )

        # Base queryset for assigned issues
        # Similar to advance-analytics, use base_filters directly
        # For "按人统计" (statistics by person), we filter for assigned issues only
        # Note: issue_filters only adds issue_assignee__deleted_at__isnull=True if assignees param exists
        # We need to explicitly add it when filtering for assigned issues
        if "issue_assignee__deleted_at__isnull" not in filters:
            filters["issue_assignee__deleted_at__isnull"] = True
        
        base_queryset = (
            Issue.issue_objects.filter(**base_filters, **filters)
            .filter(assignees__isnull=False)
            .select_related("state", "project")
            .prefetch_related("assignees", "issue_assignee")
            .distinct()
        )

        # Filter by user IDs if provided
        if user_id_list:
            base_queryset = base_queryset.filter(assignees__id__in=user_id_list)
        
        return base_queryset, user_id_list

    def get_overview_data(self, request):
        """Get overview statistics"""
        base_queryset, user_id_list = self._get_base_queryset(request)
        return self._get_overview_stats(base_queryset)

    def get_members_data(self, request):
        """Get member efficiency comparison"""
        base_queryset, user_id_list = self._get_base_queryset(request)
        return self._get_member_efficiency(base_queryset, user_id_list)

    def get_distribution_data(self, request):
        """Get work distribution"""
        base_queryset, _ = self._get_base_queryset(request)
        return self._get_work_distribution(base_queryset)

    def get_trends_data(self, request):
        """Get activity trends"""
        base_queryset, _ = self._get_base_queryset(request)
        return self._get_activity_trends(base_queryset)

    def get_gantt_data(self, request):
        """Get gantt chart data grouped by members
        
        Returns all users (based on user_ids or workspace members) even if their issues
        are outside the date range. This ensures users are displayed in the sidebar
        even when they're outside the search range.
        """
        base_queryset, user_id_list = self._get_base_queryset(request)
        
        # Get date range from request parameters
        start_date_param = request.GET.get("start_date")
        end_date_param = request.GET.get("end_date")
        
        # Parse dates if provided
        start_date = None
        end_date = None
        if start_date_param:
            try:
                start_date = datetime.strptime(start_date_param, "%Y-%m-%d").date()
                logger.info(f"Parsed start_date: {start_date} (type: {type(start_date)})")
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid start_date format: {start_date_param}, error: {e}")
        
        if end_date_param:
            try:
                end_date = datetime.strptime(end_date_param, "%Y-%m-%d").date()
                logger.info(f"Parsed end_date: {end_date} (type: {type(end_date)})")
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid end_date format: {end_date_param}, error: {e}")
        
        # Validate date range
        if start_date and end_date and start_date > end_date:
            logger.warning(f"Invalid date range: start_date ({start_date}) > end_date ({end_date})")
        
        # Get all users that should be displayed
        # If user_ids are specified, use those; otherwise, get all workspace members
        if user_id_list:
            # Get users from the specified user_ids
            target_users = User.objects.filter(
                id__in=user_id_list,
                member_workspace__workspace__slug=self._workspace_slug,
                member_workspace__is_active=True,
            ).select_related("avatar_asset").distinct()
        else:
            # Get all active workspace members
            target_users = User.objects.filter(
                member_workspace__workspace__slug=self._workspace_slug,
                member_workspace__is_active=True,
            ).select_related("avatar_asset").distinct()
        
        # Log for debugging
        base_count = base_queryset.count()
        user_count = target_users.count()
        logger.info(
            f"Gantt data request - workspace: {self._workspace_slug}, "
            f"start_date: {start_date}, end_date: {end_date}, "
            f"user_ids: {user_id_list}, base_queryset_count: {base_count}, "
            f"target_users_count: {user_count}"
        )
        
        # Build date filter query for issues
        # Include issues that overlap with the date range [start_date, end_date]
        date_filter = Q(start_date__isnull=False) | Q(target_date__isnull=False)
        
        if start_date and end_date:
            # Filter issues that overlap with the date range [start_date, end_date]
            date_filter = date_filter & (
                # Case 1: Both dates exist - check proper overlap
                Q(
                    start_date__isnull=False,
                    target_date__isnull=False,
                    start_date__lte=end_date,
                    target_date__gte=start_date
                ) |
                # Case 2: Only start_date exists - include if start_date is within range
                Q(
                    start_date__isnull=False,
                    target_date__isnull=True,
                    start_date__gte=start_date,
                    start_date__lte=end_date
                ) |
                # Case 3: Only target_date exists - include if target_date is within range
                Q(
                    start_date__isnull=True,
                    target_date__isnull=False,
                    target_date__gte=start_date,
                    target_date__lte=end_date
                )
            )
        elif start_date:
            # Only start_date provided
            date_filter = date_filter & (
                Q(target_date__gte=start_date) | 
                Q(target_date__isnull=True, start_date__gte=start_date)
            )
        elif end_date:
            # Only end_date provided
            date_filter = date_filter & (
                Q(start_date__lte=end_date) | 
                Q(start_date__isnull=True, target_date__lte=end_date)
            )
        
        # Get issues with assignee information and dates (filtered by date range)
        issues = (
            base_queryset.filter(date_filter)
            .values(
                "id",
                "name",
                "start_date",
                "target_date",
                "sort_order",
                "state_id",
                "state__name",
                "state__color",
                "project_id",
                "priority",
                "project__name",
                "project__identifier",
                "assignees__id",
                "assignees__first_name",
                "assignees__last_name",
                "assignees__display_name",
                "assignees__email",
                "assignees__avatar",
                "assignees__avatar_asset",
            )
            .order_by("assignees__id", "start_date", "sort_order")
        )
        
        # Log filtered issues count for debugging
        issues_list = list(issues)
        logger.info(
            f"Gantt data - filtered issues count: {len(issues_list)}, "
            f"date_filter applied: start_date={start_date}, end_date={end_date}"
        )
        
        # Initialize gantt_data with all target users (user-centric approach)
        gantt_data = {}
        for user in target_users:
            user_id_str = str(user.id)
            avatar_url = None
            if user.avatar_asset:
                avatar_url = f"/api/assets/v2/static/{user.avatar_asset.id}/"
            elif user.avatar:
                avatar_url = user.avatar
            
            gantt_data[user_id_str] = {
                "user_id": user_id_str,
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "display_name": user.display_name or "",
                "email": user.email or "",
                "avatar_url": avatar_url,
                "issues": [],
            }
        
        # Group issues by assignee (only issues within date range)
        for issue in issues_list:
            assignee_id = str(issue["assignees__id"])
            if assignee_id in gantt_data:
                gantt_data[assignee_id]["issues"].append({
                    "id": str(issue["id"]),
                    "name": issue["name"],
                    "start_date": issue["start_date"].isoformat() if issue["start_date"] else None,
                    "target_date": issue["target_date"].isoformat() if issue["target_date"] else None,
                    "sort_order": issue["sort_order"],
                    "state_id": str(issue["state_id"]) if issue.get("state_id") else None,
                    "state": {
                        "name": issue.get("state__name", ""),
                        "color": issue.get("state__color", ""),
                    },
                    "priority": issue.get("priority", "none"),
                    "project_id": str(issue["project_id"]) if issue.get("project_id") else None,
                    "project": {
                        "name": issue.get("project__name", ""),
                        "identifier": issue.get("project__identifier", ""),
                    },
                })
        
        # Convert to list format
        # All users are included, even if they have no issues in the date range
        return list(gantt_data.values())

    def get_all_data(self, request):
        """Get all statistics data"""
        base_queryset, user_id_list = self._get_base_queryset(request)
        
        return {
            "overview": self._get_overview_stats(base_queryset),
            "distribution": self._get_work_distribution(base_queryset),
            "activity_trends": self._get_activity_trends(base_queryset),
            "member_efficiency": self._get_member_efficiency(base_queryset, user_id_list),
        }

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug):
        # Initialize workspace filters
        self.initialize_workspace(slug)
        
        # Get type parameter, default to return all data
        # Similar to advance-analytics-stats which uses type parameter
        type_param = request.GET.get("type", None)

        if type_param == "overview":
            return Response(
                self.get_overview_data(request),
                status=status.HTTP_200_OK,
            )
        elif type_param == "members":
            return Response(
                self.get_members_data(request),
                status=status.HTTP_200_OK,
            )
        elif type_param == "distribution":
            return Response(
                self.get_distribution_data(request),
                status=status.HTTP_200_OK,
            )
        elif type_param == "trends":
            return Response(
                self.get_trends_data(request),
                status=status.HTTP_200_OK,
            )
        elif type_param == "gantt":
            return Response(
                self.get_gantt_data(request),
                status=status.HTTP_200_OK,
            )
        elif type_param is None:
            # Default: return all data when type is not specified
            return Response(
                self.get_all_data(request),
                status=status.HTTP_200_OK,
            )
        
        return Response({"message": "Invalid type. Valid types: overview, members, distribution, trends, gantt"}, status=status.HTTP_400_BAD_REQUEST)

    def _get_overview_stats(self, queryset):
        """Calculate overview statistics"""
        total_assigned = queryset.count()

        completed_queryset = queryset.filter(state__group="completed")
        total_completed = completed_queryset.count()

        completion_rate = (total_completed / total_assigned * 100) if total_assigned > 0 else 0

        # Calculate average completion time (in days)
        avg_completion_time = self._calculate_avg_completion_time(completed_queryset)

        # Count overdue issues (target_date < today and not completed)
        today = timezone.now().date()
        overdue_count = queryset.filter(
            target_date__lt=today,
            state__group__in=["backlog", "unstarted", "started"],
        ).count()

        return {
            "total_assigned": total_assigned,
            "total_completed": total_completed,
            "completion_rate": round(completion_rate, 2),
            "avg_completion_time": round(avg_completion_time, 2),
            "overdue_count": overdue_count,
        }

    def _calculate_avg_completion_time(self, completed_queryset):
        """Calculate average time from creation to completion in days"""
        completed_with_dates = completed_queryset.filter(
            completed_at__isnull=False, created_at__isnull=False
        )

        if not completed_with_dates.exists():
            return 0

        # Calculate time difference using ExpressionWrapper
        # Cast datetime to date and calculate difference
        avg_delta = completed_with_dates.annotate(
            completion_days=ExpressionWrapper(
                Cast("completed_at", DateField()) - Cast("created_at", DateField()),
                output_field=DurationField(),
            )
        ).aggregate(avg_days=Avg("completion_days"))

        if avg_delta["avg_days"] is None:
            return 0

        # Convert timedelta to days (float)
        return avg_delta["avg_days"].total_seconds() / 86400.0

    def _get_work_distribution(self, queryset):
        """Get work distribution by state and priority"""
        # Distribution by state
        state_distribution = (
            queryset.annotate(state_group=F("state__group"))
            .values("state_group")
            .annotate(count=Count("id"))
            .order_by("state_group")
        )

        # Distribution by priority
        priority_order = ["urgent", "high", "medium", "low", "none"]
        priority_distribution = (
            queryset.values("priority")
            .annotate(count=Count("id"))
            .annotate(
                priority_order=Case(
                    *[When(priority=p, then=Value(i)) for i, p in enumerate(priority_order)],
                    default=Value(len(priority_order)),
                    output_field=IntegerField(),
                )
            )
            .order_by("priority_order")
        )

        return {
            "by_state": list(state_distribution),
            "by_priority": list(priority_distribution),
        }

    def _get_activity_trends(self, queryset):
        """Get activity trends over time"""
        # Group by month for all time trends
        created_trends = (
            queryset.annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )
        completed_trends = (
            queryset.filter(state__group="completed")
            .annotate(month=TruncMonth("completed_at"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )

        return {
            "created": list(created_trends),
            "completed": list(completed_trends),
        }

    def _get_member_efficiency(self, queryset, user_id_list=None):
        """Get efficiency comparison across members"""
        # Get all members who have assigned issues with aggregated stats
        # Include avatar_url similar to project_analytics.py
        member_stats = (
            queryset.annotate(
                avatar_url=Case(
                    # If `avatar_asset` exists, use it to generate the asset URL
                    When(
                        assignees__avatar_asset__isnull=False,
                        then=Concat(
                            Value("/api/assets/v2/static/"),
                            "assignees__avatar_asset",
                            Value("/"),
                        ),
                    ),
                    # If `avatar_asset` is None, fall back to using `avatar` field directly
                    When(assignees__avatar_asset__isnull=True, then="assignees__avatar"),
                    default=Value(None),
                    output_field=models.CharField(),
                )
            )
            .values(
                "assignees__id",
                "assignees__first_name",
                "assignees__last_name",
                "assignees__display_name",
                "assignees__email",
                "avatar_url",
            )
            .annotate(
                total_issues=Count("id", distinct=True),
                completed_issues=Count(
                    "id",
                    filter=Q(state__group="completed"),
                    distinct=True,
                ),
                pending_issues=Count(
                    "id",
                    filter=~Q(state__group__in=["completed", "cancelled"]),
                    distinct=True,
                ),
                overdue_issues=Count(
                    "id",
                    filter=Q(
                        target_date__lt=timezone.now().date(),
                        state__group__in=["backlog", "unstarted", "started"],
                    ),
                    distinct=True,
                ),
            )
            .filter(assignees__id__isnull=False)
            .order_by("-total_issues")
        )

        # Pre-calculate average completion time for all members in one query to avoid N+1
        # Get all completed issues with completion time calculation
        completed_issues_with_time = (
            queryset.filter(
                state__group="completed",
                completed_at__isnull=False,
                created_at__isnull=False,
            )
            .annotate(
                completion_days=ExpressionWrapper(
                    Cast("completed_at", DateField()) - Cast("created_at", DateField()),
                    output_field=DurationField(),
                )
            )
            .values("assignees__id")
            .annotate(
                avg_completion_days=Avg("completion_days"),
                count=Count("id", distinct=True),
            )
        )

        # Create a dictionary for quick lookup
        avg_time_dict = {
            item["assignees__id"]: (
                item["avg_completion_days"].total_seconds() / 86400.0
                if item["avg_completion_days"] is not None
                else 0
            )
            for item in completed_issues_with_time
        }

        # Build result list
        result = []
        for member in member_stats:
            member_id = member["assignees__id"]
            total = member["total_issues"]
            completed = member["completed_issues"]

            # Calculate completion rate
            completion_rate = (completed / total * 100) if total > 0 else 0

            # Get average completion time from pre-calculated dict
            avg_completion_time = avg_time_dict.get(member_id, 0)

            result.append(
                {
                    "user_id": str(member_id),
                    "first_name": member.get("assignees__first_name", ""),
                    "last_name": member.get("assignees__last_name", ""),
                    "display_name": member.get("assignees__display_name", ""),
                    "email": member.get("assignees__email", ""),
                    "avatar_url": member.get("avatar_url", ""),
                    "total_issues": total,
                    "completed_issues": completed,
                    "pending_issues": member["pending_issues"],
                    "overdue_issues": member["overdue_issues"],
                    "completion_rate": round(completion_rate, 2),
                    "avg_completion_time": round(avg_completion_time, 2),
                }
            )

        return result

