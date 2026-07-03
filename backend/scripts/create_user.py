#!/usr/bin/env python3
"""Server-side CLI tool to create users directly in the database.

Run this on the server (Raspberry Pi) inside the backend container:
  docker exec infra-backend-1 python /app/scripts/create_user.py <email> <password> [--admin]

Or from the host via docker compose:
  docker compose -f infra/docker-compose.yml exec backend python /app/scripts/create_user.py <email> <password>

Example:
  sudo docker exec infra-backend-1 python /app/scripts/create_user.py newuser@example.com StrongPass123!
  sudo docker exec infra-backend-1 python /app/scripts/create_user.py admin@example.com AdminPass123! --admin
"""

import argparse
import asyncio
import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def create_user(email: str, password: str, is_admin: bool = False) -> None:
    """Create a user directly in the database."""
    from app.core.database import async_session_factory
    from app.core.security import hash_password
    from app.models.user import User
    from sqlalchemy import select

    async with async_session_factory() as db:
        # Check if user exists
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"✗ User '{email}' already exists (ID={existing.id}, role={existing.role})")
            sys.exit(1)

        # Create user
        user = User(
            email=email,
            password_hash=hash_password(password),
            role="admin" if is_admin else "user",
            email_verified=True,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

        await db.commit()

        print(f"✓ User created successfully!")
        print(f"  ID:    {user.id}")
        print(f"  Email: {user.email}")
        print(f"  Role:  {user.role}")
        print(f"  Verified: Yes")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create a user directly in the FoodReco database (server-side only)."
    )
    parser.add_argument("email", help="User email address")
    parser.add_argument("password", help="User password (min 8 characters)")
    parser.add_argument(
        "--admin",
        action="store_true",
        help="Give the user admin role",
    )

    args = parser.parse_args()

    if len(args.password) < 8:
        print("✗ Password must be at least 8 characters")
        sys.exit(1)

    asyncio.run(create_user(args.email, args.password, args.admin))


if __name__ == "__main__":
    main()