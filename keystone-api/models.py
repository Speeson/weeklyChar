import secrets
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    sync_token = Column(String(64), unique=True, nullable=False, default=lambda: secrets.token_hex(32))
    avatar_url = Column(String(512), nullable=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(150), nullable=True)
    email = Column(String(255), unique=True, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    email_verified = Column(Boolean, default=True, nullable=False)
    email_verification_token_hash = Column(String(64), nullable=True)
    email_verification_expires_at = Column(DateTime, nullable=True)
    password_reset_token_hash = Column(String(64), nullable=True)
    password_reset_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    characters = relationship("Character", back_populates="user")
    teams_created = relationship("Team", back_populates="creator")
    team_memberships = relationship("TeamMember", back_populates="user")
    team_invitations_received = relationship("TeamInvitation", foreign_keys="TeamInvitation.invited_user_id", back_populates="invited_user")
    team_invitations_sent = relationship("TeamInvitation", foreign_keys="TeamInvitation.invited_by_user_id", back_populates="invited_by")


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    invite_code = Column(String(16), unique=True, nullable=False, default=lambda: secrets.token_hex(8))
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    creator = relationship("User", back_populates="teams_created")
    members = relationship("TeamMember", back_populates="team")
    invitations = relationship("TeamInvitation", back_populates="team")


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")

    __table_args__ = (UniqueConstraint("team_id", "user_id"),)


class TeamInvitation(Base):
    __tablename__ = "team_invitations"

    id = Column(Integer, primary_key=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    invited_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invited_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=False)
    responded_at = Column(DateTime, nullable=True)

    team = relationship("Team", back_populates="invitations")
    invited_user = relationship("User", foreign_keys=[invited_user_id], back_populates="team_invitations_received")
    invited_by = relationship("User", foreign_keys=[invited_by_user_id], back_populates="team_invitations_sent")


class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    realm = Column(String(100), nullable=False)
    region = Column(String(10), nullable=False, default="eu")
    avatar_url = Column(String(512), nullable=True)
    wow_account = Column(String(100), nullable=True)
    rio_score = Column(Float, nullable=True)
    wow_class = Column(String(50), nullable=True)
    ilvl = Column(Integer, nullable=True)
    vault_json = Column(Text, nullable=True)
    prey_hunts_json = Column(Text, nullable=True)
    currencies_json = Column(Text, nullable=True)
    money_json = Column(Text, nullable=True)
    mythic_plus_season_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="characters")
    keystones = relationship("Keystone", back_populates="character", order_by="Keystone.id")

    __table_args__ = (UniqueConstraint("user_id", "name", "realm", "region"),)


class Keystone(Base):
    __tablename__ = "keystones"

    id = Column(Integer, primary_key=True)
    character_id = Column(Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    has_keystone = Column(Boolean, default=False)
    keystone_level = Column(Integer, nullable=True)
    keystone_challenge_map_id = Column(Integer, nullable=True)
    keystone_map_id = Column(Integer, nullable=True)
    keystone_dungeon = Column(String(200), nullable=True)
    updated_reason = Column(String(100), nullable=True)
    updated_at = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    character = relationship("Character", back_populates="keystones")
