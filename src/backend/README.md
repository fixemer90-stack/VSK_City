# Backend — изолированный питч S01

Рабочий ASP.NET Core / C# `net10.0` прототип на синтетических CSV, не корпоративный MVP.
`DEMO_MODE=pitch` обязателен. Выбор `agentId`/`role` — **не аутентификация**:
запускать только на localhost, не загружать персональные/корпоративные данные и не
публиковать порты наружу. Директор наблюдает; ему разрешены только демо-часы и reset.

## Запуск из корня репозитория

Нужен Docker с Compose. Локальный .NET SDK не требуется.

```sh
docker compose -f infra/pitch.compose.yaml config --quiet
docker build -f src/backend/Dockerfile --target test -t vsk-pitch-backend-tests:local .
docker compose -f infra/pitch.compose.yaml build backend frontend
docker compose -f infra/pitch.compose.yaml up -d --wait
curl http://127.0.0.1:5189/health
```

Frontend: `http://127.0.0.1:5188`; backend: `http://127.0.0.1:5189`.
Проект Compose — `vsk-pitch`; PostgreSQL/Redis без опубликованных host-портов.
Отдельные volumes: `vsk-pitch-postgres-data`, `vsk-pitch-redis-data`.
Не использовать `down -v`: удаление volumes не нужно ни для запуска, ни для reset.
Остановка только этого прототипа: `docker compose -f infra/pitch.compose.yaml stop`.

Переопределения: безопасный пример `infra/pitch.env.example`; при необходимости
передайте `--env-file <путь-к-локальному-env>` перед `-f`. Тестовый пароль не является
корпоративным секретом. Уже созданный PostgreSQL volume не меняет пароль от изменения env.

## Проверки (реальные, не имитация)

```sh
# Компиляция с warnings-as-errors и 18 C# проверок ядра/seed/privacy/idempotency:
docker build -f src/backend/Dockerfile --target test -t vsk-pitch-backend-tests:local .
# Альтернатива без сборки тестового образа:
docker run --rm -v "$PWD:/repo" -v vsk-pitch-nuget:/root/.nuget/packages -w /repo \
  mcr.microsoft.com/dotnet/sdk:10.0 dotnet run --project tests/backend/Vsk.Pitch.Tests.csproj
# 7 HTTP integration tests; сервисы должны работать:
python3 tests/backend/test_http.py
# 3 persistence/runtime проверки: restart, потеря Redis, фоновый снос:
python3 tests/backend/test_persistence.py
```

C# tests — простой исполняемый assertion-runner с ненулевым exit при ошибке, а не
xUnit/`dotnet test`; не требует дополнительного тестового фреймворка. HTTP-тесты
используют Python stdlib. Они **явно сбрасывают только тестовый мир**; не запускать их
параллельно с презентацией. Persistence suite временно останавливает/запускает только
`vsk-pitch-redis-1`, перезапускает только `vsk-pitch-backend-1`, изменяет demo-смещение
только строки `pitch_world` в `vsk_pitch` для проверки worker без GET и затем reset.
Другие проекты, базы, CSV и volumes не затрагиваются.

Историческая приёмка исходного E01 в Docker: 17 C# assertions, 7 HTTP tests, 3 persistence tests прошли.
В TDD наблюдались красные проверки до реализации имущества, мотора, парковок,
расторжений, сноса, seed, privacy, идемпотентности и HTTP persistence.

## Контракт API

Полный формат: [FEATURE](../../docs/features/E01-pitch-prototype/FEATURE.md).

- `GET /health`: реальные `SELECT 1` PostgreSQL и Redis `PING`; HTTP 503 при отказе,
  поля `status`, `postgres`, `redis`.
- `GET /api/demo/state?agentId=TEST-AGENT-001-044&role=agent`.
- `POST /api/demo/actions` с тем же query и JSON
  `{"agentId":"TEST-AGENT-001-044","type":"motor","requestId":"unique-key"}`.
- Типы: `property`, `motor`, `terminate-property`, `terminate-motor`, `advance-day`, `reset`.
- По умолчанию viewer `TEST-AGENT-001-044`, роль `agent`. Другие имена улиц — null;
  директор раскрывает только свой город. В ответ не попадают внутренние справочники/ключи.
- Все ответы state camelCase; время UTC ISO 8601. Ошибки содержат JSON `message`.
- `requestId`: 1..128 ASCII букв/цифр либо `- _ . :`; повтор идентичного действия не
  меняет мир, повтор ключа с другим действием даёт 409. Receipts сохраняются даже при reset,
  поэтому повтор старого reset не уничтожит новые продажи. Версия монотонна и при reset.

## Хранение и алгоритм

