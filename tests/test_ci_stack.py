"""Safety contracts for disposable CI; never connect to a running pitch stack."""

import os
import runpy
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.ci_stack import compose_command, configuration, environment


class CiStackTests(unittest.TestCase):
    def test_explicit_disposable_project_is_required(self) -> None:
        for value in (None, "vsk-pitch", "astrotype", "vsk-ci-", "vsk-ci-x;rm"):
            env = {} if value is None else {"CI_COMPOSE_PROJECT": value}
            with (
                self.subTest(project=value),
                patch.dict(os.environ, env, clear=True),
                self.assertRaises(ValueError),
            ):
                configuration()

    def test_demo_ports_are_forbidden(self) -> None:
        for key in ("CI_FRONTEND_PORT", "CI_BACKEND_PORT"):
            for port in ("5188", "5189", "0", "65536", "not-a-port"):
                with (
                    self.subTest(key=key, port=port),
                    patch.dict(
                        os.environ,
                        {"CI_COMPOSE_PROJECT": "vsk-ci-test-123", key: port},
                        clear=True,
                    ),
                    self.assertRaises(ValueError),
                ):
                    configuration()

    def test_identical_ports_are_forbidden(self) -> None:
        with (
            patch.dict(
                os.environ,
                {
                    "CI_COMPOSE_PROJECT": "vsk-ci-test-123",
                    "CI_FRONTEND_PORT": "5288",
                    "CI_BACKEND_PORT": "5288",
                },
                clear=True,
            ),
            self.assertRaises(ValueError),
        ):
            configuration()

    def test_environment_is_loopback_and_explicitly_disposable(self) -> None:
        with patch.dict(
            os.environ, {"CI_COMPOSE_PROJECT": "vsk-ci-test-123"}, clear=True
        ):
            values = environment(configuration())
            self.assertEqual(values["PITCH_BASE_URL"], "http://127.0.0.1:5288")
            self.assertEqual(values["PITCH_URL"], "http://127.0.0.1:5289")
            self.assertEqual(values["PITCH_ALLOW_MUTATIONS"], "1")

    def test_mutating_http_tests_refuse_before_network(self) -> None:
        base = {
            "CI_COMPOSE_PROJECT": "vsk-ci-test-123",
            "PITCH_ALLOW_MUTATIONS": "1",
            "PITCH_URL": "http://127.0.0.1:5289",
        }
        cases = [
            {},
            {"CI_COMPOSE_PROJECT": "vsk-ci-test-123", "PITCH_URL": base["PITCH_URL"]},
            {**base, "PITCH_ALLOW_MUTATIONS": "0"},
            {**base, "CI_COMPOSE_PROJECT": "vsk-pitch"},
            *[
                {**base, "PITCH_URL": url}
                for url in (
                    "http://127.0.0.1:5189",
                    "http://127.0.0.1:5288",
                    "http://remote.example:5289",
                    "https://127.0.0.1:5289",
                    "http://127.0.0.1:5289/",
                )
            ],
        ]
        for env in cases:
            with self.subTest(env=env), patch.dict(os.environ, env, clear=True):
                module = runpy.run_path(
                    str(Path(__file__).parent / "backend/test_http.py")
                )
                with (
                    patch("urllib.request.urlopen") as network,
                    self.assertRaises(ValueError),
                ):
                    module["action"]("reset")
                network.assert_not_called()

    def test_workflow_has_all_gates_and_failure_cleanup(self) -> None:
        workflow = Path(__file__).resolve().parents[1] / ".github/workflows/ci.yml"
        self.assertTrue(workflow.exists(), "Missing Actions quality gate workflow")
        text = workflow.read_text()
        for command in (
            "npm run lint",
            "npm run typecheck",
            "npm test",
            "npm run build",
            "ruff check",
            "mypy",
            "sprite-export-contract",
            "ci_stack.py down",
            "if: always()",
        ):
            self.assertIn(command, text)
        self.assertNotIn("pull_request_target", text)
        self.assertNotIn("secrets.", text)

    def test_compose_failure_keeps_the_diagnostic(self) -> None:
        from subprocess import CompletedProcess

        from scripts.ci_stack import run_compose

        with (
            patch.dict(
                os.environ, {"CI_COMPOSE_PROJECT": "vsk-ci-test-123"}, clear=True
            ),
            patch(
                "scripts.ci_stack.subprocess.run",
                return_value=CompletedProcess([], 1, "", "pull failed"),
            ),
            self.assertRaisesRegex(RuntimeError, "pull failed"),
        ):
            run_compose(["up"])

    def test_compose_never_selects_the_pitch_config(self) -> None:
        with patch.dict(
            os.environ, {"CI_COMPOSE_PROJECT": "vsk-ci-test-123"}, clear=True
        ):
            cmd = compose_command(
                configuration(), ["down", "--volumes", "--remove-orphans"]
            )
            self.assertEqual(cmd[:4], ["docker", "compose", "-p", "vsk-ci-test-123"])
            self.assertTrue(any(x.endswith("infra/ci.compose.yaml") for x in cmd))
            self.assertFalse(any("pitch.compose.yaml" in x for x in cmd))
            self.assertIn(os.devnull, cmd)


if __name__ == "__main__":
    unittest.main()
