# S02 — Browser, rollout и публикация

Статус: Не начато. Зависит от S01.

## Приёмка

- [ ] Новый read-only browser contract проверяет Москву, Владивосток и generic центр.
- [ ] Ground-depth порядок подтверждён по настоящим renderer children после zoom/pan;
      есть rear/front objects, нет непрозрачности/масштабного обхода.
- [ ] Foreground native click выбирает правильную улицу; screenshot каждого центра осмотрен.
- [ ] Старые read-only map/sprites/ten-tiers/parking specs проходят без mutation requests.
- [ ] Независимое review точного финального candidate прошло без блокеров.
- [ ] Только frontend собран из committed assets + owned overlays; backend/PG/Redis не пересоздаются.
- [ ] Raw world, non-frontend container IDs/start time и user-art WIP проверены до/после.
      При пользовательских игровых изменениях мир не восстанавливается для equality.
- [ ] Commit/push/readback выполнены, все пять Actions jobs точного SHA success.

Baseline: scratch/vsk-depth/operator-before.json (private), operator-containers.json,
user-art-before.json. Не коммитить полный raw world или реальные секреты.
Полный browser suite на operator5188 запрещён; новые/старые визуальные specs — только GET.
