#!/usr/bin/env python3
"""Generate explicitly synthetic CSV input; no game calculations or external IO."""

from __future__ import annotations

import argparse
import csv
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

Row = dict[str, str]
Tables = dict[str, list[Row]]

CITY_NAMES = (
    "Москва",
    "Санкт-Петербург",
    "Калининград",
    "Мурманск",
    "Архангельск",
    "Петрозаводск",
    "Псков",
    "Великий Новгород",
    "Тверь",
    "Ярославль",
    "Вологда",
    "Смоленск",
    "Брянск",
    "Калуга",
    "Тула",
    "Рязань",
    "Владимир",
    "Иваново",
    "Кострома",
    "Нижний Новгород",
    "Казань",
    "Самара",
    "Екатеринбург",
    "Новосибирск",
    "Владивосток",
    "Пермь",
    "Уфа",
    "Красноярск",
    "Иркутск",
    "Хабаровск",
)
FIRST_NAMES = (
    "Иван",
    "Алексей",
    "Дмитрий",
    "Михаил",
    "Андрей",
    "Павел",
    "Сергей",
    "Роман",
    "Антон",
    "Максим",
)
LAST_NAMES = ("Иванов", "Петров", "Соколов", "Морозов", "Волков")
PROFILES = (
    [("empty", 0, 0)] * 5
    + [("motor_only", 0, 13)] * 10
    + [("property_only", 4, 0)] * 10
    + [("mixed", 5, 23)] * 10
    + [("developed", 2, 40)] * 5
    + [("skyscraper", 1, 100)] * 3
    + [("overflow", 1, 123)]
    + [("large", 50, 120)]
    + [("property_termination", 3, 8)] * 3
    + [("motor_termination", 2, 12)] * 2
)
DATE_ZERO = datetime(2026, 1, 1, tzinfo=UTC)
SNAPSHOT_TIMES = {
    "initial": "2026-11-03T09:00:00Z",
    "terminated": "2026-11-05T09:00:00Z",
}


def stamp(value: datetime) -> str:
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def build_dataset(city_count: int, phase: str) -> Tables:
    tables: Tables = {
        name: []
        for name in (
            "cities",
            "channels",
            "agents",
            "products",
            "contracts",
            "scenarios",
        )
    }
    for code, name, category in (
        ("TEST-PROPERTY", "Тестовый имущественный продукт", "property"),
        ("TEST-MOTOR", "Тестовый моторный продукт", "motor"),
    ):
        tables["products"].append(
            {"productCode": code, "productName": name, "demoCategory": category}
        )
    for city_index, city_name in enumerate(CITY_NAMES[:city_count], 1):
        branch = f"TEST-BR-{city_index:03d}"
        tables["cities"].append(
            {
                "cityId": f"TEST-CITY-{city_index:03d}",
                "branchId": branch,
                "name": city_name,
            }
        )
        for channel in range(1, 4):
            tables["channels"].append(
                {
                    "channelId": f"{branch}-CH-{channel}",
                    "branchId": branch,
                    "name": f"Тестовый канал {channel}",
                }
            )
        for agent_index, (scenario, houses, motors) in enumerate(PROFILES, 1):
            agreement = f"TEST-AGD-{city_index:03d}-{agent_index:03d}"
            tables["agents"].append(
                {
                    "agentId": f"TEST-AGENT-{city_index:03d}-{agent_index:03d}",
                    "agencyAgreementNumber": agreement,
                    "firstName": FIRST_NAMES[(agent_index - 1) % len(FIRST_NAMES)],
                    "lastName": LAST_NAMES[(agent_index - 1) // len(FIRST_NAMES)],
                    "branchId": branch,
                    "channelId": f"{branch}-CH-{(agent_index - 1) % 3 + 1}",
                }
            )
            tables["scenarios"].append(
                {"agencyAgreementNumber": agreement, "scenario": scenario}
            )
            for position in range(houses + motors):
                property_contract = position < houses
                concluded = DATE_ZERO + timedelta(
                    days=(city_index * 7 + agent_index) % 90, minutes=position
                )
                terminated = phase == "terminated" and (
                    (scenario == "property_termination" and position == 0)
                    or (scenario == "motor_termination" and position == houses)
                )
                contract = f"{city_index:03d}-{agent_index:03d}-{position + 1:04d}"
                tables["contracts"].append(
                    {
                        "contractId": f"TEST-CONTRACT-{contract}",
                        "contractNumber": f"TEST-POLICY-{contract}",
                        "agencyAgreementNumber": agreement,
                        "productCode": "TEST-PROPERTY"
                        if property_contract
                        else "TEST-MOTOR",
                        "concludedAt": stamp(concluded),
                        "status": "terminated" if terminated else "active",
                        "terminatedAt": "2026-11-04T12:00:00Z" if terminated else "",
                        "sourceUpdatedAt": "2026-11-04T12:00:00Z"
                        if terminated
                        else stamp(concluded),
                        "sourceVersion": "2" if terminated else "1",
                    }
                )
    return tables


def write_dataset(
    output: Path, city_count: int, phase: str, overwrite: bool
) -> dict[str, object]:
    tables = build_dataset(city_count, phase)
    targets = [output / f"{name}.csv" for name in tables] + [output / "manifest.json"]
    if not overwrite and any(path.exists() for path in targets):
        raise FileExistsError(
            "Dataset files already exist; use --overwrite explicitly."
        )
    output.mkdir(parents=True, exist_ok=True)
    for name, rows in tables.items():
        with (output / f"{name}.csv").open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(
                stream, fieldnames=list(rows[0]), lineterminator="\n"
            )
            writer.writeheader()
            writer.writerows(rows)
    manifest: dict[str, object] = {
        "synthetic": True,
        "schemaVersion": "demo-draft-1",
        "phase": phase,
        "snapshotAt": SNAPSHOT_TIMES[phase],
        "demoDateZero": stamp(DATE_ZERO),
        "counts": {name: len(rows) for name, rows in tables.items()},
        "warning": "Вымышленные данные; не схема корпоративного источника и не оценка нагрузки.",
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cities", type=int, choices=range(20, 31), default=25)
    parser.add_argument(
        "--phase", choices=("initial", "terminated"), default="terminated"
    )
    parser.add_argument(
        "--overwrite", action="store_true", help="Replace only the named dataset files."
    )
    arguments = parser.parse_args()
    try:
        manifest = write_dataset(
            arguments.output, arguments.cities, arguments.phase, arguments.overwrite
        )
    except OSError as error:
        parser.exit(1, f"{error}\n")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
