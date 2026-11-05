# Инфраструктура локального питча

Рабочий стенд E01: отдельные backend/frontend образы, PostgreSQL и Redis в изолированном
Compose-проекте vsk-pitch. Это localhost-only демонстрация на вымышленных данных,
не корпоративное или публичное развёртывание.

Из корня репозитория:

```sh
docker compose -p vsk-pitch --env-file infra/pitch.env.example -f infra/pitch.compose.yaml up -d --build
```

Frontend: `http://localhost:5188`, backend health: `http://localhost:5189/health`.
PostgreSQL/Redis не публикуют host-порты. Volumes имеют префикс vsk-pitch и сохраняют мир.
Обычная остановка — `stop`, не `down -v`. Секреты реальных окружений не коммитить:
`pitch.env.example` содержит только явно тестовые параметры.

[Как показывать и останавливать](../docs/PITCH.md) ·
[Backend: env и проверки](../src/backend/README.md) ·
[Обязательные корпоративные ограничения](../docs/architecture/CORPORATE-REQUIREMENTS.md).

Настройки приложения — env, экземпляры stateless, состояние/идемпотентность/сроки сноса —
PostgreSQL; Redis — восстанавливаемый version-cache. S3/MinIO потребуется при появлении
постоянных файловых загрузок/экспортов; в E01 такого сценария нет.
Kafka, Keycloak, registry/deploy pipeline, резервное копирование и production-hardening
остаются будущей работой. CI пока не настроен.
