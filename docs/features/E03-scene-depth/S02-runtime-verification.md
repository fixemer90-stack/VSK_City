# S02 — Browser, rollout и публикация

Статус: В процессе — review и frontend-only rollout проверены; ожидается публикация и Actions.

## Приёмка

- [x] Новый read-only browser contract проверяет Москву, Владивосток и generic центр.
- [x] Ground-depth порядок подтверждён по настоящим renderer children после zoom/pan;
      есть rear/front objects, нет непрозрачности/масштабного обхода.
- [x] Foreground native click выбирает правильную улицу; screenshot каждого центра осмотрен.
- [x] Старые read-only map/sprites/ten-tiers/parking specs проходят без mutation requests.
- [x] Независимое review точного финального candidate прошло без блокеров.
- [x] Только frontend собран из committed assets + owned overlays; backend/PG/Redis не пересоздаются.
- [x] Raw world, non-frontend container IDs/start time и user-art WIP проверены до/после.
      При пользовательских игровых изменениях мир не восстанавливается для equality.
- [ ] Commit/push/readback выполнены, все пять Actions jobs точного SHA success.

Baseline: scratch/vsk-depth/operator-before.json (private), operator-containers.json,
user-art-before.json. Не коммитить полный raw world или реальные секреты.
Полный browser suite на operator5188 запрещён; новые/старые визуальные specs — только GET.

Preview: настоящий новый frontend на5298, подключённый к существующему backend только
через read-only сценарии; это не полностью изолированная БД, mutating suite здесь запрещён.
3 новых cases PASS и7 прежних PASS. До изменения browser contract RED на старой сцене:
нет depthOrder (0 вместо >20). Основной функциональный RED — unit painter order в S01.
Скриншоты каждого центра осмотрены; [честное crop-сравнение до/после](../../pitch/scene-depth/before-after.png).
Текущим трём центрам разделение whole PNG не потребовалось; art/scale сохранены.
После preview raw PG побайтно равен baseline1519, все4 operator container IDs/images/start time
неизменны. Во время работы изменились пользовательские IC_L04_A/B.svg; это параллельные
artwork WIP, они не откатываются и не включаются в snapshot/коммиты исправления.

[Независимое ревью](../../reviews/SCENE-DEPTH-review.md) прошло; рекомендация native ground
click выполнена и повторно3/3 PASS. После frontend-only rollout на5188 весь read-only
набор10/10 PASS:3depth+7legacy. Windows localhost5188 HTTP200, manifest35.
[Rollout evidence](../../pitch/scene-depth/verification.json): backend/PG/Redis IDs/images/start
неизменны, frontend image соответствует проверенному preview. Raw PG1553→1553 побайтно одинаков.
Между preview и rollout операторский мир продвинулся1519→1553 и не откатывался.
Preview container5298 удалён. Полные mutating15cases проверяются только в Actions CI.
