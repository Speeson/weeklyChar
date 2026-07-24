# Team Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let team members share invite code and invite existing users by username with pending notifications.

**Architecture:** Add persistent `TeamInvitation` records in the API, expose pending invitation endpoints, and render a notification bell plus invite modal in the web UI. This is API + web only; no client/addon release.

**Tech Stack:** FastAPI, SQLAlchemy, Next.js/React, Tailwind.

---

### Task 1: API invitation model and endpoints

**Files:**
- Modify: `keystone-api/models.py`
- Modify: `keystone-api/main.py`

- [ ] Add `TeamInvitation` model with pending/accepted/declined status and expiration.
- [ ] Add schema `CreateTeamInviteRequest`.
- [ ] Add migration helper entries for the new table.
- [ ] Add endpoints to create, list, accept, and decline invitations.
- [ ] Prevent self-invites, duplicate pending invites, inviting existing team members, and expired accepts.

### Task 2: Web notification bell

**Files:**
- Modify: `keystone-web/app/components/Navbar.tsx`

- [ ] Fetch `/api/me/team-invitations` when logged in.
- [ ] Render bell between download button and avatar.
- [ ] Show pending count badge.
- [ ] Dropdown lists invitations.
- [ ] Click opens accept/decline modal.

### Task 3: Team invite popup

**Files:**
- Modify: `keystone-web/app/teams/[id]/page.tsx`
- Modify: `keystone-web/app/teams/page.tsx`

- [ ] Show invite code to all members where currently hidden from non-owners.
- [ ] Add `Invitar` button in team detail header.
- [ ] Modal includes copy-code and username invite form.
- [ ] Update team list so invite code display is not owner-only if shown there.

### Task 4: Docs and verification

**Files:**
- Modify: `README.md`

- [ ] Document team invitations.
- [ ] Run Python syntax check.
- [ ] Run Next lint/build or type check if available.
- [ ] Review git diff.
