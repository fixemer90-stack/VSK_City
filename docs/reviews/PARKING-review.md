# Пользовательские парковки — визуальное обновление

Статус: локальный frontend обновлён, функциональные проверки и независимое ревью пройдены.

## Объём и приёмка

- [x] Подключены все четыре настоящих source/parking/parking-01.svg … parking-04.svg.
- [x] Оригиналы сохранены побайтно, SVG namespace/внешние ссылки проверены настоящим exporter.
- [x] Прежние ID parking-01…04 и диапазоны 1–3 / 4–6 / 7–9 / 10 мест сохранены.
- [x] SVG 1024×770 экспортируются 2×, изотропно. Общий anchor (514,440) находится
      в центре площадки, не под её тенью. Ширина около 135 world px укладывается в участок.
- [x] 31 остальная запись manifest, включая все 20 домов, полностью совпадает с исходным main.
- [x] 26 frontend unit/component tests, Angular typecheck и production build прошли.
- [x] 2 exporter tests прошли; полный реальный Chromium export выполнен в изолированном снимке.
- [x] 7 read-only Playwright scenarios прошли: карта/центры, дома/варианты и новые парковки.
- [x] Все четыре PNG и SVG сверены по SHA через HTTP; все четыре картинки реально декодированы.
- [x] На настоящей улице число/типы Sprite совпадают с сохранённой заполненностью.
- [x] Улица и город сняты и осмотрены; каталог показывает все четыре новых изображения.
- [x] PG raw state до/после проверки побайтно одинаков: version 1516.
- [x] Backend, PostgreSQL и Redis не пересоздавались; обновлён только frontend.
- [x] Независимое ревью: passed=true, security_concerns=[], logic_errors=[].

Reviewer независимо подтвердил структурную безопасность SVG, source/PNG SHA, преобразование
якорей и полное совпадение 31 остальных PNG/manifest entries/карточек каталога с HEAD.
Его выборочный parking contract: 1 PASS; синтаксис browser test корректен.
Необязательное усиление теста точным списком ID/XML-разбором не является блокером:
весь exporter уже проверяет точный набор ID, namespace/viewBox и запрещённые SVG-конструкции.
Ограничение проверки стадий 2/3 в живом мире явно сохранено ниже; каталог не подменяет
runtime-подтверждение отсутствующих состояний.

## TDD и фактические команды

Новый exporter contract сначала упал: sourceFile undefined вместо parking/parking-01.svg.
Новый browser test сначала упал на живом старом manifest: parking-01.svg вместо нового пути.
После изменения четырёх записей spec и настоящего экспорта оба набора прошли.

```sh
node --test --test-name-pattern='parking sources' tests/scripts/sprite-export-contract.test.mjs
# Полный exporter contract запускался в изолированном context (см. доказательства ниже).
PITCH_TEST_OUTPUT=../../test-results/parking npx playwright test sprites.spec.js map-centers.spec.js ten-tiers.spec.js parking.spec.js --reporter=line
```

Frontend собран из git archive исходного main с наложением только парковочных входов
и спецификации. Это важно: пользователь параллельно редактирует дома 01 A/B и удаляет
архивы. Эти изменения оставлены в рабочем дереве, не перезаписаны и не включены в сборку.
Полный exporter в рабочем дереве не запускался, чтобы не заменить дома за пределами запроса.

В текущем сохранении выбранной улицы есть состояния 1 и 4; они подтверждены в настоящей
сцене. Состояния 2 и 3 проверены по исходникам/PNG/каталогу. Договоры ради скриншотов
не создавались, HTTP-ответы не подменялись, мир не сбрасывался.

## Доказательства и границы

- [Машиночитаемая проверка](../pitch/parking-verification.json): input/PNG SHA,
  версии/хеши PG, сохранённые container IDs, frontend image и screenshot hashes.
- [Каталог](../pitch/screenshots/parking-catalog.png).
- [Настоящая улица](../pitch/screenshots/parking-street.png).
- [Настоящий город](../pitch/screenshots/parking-city.png).
- [Инструкция обновления](../pitch/SPRITES.md).

Правила XP, вместимости, переводов, сноса и распределения вкладов не изменялись.
Порядок перекрытия городского центра остаётся известной отдельной проблемой.
Это localhost synthetic pitch, не production/corporate acceptance.
