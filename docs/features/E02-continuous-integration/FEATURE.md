# E02 — Автоматические проверки GitHub Actions

Статус: В процессе. Это инфраструктура качества существующего синтетического прототипа,
не реализация корпоративного backend или согласование внешнего контракта.

## Цель и границы

На push main, pull request и ручном запуске автоматически проверять frontend, C#,
Python, настоящую генерацию спрайтов и работающий HTTP/browser сценарий.
Не использовать действующий vsk-pitch, его порты, теги образов или volumes для тестов.
Пользовательские незакоммиченные SVG не подмешиваются в публикацию CI.

[Runbook и ограничения](../../CI.md). Исходные требования: [корпоративные ограничения](../../architecture/CORPORATE-REQUIREMENTS.md).

## Stories

| ID | Результат | Статус |
| --- | --- | --- |
| [S01](S01-frontend-lint.md) | Воспроизводимый frontend lint вместе с typecheck/tests/build | Готово локально; публикация проверяется S03 |
| [S02](S02-isolated-runtime.md) | Защищённое временное окружение для HTTP/persistence/browser | Готово локально; независимое ревью PASS |
| [S03](S03-actions.md) | Workflow, публикация и подтверждённый реальный Actions run | В процессе |

Порядок: S01 и S02 независимы; S03 объединяет их. Закрытие Feature требует всех Stories.

## Приёмка

- [x] Frontend lint, Angular typecheck, unit tests и production build реально проходят.
- [x] Python Ruff/format, strict mypy и fixture/safety tests проходят локально.
- [x] Backend build с warnings-as-errors и 18 assertions проходят локально.
- [x] Реальный exporter проходит, 37 generated PNG/manifest/catalog артефактов совпадают с коммитом.
- [x] 10 HTTP/persistence и 12 browser cases проходят в временном CI-стенде.
- [x] CI не меняет operator-world: сохранён полный raw PG hash/ID контейнеров до/после.
- [x] CI cleanup удаляет только собственные project-scoped ресурсы; guard tests проходят.
- [x] Независимое ревью CI isolation и owning verification frontend завершены.
- [ ] Workflow опубликован, все jobs реального Actions run текущего кода завершились success.

Локальные доказательства — результаты команд, а не утверждение, что Actions уже запущен.
Неподдерживаемые условия/права PAT не превращаются в фиктивную успешную публикацию.
