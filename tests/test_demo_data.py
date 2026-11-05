"""Executable checks for synthetic input, not for the unimplemented game engine."""

import csv
import json
import subprocess
import sys
import tempfile
import unittest
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "generate_demo_data.py"


class DemoDataTests(unittest.TestCase):
    def test_default_city_agent_counts_and_references(self):
        with tempfile.TemporaryDirectory(prefix="vsk-demo-test-") as directory:
            output = Path(directory) / "dataset"
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--output", str(output)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            manifest = json.loads((output / "manifest.json").read_text())
            self.assertTrue(manifest["synthetic"])
            tables = {}
            for name in (
                "cities",
                "channels",
                "agents",
                "products",
                "contracts",
                "scenarios",
            ):
                with (output / f"{name}.csv").open(
                    encoding="utf-8", newline=""
                ) as stream:
                    tables[name] = list(csv.DictReader(stream))
                self.assertEqual(manifest["counts"][name], len(tables[name]))
            self.assertEqual(len(tables["cities"]), 25)
            self.assertEqual(len(tables["agents"]), 1250)
            branches = {row["branchId"] for row in tables["cities"]}
            self.assertEqual(
                Counter(row["branchId"] for row in tables["agents"]),
                {branch: 50 for branch in branches},
            )
            agreements = {row["agencyAgreementNumber"] for row in tables["agents"]}
            self.assertEqual(len(agreements), 1250)
            products = {row["productCode"] for row in tables["products"]}
            channel_branches = {
                row["channelId"]: row["branchId"] for row in tables["channels"]
            }
            for row in tables["agents"]:
                self.assertEqual(channel_branches[row["channelId"]], row["branchId"])
            self.assertEqual(
                {row["agencyAgreementNumber"] for row in tables["scenarios"]},
                agreements,
            )
            identifiers = {row["contractId"] for row in tables["contracts"]}
            numbers = {row["contractNumber"] for row in tables["contracts"]}
            self.assertEqual(len(identifiers), len(tables["contracts"]))
            self.assertEqual(len(numbers), len(tables["contracts"]))
            for row in tables["contracts"]:
                self.assertIn(row["agencyAgreementNumber"], agreements)
                self.assertIn(row["productCode"], products)
                self.assertNotIn("branchId", row)
                self.assertIn(row["status"], {"active", "terminated"})
                concluded = datetime.fromisoformat(row["concludedAt"])
                updated = datetime.fromisoformat(row["sourceUpdatedAt"])
                self.assertGreaterEqual(
                    concluded, datetime.fromisoformat(manifest["demoDateZero"])
                )
                self.assertGreaterEqual(updated, concluded)
                self.assertLessEqual(
                    updated, datetime.fromisoformat(manifest["snapshotAt"])
                )
                self.assertEqual(
                    bool(row["terminatedAt"]), row["status"] == "terminated"
                )
                if row["terminatedAt"]:
                    self.assertEqual(
                        datetime.fromisoformat(row["terminatedAt"]), updated
                    )

    def test_configurable_complete_snapshots_are_repeatable(self):
        with tempfile.TemporaryDirectory(prefix="vsk-demo-test-") as directory:
            outputs = [
                Path(directory) / name for name in ("initial", "terminated", "repeat")
            ]
            for output, phase in zip(
                outputs, ("initial", "terminated", "terminated"), strict=True
            ):
                result = subprocess.run(
                    [
                        sys.executable,
                        str(SCRIPT),
                        "--output",
                        str(output),
                        "--cities",
                        "20",
                        "--phase",
                        phase,
                    ],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
            initial, changed, repeated = outputs
            self.assertEqual(
                {file.name: file.read_bytes() for file in changed.iterdir()},
                {file.name: file.read_bytes() for file in repeated.iterdir()},
            )

            def contracts(path):
                with (path / "contracts.csv").open(
                    encoding="utf-8", newline=""
                ) as stream:
                    return {row["contractId"]: row for row in csv.DictReader(stream)}

            before, after = contracts(initial), contracts(changed)
            self.assertEqual(before.keys(), after.keys())
            self.assertTrue(all(row["status"] == "active" for row in before.values()))
            terminations = [
                row for row in after.values() if row["status"] == "terminated"
            ]
            self.assertEqual(len(terminations), 100)
            for contract_id, row in after.items():
                for field in (
                    "contractNumber",
                    "agencyAgreementNumber",
                    "productCode",
                    "concludedAt",
                ):
                    self.assertEqual(row[field], before[contract_id][field])
            for row in terminations:
                self.assertEqual(row["sourceVersion"], "2")
                self.assertEqual(before[row["contractId"]]["sourceVersion"], "1")
            manifest = json.loads((changed / "manifest.json").read_text())
            self.assertEqual(manifest["counts"]["cities"], 20)
            self.assertEqual(manifest["counts"]["agents"], 1000)
            self.assertEqual(manifest["phase"], "terminated")

    def test_existing_data_requires_explicit_overwrite(self):
        with tempfile.TemporaryDirectory(prefix="vsk-demo-test-") as directory:
            output = Path(directory) / "existing"
            output.mkdir()
            target = output / "agents.csv"
            target.write_text("do not overwrite\n", encoding="utf-8")
            command = [sys.executable, str(SCRIPT), "--output", str(output)]
            result = subprocess.run(
                command, capture_output=True, text=True, check=False
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(target.read_text(), "do not overwrite\n")
            self.assertEqual({file.name for file in output.iterdir()}, {"agents.csv"})
            result = subprocess.run(
                command + ["--overwrite"], capture_output=True, text=True, check=False
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue(target.read_text().startswith("agentId,"))

    def test_city_limits_and_upper_boundary(self):
        with tempfile.TemporaryDirectory(prefix="vsk-demo-test-") as directory:
            output = Path(directory) / "dataset"
            for invalid in ("0", "19", "31", "abc"):
                result = subprocess.run(
                    [
                        sys.executable,
                        str(SCRIPT),
                        "--output",
                        str(output),
                        "--cities",
                        invalid,
                    ],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(output.exists())
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--output",
                    str(output),
                    "--cities",
                    "30",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            manifest = json.loads((output / "manifest.json").read_text())
            self.assertEqual(manifest["counts"]["agents"], 1500)
            self.assertEqual(manifest["counts"]["cities"], 30)

    def test_bundled_snapshots_match_generator(self):
        with tempfile.TemporaryDirectory(prefix="vsk-demo-test-") as directory:
            for phase in ("initial", "terminated"):
                output = Path(directory) / phase
                result = subprocess.run(
                    [
                        sys.executable,
                        str(SCRIPT),
                        "--output",
                        str(output),
                        "--phase",
                        phase,
                    ],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                bundled = ROOT / "data" / "demo" / phase
                self.assertEqual(
                    {file.name: file.read_bytes() for file in bundled.iterdir()},
                    {file.name: file.read_bytes() for file in output.iterdir()},
                )


if __name__ == "__main__":
    unittest.main()
