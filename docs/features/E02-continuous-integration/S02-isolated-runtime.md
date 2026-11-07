# S02 — Изолированный runtime для проверок

Статус: Готово локально; независимое ревью пройдено. Remote run проверяется S03.

## Работа и файлы

infra/ci.compose.yaml: отдельные project-scoped volumes/образы, loopback5288/5289,
без fixed container names и без общих тегов vsk-pitch.
scripts/ci_stack.py: явный CI_COMPOSE_PROJECT=vsk-ci-<id>, запрет 5188/5189,
без чтения операторского .env, команды только для disposable конфигурации.
tests/test_ci_stack.py: guard/diagnostic contracts.
HTTP/persistence/pitch browser tests: явный opt-in и правильный target;
restart/Redis operations используют сервисы текущего CI project, не hardcoded vsk-pitch.

## Приёмка

- [x] TDD: отсутствие helper, незащищённый POST и потеря диагностики дали ожидаемые RED;
      после реализации 8 safety tests проходят.
- [x] Настоящий docker compose config подтверждает изолированные имена volumes.
- [x] Полные 10 HTTP/persistence tests прошли с Redis outage, restart и worker-сносом.
- [x] Все 12 Playwright cases прошли против временного приложения.
- [x] Исправлены устаревшие ожидания E01 по rulesVersion и этажам 0/3 XP,
      без изменения production-расчёта или ослабления проверки формы ответа.
- [x] Временные контейнеры/volumes удалены; все operator container IDs сохранены,
      raw state до/после побайтно одинаков, version1519.
- [x] Независимое safety/logic review завершено без блокирующих замечаний.
      [Ревью и follow-through](../../reviews/CI-review.md): guard-матрица закреплена
      Python subtests и двумя Node contracts настоящего browser beforeAll.

Полный exporter/build для локальной проверки выполнялся в git archive snapshot
с наложением только CI-правок, не с незакоммиченными SVG пользователя.
На GitHub checkout сам обеспечивает committed-only контекст.