`pitch_world(id=1,state JSONB)` — единственный источник истины. Схема/первичная запись
создаются при старте под транзакционным advisory lock; обычные запросы и worker —
`SELECT ... FOR UPDATE` → изменение → UPDATE → COMMIT. Мир не пересоздаётся при GET
или рестарте. Из памяти не берутся бизнес-состояние, сроки, demo-смещение или receipts.
Инициализация не перезаписывает существующую строку. Разрешено только имя БД `vsk_pitch`.
Reset заменяет содержимое только этой строки, не выполняет DROP/TRUNCATE/удаление файлов.

Initial CSV читаются с quoted CSV parser, продукты берутся из synthetic products.csv;
город выводится через branch агента, **не договора**. Порядок: `concludedAt`, `contractId`.
Проверяется исходный объём: 25 городов × 50 улиц, 4175 имущественных и 28775 моторных.
Это seed, а не универсальный импорт снапшотов/корпоративный маппинг продуктов.

Стабильный выбор домов — ordinal ID; у минимального XP при начислении/имущественной
терминации, максимального XP при моторной терминации (включая pending). Парковка
заполняется по возрастанию ID, снимается с наибольшего ID; модуль максимум 10 мест.
Идентификаторы объектов сохраняются; счётчик не переиспользует удалённые ID.
Новые объекты занимают первый свободный lotIndex своей улицы. Новый дом переносит
до 100 парковочного XP, не меняя существующие дома. Pending держит XP/лот и не получает
новый XP. Срок равен первому успешному применению +24 часа; GET и периодический
BackgroundService завершают due снос транзакционно. Advance-day меняет сохранённое
смещение, не системные часы. Карта — фиксированные стилизованные координаты 0..100.

Redis хранит только `pitch:world:version` (TTL 600 секунд, монотонное Lua обновление),
восстанавливаемый из PostgreSQL при запросе/worker. Отказ Redis даёт unhealthy health,
но не теряет/отменяет успешно сохранённую продажу. Приложение не возвращает ложную
ошибку после PostgreSQL commit только из-за недоступного version-cache.

### Обновление на 10 ступеней без миграции мира

Пороги XP: `0/11/22/33/44/56/67/78/89/100`, этажность: `1/3/4/5/6/9/12/14/17/25`.
Формула — округление `i × 100 / 9` до ближайшего целого для `i = 0…9`.
Меняются только getter-only `House.Tier`/`Floors`: десериализация из PostgreSQL не
использует прежние сериализованные значения этих полей, проекция считает их из XP.
Не нужны UPDATE миграции, reset/seed, перераспределение XP, смена ID/lotIndex,
deadline/receipts/demo-смещения/world version. При очередном обычном сохранении
производные поля сериализуются уже по новой шкале. Лимит 100 XP и механики не меняются.
Redis не хранит проекцию, поэтому устаревшего payload с tier/floors нет и смена ключа
кеша не нужна; каждый ответ заново строится из PostgreSQL и отдаётся с `no-store`.

Безопасная проверка этого изменения (не подключается к работающему стеку):
`docker build -f src/backend/Dockerfile --target test -t vsk-pitch-backend-tests:ten-tiers .`.
Наблюдался RED: `XP 0: expected tier 1, floors 1, got 1/2`; после замены шкалы — GREEN,
18 console tests. Все целые XP 0…100 и моторные расторжения через девять границ проверены;
legacy JSON test сохраняет все непроизводные поля и прежний receipt, проверяет максимум
10/25 и сохранение моторного вклада. HTTP/persistence suites не повторялись, работающий
мир не сбрасывался; это проверка исходников, не подтверждение развёртывания новой шкалы.

## Env приложения

Все ключи обязательны; Compose задаёт безопасные localhost-only значения:

| Ключ | Назначение |
| --- | --- |
| `DEMO_MODE` | Только `pitch` |
| `POSTGRES_CONNECTION` | Npgsql connection string, отдельная `Database=vsk_pitch` |
| `REDIS_CONNECTION` | StackExchange.Redis configuration |
| `DEMO_SEED_PATH` | Каталог неизменяемых initial CSV в образе (`/app/seed`) |
| `DEMOLITION_POLL_SECONDS` | Фоновая проверка 1..3600 секунд (Compose: 10) |
| `ASPNETCORE_URLS` | Внутренний адрес ASP.NET (Compose: `http://+:8080`) |

## Ограничения

Один JSONB row сериализует все изменения и не рассчитан на production-нагрузку;
полный мир возвращается целиком. Receipts не очищаются, история reset не аудитируется
как полноценный event journal. Склонение имён ограничено синтетическими шаблонами,
это не production-морфология. Нет Keycloak, Kafka, реального источника, SLA, полной
интеграции переводов/исправлений, резервного копирования или production-security.
Нет загрузок файлов: S3/MinIO не нужен. Backend контейнер запускается non-root;
конфигурация приходит из env, реквизиты не включены в образ.
