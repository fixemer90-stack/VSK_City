# CITY IDENTITY — Москва кольцами, Владивосток вдоль реки

Дата: 8 ноября 2026. **Локальный кандидат проверен; push и rollout не выполнялись.**
Исходный HEAD: `698d66d235b64e2e0709ff8d56ccc17b93f1d394`.
Это самостоятельная проверка нового кандидата, не унаследованное одобрение предыдущего обзора.
Независимое родительское ревью и полный disposable CI остаются следующими воротами.

## Что изменено

- Москва: три настоящих замкнутых концентрических дорожных кольца вокруг
  Кремлёвской площади и четыре радиальных направления между кольцами.
  Миниатюры размещены в свободных кольцевых полосах, а не оставлены в сетке под
  нарисованными поверх неё окружностями. Арт домов остаётся вертикальным;
  округлая травяная граница не заставляет fit охватывать пустые углы квадрата.
- Владивосток: непрерывная река проходит через существующий водный пролёт
  подробного Золотого моста. На обоих берегах — набережные, деревья, скамейки
  и отдельные дорожные коллекторы. Дополнительные два перехода через реку
  нарисованы мостами с тенью, перилами и стойками; бродов нет.
- В SVG Владивостока изменены только стыки воды с окружением: разомкнуты
  поперечные контуры/поздние блики границы и добавлено локальное смешивание цвета.
  Архитектура моста, пилоны, тросы, лодки, детали набережной и калибровка сохранены.
  SVG и PNG согласованы реальным Chromium-экспортом.
- `cityBlockPosition(index, kind)` — только визуальный адрес миниатюры обзора.
  Одну функцию используют scene и браузерные/модульные проверки.
  Для generic сохранены прежние адреса и вся композиция; для двух уникальных
  городов адрес зависит от индекса и идентичности города, но не от продаж.
- Не менялись backend, сохранённые street/house/lot ID, личные участки,
  XP/парковки/снос, API и раскрытие имён. Городской центр не добавлен на личные улицы.

## Проверка финального кандидата

Замороженный снимок `git archive HEAD` + только принадлежащие задаче изменения.
Пользовательские удаления архивных SVG и посторонний parking ZIP исключены из
сборки и коммита. Побайтная сверка 13 code/test/asset путей с frozen snapshot успешна.
Сборка использует существующие cached dependencies; `--network none`.

```sh
npm run lint && npm run typecheck && npm test && npm run build
```

- **54/54 frontend unit tests**, ESLint и Angular typecheck успешны;
  production build успешен. Единственное предупреждение — существующий
  CommonJS `@xmldom/xmldom` через Pixi WebWorkerAdapter.
- Новые проверки: замкнутость и концентричность колец, четыре радиальных
  направления; единый endpoint-connected граф, подходы всех улиц/центра;
  road-width clearance с выборкой каждого сегмента через 4 world units;
  береговые участки, только мостовые пересечения воды и расширение до 51/64 улиц.
- Реальные Pixi Graphics проверяют покрытие колец/реки и перила в общем
  ground-depth слое. Сохранены owner pointer handlers, полигональные наземные
  цели и преобразования fit/zoom/pan/resize. Старые проверки сеточных координат
  теперь явно проверяют generic либо авторизованную city-specific геометрию,
  а не удалены ради зелёного результата.
- **8/8 script checks**: SVG safety/детали/калибровка, exporter и CI mutation guard.
  Два полных финальных экспорта дали побайтно одинаковые 45 выходных файлов.
  Все **34 нетронутые manifest entries + соответствующие SVG/PNG** совпали с HEAD.

Настоящий backend, Chromium, без подмены API:

```sh
cd tests/pitch-browser
PITCH_BASE_URL=http://127.0.0.1:5388 \
PITCH_TEST_OUTPUT=../../test-results/city-identity-verified \
npx playwright test city-network.spec.js depth.spec.js map-centers.spec.js \
  street-layout.spec.js sprites.spec.js parking.spec.js ten-tiers.spec.js
```

**21/21 browser cases** успешны:

