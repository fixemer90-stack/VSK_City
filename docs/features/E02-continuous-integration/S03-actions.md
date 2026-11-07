# S03 — GitHub Actions и доказательство запуска

Статус: В процессе — права PAT выданы, push прошёл; первый реальный run выявил EXE001.

Первоначальный push был отклонён без PAT Workflows:write. После выдачи разрешения push
9c661bf прошёл; remote tree проверен:250 blobs совпали. Run42398875221:
frontend/backend/assets success, Python failed на EXE001, integration skipped.
Причина: scripts/ci_stack.py и generate_demo_data.py имели shebang, но Git mode100644;
на NTFS рабочие файлы показывали777, что скрывало различие до runner checkout.
Исправление: записать mode100755 через git update-index --chmod=+x без отключения Ruff.

## Работа

.github/workflows/ci.yml: push main / pull_request / workflow_dispatch,
read-only GITHUB_TOKEN, SHA-pinned actions, timeout/concurrency, непривилегированные PR.
Jobs: frontend, backend, python, assets → integration.
requirements-ci.txt/pyproject.toml фиксируют Python tooling и область проверок.
Integration создаёт собственный CI project, запускает HTTP/persistence и полный browser suite,
при ошибке сохраняет логи, всегда пытается выгрузить traces/screenshots и удалить свой стенд.

## Приёмка

- [x] Workflow отсутствовал: новый safety contract дал ожидаемый RED.
- [x] Workflow проверен настоящим actionlint1.7.12; все external action refs — точные SHA.
- [x] Python Ruff/format и strict mypy: PASS; 13 fixture/safety tests: PASS.
- [x] Backend свежий build: 0 warnings/errors; 18 assertions: PASS.
- [x] Реальный export: 2 tests PASS, 37 generated artifacts побайтно равны baseline Git.
- [x] S01/S02 завершены локально и final candidate прошёл необходимые review/gates.
- [x] Commit/push успешны, exact remote tree/readback подтверждены для9c661bf.
- [ ] Все пять jobs реального Actions run завершились success; записаны SHA и URL.

Наличие YAML не равно выполненному CI. Ошибку PAT/workflow permissions либо отсутствие
запуска нужно фиксировать отдельно, не выдавая local tests за remote success.
После первого зелёного run статусы Story/Feature/README обновляются по факту.
