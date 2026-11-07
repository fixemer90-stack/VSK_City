# CI: автоматические проверки VSK City

Конфигурация: [.github/workflows/ci.yml](../.github/workflows/ci.yml).
Внедрение и фактический статус: [E02](features/E02-continuous-integration/FEATURE.md).
Наличие файла не доказывает прохождения Actions: проверять run для точного commit SHA.

## Запуски и gates

Push в main, pull request и workflow_dispatch. Четыре независимых jobs, затем integration:

| Job | Проверки |
| --- | --- |
| frontend | npm ci; ESLint; Angular typecheck; 26 unit/component tests; production build |
| backend | dotnet build с warnings-as-errors; console runner с 18 assertions |
| python | Ruff lint/format; strict mypy двух typed helpers; 5 fixture + 8 CI safety tests |
| assets | Настоящий Chromium export: 2 контракта; побайтное совпадение 35 PNG и manifest/catalog с Git; 2 browser guard contracts (7 отказов/2 допуска до network sentinel) |
| integration | Собственная PostgreSQL/Redis/API/frontend среда; 10 HTTP/persistence tests; все 12 Playwright cases |

Backend console runner — не dotnet test. Frontend не получает фиктивный backend:
браузер работает с настоящим API; отдельный известный HTTP503 test проверяет только error UI.

Dependencies фиксируются lockfiles/requirements-ci; действия GitHub закреплены SHA.
Workflow не использует персональные PAT/secrets, не публикует images и не развёртывает production.
GITHUB_TOKEN имеет только contents:read; pull_request_target не используется.
Для первоначального push изменения workflow личному PAT требуется право Workflows:write.
Для запуска уже установленного workflow персональный PAT не передаётся в jobs.

## Изоляция

- Project — уникальный vsk-ci-<run-id>-<attempt>; локально — собственный случайный suffix.
- Порты только loopback, по умолчанию 5288/5289; helper запрещает 5188/5189 и одинаковые порты.
- У PostgreSQL отдельный project-scoped volume; у образов теги CI project, не vsk-pitch-*:local.
- Нет fixed container_name, общих named volumes и загрузки операторского .env.
- Mutating tests требуют PITCH_ALLOW_MUTATIONS=1, правильный project и согласованный URL;
  обычный default localhost5188/5189 не допускается для продаж/reset/restart в этих suites.
- Docker restart/Redis loss обращаются к сервисам выбранного CI Compose, не именам vsk-pitch.
- Cleanup down --volumes разрешён здесь только для собственного disposable CI project.
  Это не инструкция удалять volumes работающего стенда.

## Безопасный локальный прогон

При грязном рабочем дереве сначала сделать отдельный git archive snapshot и наложить
только проверяемые CI/code изменения. Не временно откатывать и не включать несвязанные SVG.
Команды ниже выполняются из корня такого снимка с установленными test dependencies:

```sh
export CI_COMPOSE_PROJECT="vsk-ci-local-$(python3 -c 'import uuid; print(uuid.uuid4().hex[:10])')"
export CI_FRONTEND_PORT=5288 CI_BACKEND_PORT=5289
export PITCH_BASE_URL=http://127.0.0.1:5288 PITCH_URL=http://127.0.0.1:5289
export PITCH_ALLOW_MUTATIONS=1
trap 'python3 scripts/ci_stack.py down' EXIT
python3 scripts/ci_stack.py config
python3 scripts/ci_stack.py up
python3 -m unittest discover -s tests/backend -p 'test_*.py' -v
(cd tests/pitch-browser && PITCH_TEST_OUTPUT=../../test-results/ci-browser npx playwright test --reporter=line)
```

После завершения удалить только этот CI project через helper и unset экспортированные CI/PITCH
переменные, чтобы последующие команды не наследовали уже удалённый стенд.
Не запускать параллельные mutating suites на одной временной БД.
Read-only визуальные specs по-прежнему можно запускать отдельно на используемом питче;
полный npm test включает изменяющие мир сценарии и требует CI isolation.

## Ошибки и пределы

Сначала смотреть конкретный failed job/step и его terminal traceback, не слово error в логах
ожидаемых негативных тестов. При неуспешном integration сохраняются service logs и browser
screenshots/traces; cleanup выполняется через always(). Артефакты хранятся 7 дней.
Принудительное прекращение runner может оборвать cleanup; изолированные project names
не позволяют этому повредить операторский мир, GitHub-hosted runner остаётся временным.

Actions success не доказывает корпоративную авторизацию, реальные входные данные,
полную безопасность зависимостей. При внедрении production npm audit показал 0, но полный
dev-inclusive audit — 25 moderate и 5 high. Они не скрыты и не исправлялись принудительным
обновлением framework ради этого CI; отдельный security-audit gate пока не включён.
Actions success также не доказывает
политику исправлений, production backup/restore или нагрузочный SLA. Эти требования
остаются в [MVP-SCOPE](MVP-SCOPE.md), [SRS](SRS/README.md) и будущих Features.
Подключение branch protection/required checks — отдельная настройка репозитория,
наличие workflow само по себе её не включает.
