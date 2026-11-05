# Служебные команды

## Вымышленные данные

`generate_demo_data.py` создаёт CSV-справочники и полный снимок страховых договоров.
Python 3.11+, без сторонних зависимостей; выполнять из корня репозитория:

```sh
python3 scripts/generate_demo_data.py --cities 25 --phase initial --output data/demo/initial --overwrite
python3 scripts/generate_demo_data.py --cities 25 --phase terminated --output data/demo/terminated --overwrite
```

`--cities`: от 20 до 30, по умолчанию 25. В каждом городе ровно 50 агентов.
`--phase`: initial / terminated; по умолчанию terminated. `--output` обязателен.
Без `--overwrite` существующие файлы набора не заменяются. С ним перезаписываются
только шесть именованных CSV и manifest.json; остальные файлы не удаляются.
Сети, БД и корпоративных API скрипт не касается. Импортёр и игровой движок не реализованы.

Состав, ограничения и сценарий проверки расторжений: [data/demo](../data/demo/README.md).

Каждая новая команда должна документировать prerequisites, параметры и побочные эффекты.
Не добавлять заглушки, сообщающие об успешной сборке или тестах без их выполнения.