- Все **50 московских и 50 владивостокских улиц** открыты нативным mouse click
  по доступному объекту/земле; проверены точный street ID и полный набор house ID.
- Три центра: fit и zoom на **1100/1440/1920 × 960**, ровно один правильный центр,
  неизменность A/B арта/идентичностей при камере и отсутствие horizontal overflow.
- Depth, pan, foreground-house и пустая наземная цель; все 25 городов карты;
  все 35 спрайтов/четыре парковки; личные улицы empty/motor_only/mixed/
  skyscraper/overflow/large; ten-tier projection и A/B между сценами.
- Финальный запуск создал 88 PNG. В proof сохранены 18 before + 18 after
  с одинаковыми viewport/fit/тремя штатными приближениями и две контактные таблицы.
  Вручную просмотрены обе таблицы и увеличенные реальные кадры Москвы/стыка реки.
  Поздний белый контур поперёк воды обнаружен на пикселях и устранён до финального запуска.
- Для generic scene crop `(310,138,width,788)` **пиксельно идентичен** before на
  всех трёх ширинах и обоих масштабах. На 1100 fit миниатюры мелкие; детали
  читаются штатным zoom. Обрезка краёв при увеличении ожидаема, fit показывает весь город.

## Снимки

[Все fit](../pitch/city-identity/after-contact-fit.jpg) ·
[Все zoom](../pitch/city-identity/after-contact-closeup.jpg).

| Город | До, 1440 fit | После, 1440 fit | После, 1440 zoom |
|---|---|---|---|
| Москва | [до](../pitch/city-identity/before-moscow-1440-fit.png) | [после](../pitch/city-identity/after-moscow-1440-fit.png) | [zoom](../pitch/city-identity/after-moscow-1440-closeup.png) |
| Владивосток | [до](../pitch/city-identity/before-vladivostok-1440-fit.png) | [после](../pitch/city-identity/after-vladivostok-1440-fit.png) | [zoom](../pitch/city-identity/after-vladivostok-1440-closeup.png) |
| Generic | [до](../pitch/city-identity/before-generic-1440-fit.png) | [после](../pitch/city-identity/after-generic-1440-fit.png) | [zoom](../pitch/city-identity/after-generic-1440-closeup.png) |

Полная матрица находится в `docs/pitch/city-identity/`:
`{before,after}-{moscow,vladivostok,generic}-{1100,1440,1920}-{fit,closeup}.png`.
Before — операторский 5188, after — изолированный frontend preview 5388,
один и тот же сохранённый мир. Контактные таблицы — только монтаж настоящих screenshots.

## Образы, безопасность и передача родителю

- Runtime tag: `vsk-ci-cityidentity-frontend:1108`.
- Проверенный runtime image ID:
  `sha256:9b58625fb16289eef540ec74c6eec7c4b0546eba859c7bfedb50122d654c39d8`.
- Build tag: `vsk-ci-cityidentity-build:1108`.
- Build image ID:
  `sha256:c1a4b96847c9f700be8a31d1597efaacf5b9a3e45bac81bfb9800438394f3bbd`.
- В runtime image прочитан обычный репозиторный nginx config без ограничений API.
  GET/HEAD-only config был отдельным read-only bind mount **только preview**.
  Финальный preview access-log: **1350 запросов, только GET**, никаких POST.
- Raw PostgreSQL `pitch_world.state::text` до и после проверок:
  `e98ea06aa7d08d4b720fed9ce76ed0bbcc914b886cfccfeb47729602c28e61b6`.
  ID, image и start time backend/PostgreSQL/Redis не изменились.
  Операторский frontend продолжает работать на прежнем `77328ada427d`.
- Preview удалён; отсутствие контейнера прочитано обратно. Два проверенных образа
  и frozen source/logs остаются в `/mnt/d/My city/.hermes-scratch-city-identity`.
- Не выполнялись push, rollout, reset/reseed, изменение часов, restart зависимостей
  или полный мутационный suite. Перед публикацией родитель выполняет независимое
  ревью, exact-SHA disposable CI и при одобрении frontend-only rollout.
