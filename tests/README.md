# Тестирование VSK City

Для локального синтетического E01 есть исполняемые проверки. Корпоративная интеграция,
реальная авторизация, промышленная нагрузка и production-приёмка ими не закрываются.

## Входные данные — 5 unittest

Из корня, Python 3.11+, без сторонних зависимостей:

```sh
python3 -m unittest discover -s tests -p 'test_demo_data.py' -v
```

Проверяются 20/25/30 городов, 50 агентов в каждом, ключи/ссылки/даты, два полных снимка,
повторяемость, защита перезаписи и побайтное совпадение с [готовыми CSV](../data/demo/README.md).
Это проверки входных данных, не движка.

## C# ядро — 18 assertions

```sh
docker build -f src/backend/Dockerfile --target test -t vsk-pitch-backend-tests:local .
docker run --rm --entrypoint dotnet -w /repo vsk-pitch-backend-tests:local run --project tests/backend/Vsk.Pitch.Tests.csproj -c Release --no-build
```

Это console assertion-runner, не xUnit/dotnet test. Ненулевой exit означает сбой.
Проверяются пороги, парковки, перераспределение, pending-сносы, сохранность опыта/участков,
идемпотентность, seed и privacy projection. Действующий сервер для этих assertions не нужен.

## Настоящий HTTP/runtime — 10 unittest

Нужен запущенный изолированный Compose vsk-pitch:

```sh
PITCH_URL=http://127.0.0.1:5189 python3 -m unittest discover -s tests/backend -p 'test_*.py' -v
```

Внимание: этот набор сбрасывает синтетический мир, перезапускает только pitch backend,
временно останавливает/поднимает только pitch Redis и двигает сохранённые demo-часы
в отдельной БД vsk_pitch для проверки фонового сноса. Не запускать во время питча
или параллельно с browser smoke. Volumes и исходные CSV не удаляются.

## Frontend — 26 unit/component проверок

Из src/frontend: `npm ci`, `npm test`, `npm run typecheck`, `npm run build`.
Для медленного WSL/NTFS можно использовать те же исходники внутри build-stage:

```sh
docker build -f src/frontend/Dockerfile --target build -t vsk-pitch-frontend-build:local .
docker run --rm --network none --entrypoint npm -w /app vsk-pitch-frontend-build:local run typecheck
docker run --rm --network none --entrypoint npm -w /app vsk-pitch-frontend-build:local test
```

Проверки охватывают стабильную геометрию и центральную площадь, transport receiver,
таймауты/отмену, pending/requestId и гонку GET/POST, захват/освобождение указателя.

## Настоящий браузер/API — 5 исторических сценариев E01 + 6 read-only проверок правил/карты/спрайтов

[Инструкция и ограничения](pitch-browser/README.md). Проверяются реальные маршруты,
прямые клики по Pixi-карте и доступная DOM-навигация, продажи/снос, роли, размеры desktop,
неподдерживаемый узкий экран и сохранность улицы/срока/ключа после настоящего рестарта.
Только отдельный error-state сценарий намеренно подменяет HTTP503; основной мир и действия
работают через настоящий backend. Нельзя направлять набор на чужое или рабочее окружение.

[Результаты, исправления и пределы проверки](../docs/reviews/E01-pitch-review.md).
Свежий визуальный срез: [карта и центры](../docs/reviews/MAP-CENTERS-review.md).
Новая шкала и парные пользовательские дома: [приёмка](../docs/reviews/TEN-TIERS-review.md).
Экспортёр отдельно: `node --test tests/scripts/sprite-export-contract.test.mjs` из корня,
один реальный Chromium сценарий, пишет PNG/manifest/catalog, но не состояние мира.
Будущие продуктовые проверки должны расширять охват по [правилам](../docs/GAME-RULES.md),
не подменять отсутствующие корпоративные гарантии удачным синтетическим демо.
