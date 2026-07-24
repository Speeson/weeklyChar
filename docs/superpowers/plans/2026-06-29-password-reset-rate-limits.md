# Password Reset Rate Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect Resend quota by rate limiting password reset and verification resend email endpoints.

**Architecture:** Add a small in-memory rate limiter in `keystone-api/main.py`, keyed by client IP and normalized email/username. Apply it before sending emails while keeping generic responses to avoid account enumeration.

**Tech Stack:** FastAPI, Python standard library, existing Railway env vars.

---

### Task 1: Add Rate Limiter Tests/Validation

**Files:**
- Create: temporary inline Python validation script executed from shell.

- [ ] Verify current code lacks limiter symbols.
- [ ] Add limiter implementation.
- [ ] Verify limiter symbols and endpoint integration exist after patch.

### Task 2: Implement API Rate Limiter

**Files:**
- Modify: `keystone-api/main.py`

- [ ] Add env-configurable defaults: IP window/count, identity window/count, cooldown seconds.
- [ ] Add `_get_client_ip`, `_rate_limit_key`, `_check_rate_limit`, `_check_email_rate_limits` helpers.
- [ ] Inject `Request` into `/api/auth/forgot-password` and `/api/auth/resend-verification`.
- [ ] Call limiter before email send logic.

### Task 3: Document Configuration

**Files:**
- Modify: `README.md`

- [ ] Add rate limit environment variables to API configuration section.
- [ ] Explain defaults and that limits protect Resend quota.

### Task 4: Verify

**Files:**
- Existing project files.

- [ ] Run Python syntax check for `keystone-api/main.py`.
- [ ] Run structural validation for limiter symbols and endpoint integration.
- [ ] Check git diff and status.
