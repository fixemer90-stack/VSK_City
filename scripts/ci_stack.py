#!/usr/bin/env python3
"""Operate only disposable, loopback CI stacks; never the operator's vsk-pitch."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICES = {"backend", "frontend", "postgres", "redis"}


@dataclass(frozen=True)
class Configuration:
    project: str
    frontend_port: int
    backend_port: int


def configuration() -> Configuration:
    project = os.environ.get("CI_COMPOSE_PROJECT", "")
    if not re.fullmatch(r"vsk-ci-[a-z0-9][a-z0-9-]{1,60}", project):
        raise ValueError(
            "Set an explicit disposable CI_COMPOSE_PROJECT=vsk-ci-<run-id>"
        )
    ports = [
        int(os.environ.get(key, default))
        for key, default in (("CI_FRONTEND_PORT", "5288"), ("CI_BACKEND_PORT", "5289"))
    ]
    if (
        any(p < 1024 or p > 65535 or p in (5188, 5189) for p in ports)
        or ports[0] == ports[1]
    ):
        raise ValueError("CI ports must be distinct, unprivileged and never 5188/5189")
    return Configuration(project, ports[0], ports[1])


def environment(config: Configuration) -> dict[str, str]:
    return {
        "CI_COMPOSE_PROJECT": config.project,
        "CI_FRONTEND_PORT": str(config.frontend_port),
        "CI_BACKEND_PORT": str(config.backend_port),
        "PITCH_BASE_URL": f"http://127.0.0.1:{config.frontend_port}",
        "PITCH_URL": f"http://127.0.0.1:{config.backend_port}",
        "PITCH_ALLOW_MUTATIONS": "1",
    }


def compose_command(config: Configuration, args: list[str]) -> list[str]:
    return [
        "docker",
        "compose",
        "-p",
        config.project,
        "--env-file",
        os.devnull,
        "-f",
        str(ROOT / "infra/ci.compose.yaml"),
        *args,
    ]


def run_compose(args: list[str]) -> str:
    config = configuration()
    result = subprocess.run(
        compose_command(config, args),
        cwd=ROOT,
        env={**os.environ, **environment(config)},
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(
            f"Disposable Compose failed ({result.returncode}):\n{result.stdout}\n{result.stderr}"
        )
    return result.stdout.strip()


def require_mutation_target(url: str, frontend: bool = False) -> Configuration:
    config = configuration()
    expected = environment(config)["PITCH_BASE_URL" if frontend else "PITCH_URL"]
    if os.environ.get("PITCH_ALLOW_MUTATIONS") != "1" or url != expected:
        raise ValueError(
            "Mutating tests require the explicit disposable CI target and opt-in"
        )
    return config


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command", choices=("env", "config", "up", "down", "logs", "restart", "exec")
    )
    parser.add_argument("arguments", nargs="*")
    parser.add_argument("--json", action="store_true")
    options = parser.parse_args()
    config = configuration()
    if options.command == "env":
        values = environment(config)
        print(
            json.dumps(values)
            if options.json
            else "\n".join(f"{k}={v}" for k, v in values.items())
        )
        return
    args: list[str]
    if options.command == "up":
        args = ["up", "-d", "--build", "--wait", "--wait-timeout", "180"]
    elif options.command == "down":
        args = ["down", "--volumes", "--remove-orphans"]
    elif options.command == "logs":
        args = ["logs", "--no-color", "--tail", "200"]
    elif options.command == "config":
        args = ["config", "--format", "json"]
    else:
        if not options.arguments or options.arguments[0] not in SERVICES:
            parser.error("restart/exec require a known CI service")
        args = (
            ["restart", options.arguments[0]]
            if options.command == "restart"
            else ["exec", "-T", *options.arguments]
        )
    print(run_compose(args))


if __name__ == "__main__":
    main()
