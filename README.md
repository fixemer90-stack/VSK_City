# VSK City

Корпоративная игровая визуализация продаж страховых продуктов — Insurance City.
Компания представлена страной, филиалы — городами, продавцы — улицами внутри городов.
Навигация: карта России → город → улица. Игровых районов в первой версии нет;
каналы остаются служебными данными для прав руководителей.
Один имущественный договор создаёт один дом; моторные договоры дают опыт для десяти
визуальных уровней. Избыток моторов отображается парковками.

## Текущий статус

Реализован [локальный питч-прототип E01](docs/features/E01-pitch-prototype/FEATURE.md):
страна → город → улица, дома/парковки, продажи, расторжения и демонстрационные часы.
Используются [вымышленные входные данные](data/demo/README.md): 25 городов по 50 агентов,
32 950 договоров. Состояние сохраняется в PostgreSQL; Redis не является источником истины.
Полный сценарий проверен через настоящий API и Chromium, включая рестарт backend.
Это не корпоративный MVP: нет Keycloak, Kafka, реального источника и production-security.
Переключение демо-персоны/роли не является аутентификацией.
[CI настроен в E02](docs/features/E02-continuous-integration/FEATURE.md):
все пять GitHub Actions jobs прошли, включая lint/types/tests/build, экспорт спрайтов
и отдельный disposable runtime для HTTP/persistence/browser. [Runbook](docs/CI.md).

[E03: глубина сцены](docs/features/E03-scene-depth/FEATURE.md) исправляет перекрытие
передних объектов центром города: общая сортировка по основанию, без изменения мира
или исходных SVG. [Сравнение до/после](docs/pitch/scene-depth/before-after.png).

## Запуск питча

Из корня репозитория, нужен Docker с Compose:

```sh
docker compose -p vsk-pitch --env-file infra/pitch.env.example -f infra/pitch.compose.yaml up -d --build
```

Открыть `http://localhost:5188` в desktop-браузере с шириной от 1100 px.
Backend health: `http://localhost:5189/health`. PostgreSQL/Redis не публикуют host-порты.
Все сервисы/volumes изолированы проектом `vsk-pitch`; данные сохраняются после restart/stop.
Стенд только localhost, только синтетические данные — не публиковать в интернет.

[Сценарий показа и остановка](docs/PITCH.md) · [Скриншоты](docs/pitch/screenshots/02-city.png) ·
[Проверки и ревью](docs/reviews/E01-pitch-review.md)

## Структура

| Каталог | Назначение |
| --- | --- |
| [docs](docs/README.md) | Концепция, требования, архитектура, этапы и шаблоны |
| [src/frontend](src/frontend/README.md) | Angular + TypeScript + PixiJS клиент питча |
| [src/backend](src/backend/README.md) | ASP.NET Core / C# ядро, API и PostgreSQL/Redis питча |
| [contracts](contracts/README.md) | Будущие API, Kafka и scene-контракты |
| [assets](assets/README.md) | Графические ресурсы и правила их подготовки |
| [infra](infra/README.md) | Изолированный Docker Compose питча; корпоративный deploy отдельно |
| [tests](tests/README.md) | Межмодульные, интеграционные и сквозные проверки |
| [scripts](scripts/README.md) | Генератор вымышленных входных данных |
| [data/demo](data/demo/README.md) | Готовые тестовые справочники и полные снимки договоров |

## Начать здесь

1. Прочитать [границы корпоративного MVP](docs/MVP-SCOPE.md) — проект для согласования, не подтверждение готовности интеграции.
2. Прочитать [принятые игровые правила](docs/GAME-RULES.md) — актуальный источник формул и исключений.
3. Прочитать [концепцию v0.4](docs/concept/Insurance_City_Concept_Architecture_v0.4.md) — продукт и целевую архитектуру.
4. Проверить [дорожную карту](docs/ROADMAP.md) и [статус MVP](docs/MVP-STATUS.md).
5. Прочитать [проект целевой архитектуры](docs/architecture/SYSTEM-ARCHITECTURE.md) и [ADR-001](docs/architecture/ADR-001-modular-backend.md): это предлагаемые решения, не готовая корпоративная система.
6. Для расчёта и хранения прочитать проекты [SRS-ENGINE](docs/SRS/SRS-ENGINE.md) и [SRS-STORAGE](docs/SRS/SRS-STORAGE.md), затем оформить Feature/Story по [шаблонам](docs/templates/README.md).
7. Внешний контракт пока отложен; подключение реального источника требует его отдельного согласования.

[Версия v0.3](docs/concept/Insurance_City_Concept_Architecture_v0.3.md) сохранена без изменений
как исторический источник, а не действующий контракт.

Первая версия: desktop, минималистичный визуальный мир без числового прогресса,
лидерборда, просмотра прошлых дат и сложных анимаций. Агенты — игроки;
руководители — наблюдатели с раскрытием имён в пределах полномочий.

Целевой стек из концепции: Angular, TypeScript, PixiJS, ASP.NET Core/C#,
PostgreSQL, Redis, Kafka, Keycloak. Backend — отдельный Docker-образ, настройки через env,
экземпляры stateless; PostgreSQL хранит состояние, Redis — восстанавливаемый кеш.
При необходимости постоянного хранения файлов — S3/MinIO.
Обязательные ограничения: [корпоративные требования](docs/architecture/CORPORATE-REQUIREMENTS.md).
Версии прототипа закреплены в frontend lockfile, C# project и Dockerfile;
производственное разбиение и контракты интеграции ещё требуют проработки.

## Безопасность

Репозиторий публичный. Не публиковать реальные продажи, персональные данные,
корпоративные адреса, токены, пароли и закрытые графические материалы.
Демонстрационные данные должны быть вымышленными.

Лицензия репозитория: [MIT](LICENSE). Происхождение и права на сторонние ассеты учитываются отдельно.
