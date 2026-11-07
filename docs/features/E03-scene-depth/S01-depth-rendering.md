# S01 — Общая глубина объектов

Статус: Готово локально; независимое ревью и публикация проверяются S02.

Scope: scene.ts, scene.test.ts. Общие layers для city/street, глобальная сортировка
отдельных объектов по ground anchor, стабильный порядок равной глубины и сохранение
house identity. Native owner handlers и реальные ground footprints вместо
неверно перекрывающихся широких cluster hit rectangles.

## Приёмка

- [x] Unit RED на прежнем painter order воспроизведён: 5 PASS /1 FAIL.
- [x] Unit GREEN: центр между rear/front objects, не атомарные кварталы.
- [x] Grounds снизу; annotations сверху и не перехватывают события.
- [x] Street сцена, stable ties и identity/full-thumbnail сохраняются.
- [x] Не меняются пользовательская графика, существующие координаты/слоты или backend.
- [x] ESLint, typecheck, все34 frontend tests и production build прошли на точном overlay.

Родитель подтвердил SHA256 owned diff39cf7da94a834a51d635f1b64169d67c46b0ff424113a8494e02a12185c93493
и повторил gates в свежем vsk-ci-depth-build:verified без сети. CommonJS warning Pixi
остаётся неблокирующим. Используется Pixi zIndex/sortChildren, а не прямое изменение
children-array, чтобы инвалидировать retained renderer instructions.

Реальные Pixi Container/Sprite используются в unit-тестах; native browser проверяется S02.
