# S01 — Общая глубина объектов

Статус: В процессе.

Scope: scene.ts, scene.test.ts. Общие layers для city/street, глобальная сортировка
отдельных объектов по ground anchor, стабильный порядок равной глубины и сохранение
house identity. Native owner handlers и реальные ground footprints вместо
неверно перекрывающихся широких cluster hit rectangles.

## Приёмка

- [ ] Unit RED на прежнем painter order воспроизведён.
- [ ] Unit GREEN: центр между rear/front objects, не атомарные кварталы.
- [ ] Grounds снизу; annotations сверху и не перехватывают события.
- [ ] Street сцена, stable ties и identity/full-thumbnail сохраняются.
- [ ] Не меняются пользовательская графика, существующие координаты/слоты или backend.
- [ ] ESLint, typecheck, все frontend tests и production build прошли на точном overlay.

Реальные Pixi Container/Sprite используются в unit-тестах; native browser проверяется S02.
