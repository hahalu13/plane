# Django imports
from typing import Any
from django.core.management.base import BaseCommand, CommandError

# Module imports
from plane.db.models import User, Profile, Workspace, WorkspaceMember
import uuid


class Command(BaseCommand):
    help = "Create multiple users in bulk"

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=10,
            help="Number of users to create (default: 10)",
        )
        parser.add_argument(
            "--email-prefix",
            type=str,
            default="user",
            help="Email prefix for users (default: 'user')",
        )
        parser.add_argument(
            "--email-domain",
            type=str,
            default="example.com",
            help="Email domain for users (default: 'example.com')",
        )
        parser.add_argument(
            "--password",
            type=str,
            default="password123",
            help="Password for all users (default: 'password123')",
        )
        parser.add_argument(
            "--first-name-prefix",
            type=str,
            default="User",
            help="First name prefix (default: 'User')",
        )
        parser.add_argument(
            "--last-name-prefix",
            type=str,
            default="",
            help="Last name prefix (default: empty)",
        )
        parser.add_argument(
            "--workspace-slug",
            type=str,
            default="test",
            help="Workspace slug to add users to (default: 'test')",
        )
        parser.add_argument(
            "--add-to-workspace",
            action="store_true",
            help="Add created users to the specified workspace",
        )

    def handle(self, *args: Any, **options: Any) -> str | None:
        try:
            count = options.get("count", 10)
            email_prefix = options.get("email_prefix", "user")
            email_domain = options.get("email_domain", "example.com")
            password = options.get("password", "password123")
            first_name_prefix = options.get("first_name_prefix", "User")
            last_name_prefix = options.get("last_name_prefix", "")

            if count <= 0:
                raise CommandError("Count must be greater than 0")

            workspace_slug = options.get("workspace_slug", "test")
            add_to_workspace = options.get("add_to_workspace", False)

            # Get or create workspace if needed
            workspace = None
            if add_to_workspace:
                workspace = Workspace.objects.filter(slug=workspace_slug).first()
                if not workspace:
                    # Try to find an existing user to be the owner
                    owner = User.objects.filter(is_active=True).first()
                    if not owner:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Workspace '{workspace_slug}' not found and no active user to be owner. "
                                f"Users will be created but not added to workspace."
                            )
                        )
                        add_to_workspace = False
                    else:
                        workspace = Workspace.objects.create(
                            slug=workspace_slug,
                            name=workspace_slug.capitalize(),
                            owner=owner,
                        )
                        # Add owner as workspace member
                        WorkspaceMember.objects.get_or_create(
                            workspace=workspace,
                            member=owner,
                            defaults={"role": 20, "is_active": True},
                        )
                        self.stdout.write(
                            self.style.SUCCESS(f"Created workspace: {workspace_slug}")
                        )

            self.stdout.write(f"Creating {count} users...")
            if add_to_workspace and workspace:
                self.stdout.write(f"Users will be added to workspace: {workspace_slug}")

            created_count = 0
            skipped_count = 0
            added_to_workspace_count = 0

            for i in range(1, count + 1):
                # Generate email
                email = f"{email_prefix}{i}@{email_domain}"

                # Check if user already exists
                if User.objects.filter(email=email).exists():
                    self.stdout.write(
                        self.style.WARNING(f"User with email {email} already exists. Skipping...")
                    )
                    skipped_count += 1
                    continue

                # Generate username (unique)
                username = f"{email_prefix}{i}_{uuid.uuid4().hex[:8]}"

                # Generate first and last name
                first_name = f"{first_name_prefix} {i}" if first_name_prefix else f"User {i}"
                last_name = f"{last_name_prefix} {i}" if last_name_prefix else ""

                # Create user
                user = User.objects.create(
                    email=email,
                    username=username,
                    first_name=first_name,
                    last_name=last_name,
                    display_name=f"{first_name} {last_name}".strip() or email.split("@")[0],
                    is_active=True,
                    is_email_verified=True,
                )

                # Set password
                user.set_password(password)
                user.save()

                # Create profile for the user
                Profile.objects.create(user=user)

                # Add user to workspace if requested
                if add_to_workspace and workspace:
                    workspace_member, created = WorkspaceMember.objects.get_or_create(
                        workspace=workspace,
                        member=user,
                        defaults={"role": 20, "is_active": True},
                    )
                    if created:
                        added_to_workspace_count += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"Created user: {email} (Username: {username}) - Added to workspace"
                            )
                        )
                    else:
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"Created user: {email} (Username: {username}) - Already in workspace"
                            )
                        )
                else:
                    self.stdout.write(
                        self.style.SUCCESS(f"Created user: {email} (Username: {username})")
                    )

                created_count += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"\nSuccessfully created {created_count} users. "
                    f"Skipped {skipped_count} existing users."
                )
            )
            if add_to_workspace and workspace:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Added {added_to_workspace_count} users to workspace: {workspace_slug}"
                    )
                )
            self.stdout.write(
                self.style.WARNING(
                    f"\nAll users have the password: {password}\n"
                    f"Please change passwords after first login for security."
                )
            )

        except Exception as e:
            raise CommandError(f"Failed to create users: {str(e)}")

