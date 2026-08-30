from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


MAIN_REF = "refs/heads/main"


class OrchestrationError(ValueError):
    pass


def plan_release(
    *,
    event_name: str,
    ref: str,
    impact: dict[str, Any],
    auto_release_enabled: bool,
    base_ref: str = "",
    client_release_mode: str = "auto",
    deploy_worker_requested: bool = False,
    run_migrations_requested: bool = False,
    confirm_manual_release_scope: bool = False,
) -> dict[str, bool]:
    automatic_release = (
        event_name == "push"
        and ref == MAIN_REF
        and impact.get("client_release") is True
        and auto_release_enabled
    )
    manual_release = event_name == "workflow_dispatch" and client_release_mode == "release"

    if manual_release and ref != MAIN_REF:
        raise OrchestrationError("Manual Client publication is allowed only from main")
    if manual_release and not confirm_manual_release_scope:
        raise OrchestrationError(
            "Manual Client publication requires explicit release impact range confirmation"
        )
    if manual_release and not base_ref.strip():
        raise OrchestrationError("Manual Client publication requires an explicit base_ref")

    publish_client = automatic_release or manual_release
    deploy_worker = deploy_worker_requested or (
        publish_client and (impact.get("worker") is True or impact.get("db") is True)
    )
    run_migrations = run_migrations_requested or (
        deploy_worker and impact.get("db") is True
    )

    return {
        "publish_client": publish_client,
        "deploy_worker": deploy_worker,
        "run_migrations": run_migrations,
        "worker_readiness_required": publish_client and deploy_worker,
    }


def require_release_readiness(
    *,
    publish_client: bool,
    worker_readiness_required: bool,
    worker_result: str,
    production_ready: bool,
) -> None:
    if not publish_client:
        raise OrchestrationError("Client publication was not requested")
    if worker_readiness_required:
        if worker_result != "success" or not production_ready:
            raise OrchestrationError("Worker deployment/readiness did not succeed")
        return
    if worker_result not in {"success", "skipped"}:
        raise OrchestrationError("Worker validation failed during the release run")


def _bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"true", "1", "yes"}:
        return True
    if normalized in {"false", "0", "no", ""}:
        return False
    raise argparse.ArgumentTypeError(f"Expected a boolean value, got {value!r}")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Plan and enforce KeystoneSync release dependencies."
    )
    commands = parser.add_subparsers(dest="command", required=True)

    plan = commands.add_parser("plan")
    plan.add_argument("--impact-file", required=True, type=Path)
    plan.add_argument("--event-name", required=True)
    plan.add_argument("--ref", required=True)
    plan.add_argument("--auto-release-enabled", required=True, type=_bool)
    plan.add_argument("--base-ref", default="")
    plan.add_argument("--client-release-mode", default="auto")
    plan.add_argument("--deploy-worker-requested", default=False, type=_bool)
    plan.add_argument("--run-migrations-requested", default=False, type=_bool)
    plan.add_argument("--confirm-manual-release-scope", default=False, type=_bool)

    readiness = commands.add_parser("require-readiness")
    readiness.add_argument("--publish-client", required=True, type=_bool)
    readiness.add_argument("--worker-readiness-required", required=True, type=_bool)
    readiness.add_argument("--worker-result", required=True)
    readiness.add_argument("--production-ready", required=True, type=_bool)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "plan":
            impact = json.loads(args.impact_file.read_text(encoding="utf-8"))
            result = plan_release(
                event_name=args.event_name,
                ref=args.ref,
                impact=impact,
                auto_release_enabled=args.auto_release_enabled,
                base_ref=args.base_ref,
                client_release_mode=args.client_release_mode,
                deploy_worker_requested=args.deploy_worker_requested,
                run_migrations_requested=args.run_migrations_requested,
                confirm_manual_release_scope=args.confirm_manual_release_scope,
            )
            print(json.dumps(result, indent=2))
        else:
            require_release_readiness(
                publish_client=args.publish_client,
                worker_readiness_required=args.worker_readiness_required,
                worker_result=args.worker_result,
                production_ready=args.production_ready,
            )
    except (OSError, json.JSONDecodeError, OrchestrationError) as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
