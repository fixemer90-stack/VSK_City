# S01 — Frontend lint и существующие gates

Статус: Готово локально; включение в опубликованный Actions run проверяется S03.

## Контекст и работа

В package.json были test/typecheck/build, но не было отдельного lint.
Добавить ESLint flat config, совместимые точные dev dependencies и lockfile.
Правила должны ловить ошибки, не игнорировать весь существующий код; допустимые
исключения для тестовых doubles объясняются в конфигурации.
Не форматировать массово artwork/generated assets и не менять игровые правила ради линтера.

## Файлы

src/frontend/package.json, package-lock.json, eslint.config.mjs;
минимальные TS-исправления только по воспроизведённым lint findings.

## Приёмка

- [x] npm ci воспроизводится с lockfile.
- [x] npm run lint, npm run typecheck, npm test, npm run build реально прошли.
- [x] Проверен финальный diff: нет пользовательских SVG и изменений бизнес-поведения.

Точные eslint10.14.0 / @eslint/js10.0.1 / typescript-eslint8.72.1; Node22.22.2.
Родитель повторил все gates в свежем Docker build-stage с каноническим overlay:
26 PASS, 0 lint warnings, typecheck/build PASS. Код сохранён коммитом 37d7810.
Production npm audit --omit=dev: 0 vulnerabilities.
Существовавшие версии зависимостей не изменились; удалён unused импорт House и добавлено
точечное объяснённое исключение receiver test. Полный dev dependency audit не является
гарантией безопасности; есть известные находки, не устранённые этой Story.

Охват: 26 существующих frontend unit/component tests. Исполнительский результат
проверяет родитель перед публикацией; старый build E01 не заменяет свежие gates.
