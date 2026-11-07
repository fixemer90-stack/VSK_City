# S03 — GitHub Actions и доказательство запуска

Статус: В процессе.

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
- [ ] Commit/push успешны, exact remote tree/readback подтверждены.
- [ ] Все пять jobs реального Actions run завершились success; записаны SHA и URL.

Наличие YAML не равно выполненному CI. Ошибку PAT/workflow permissions либо отсутствие
запуска нужно фиксировать отдельно, не выдавая local tests за remote success.
После первого зелёного run статусы Story/Feature/README обновляются по факту.
