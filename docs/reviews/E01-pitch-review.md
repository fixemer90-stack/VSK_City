# E01 — ревью и интеграционная проверка

Статус: функциональные исправления завершены. Независимые backend-review и frontend
re-review F01–F06: passed, без blocking/security findings. Последний F07 delta проверен
родителем отдельно; код и доказательства опубликованы в main, remote проверен.
Объём: VSK_City, только синтетический localhost vsk-pitch, не production.

## Frontend: независимое ревью

Проверены model.ts, app.ts/html, scene.ts, CSS, конфигурация и тесты.
Первичное заключение: request changes; security findings нет, воспроизведены три P2.

| ID | Проблема | Статус |
| --- | --- | --- |
| F01 | HTTP 200/null вызывал TypeError и терял pending/requestId потенциально выполненного действия | Fixed — регрессии и реальный browser smoke прошли |
| F02 | Сигнал отмены GET заменял timeout, загрузка могла зависнуть без ограничения | Fixed — регрессии и реальный browser smoke прошли |
| F03 | Перетаскивание продолжалось после отпускания мыши за пределами сцены | Fixed — регрессии и реальный browser smoke прошли |

Дополнительные находки родительского реального browser smoke:

| ID | Проблема | Статус |
| --- | --- | --- |
| F04 | DemoApi вызывал native fetch с this=DemoApi; Chromium выдавал Illegal invocation ещё до сети | Fixed — регрессии и реальный browser smoke прошли |
| F05 | При асинхронном создании option выбор персоны показывал «Чистый лист», хотя viewer был TEST-AGENT-001-044 | Fixed — регрессии и реальный browser smoke прошли |
| F06 | Городской landmark оказывался под регулярными блоками улиц; нужна свободная центральная площадь | Fixed — регрессии и реальный browser smoke прошли |
| F07 | Захват указателя родительским div отбирал pointerup у Pixi canvas: прямые клики по карте не открывали города | Fixed — capture/release выполняются на canvas, RED/GREEN тест и реальные клики по Москве/Владивостоку прошли |

F04 проверен на настоящем браузере и настоящем API: property-call fetch давал Illegal invocation,
bound-call и bare-call возвращали HTTP 200. APIRequest-контекст Playwright работал и до этого,
что объясняет расхождение между зелёными API-тестами и неработающим интерфейсом.
Диагностический browser запуск с привязкой native fetch к Window позволил проверить графику
на реальном backend, без подмены ответов. Это диагностика, не финальная приёмка UI:
итоговые тесты должны пройти без такого initScript.

Пример диагностического снимка подтвердил неверный select и перекрытую площадь.
При этом Pixi/WebGL отрисовывает реальные дома/парковки, размеры canvas 1130×650 при окне1440×960.

## Backend: независимое ревью

Независимое заключение: passed, security_concerns=[], logic_errors=[]. Хеши четырёх основных
backend-файлов родитель сравнил с просмотренным кандидатом — без изменений.
Ограничения питч-схемы (одна JSONB строка, mock-role, отсутствие Kafka/Keycloak) не являются
скрытыми production-возможностями и явно перечислены в документации.

## Уже выполненные родительские проверки

- Реальный Docker frontend build: успешно; один неблокирующий CommonJS warning в зависимости Pixi.
- Реальный запуск C# assertion-runner из тестового образа: 17 passed.
- `PITCH_URL=http://127.0.0.1:5189 python3 -m unittest discover -s tests/backend -p 'test_*.py' -v`: 10 passed,
  включая конкурирующий повтор, рестарт, недоступность Redis, восстановление кеша и worker-снос без GET.
- `python3 -m unittest discover -s tests -p 'test_demo_data.py' -v`: 5 passed.
- Compose config: успешно; PostgreSQL/Redis без host-портов, приложение слушает только localhost5188/5189.
- Через backend и nginx health HTTP200, PostgreSQL/Redis up; state mode=pitch,25городов,1250улиц.
- Первый полный Playwright: 3 passed / 2 failed. API, narrow desktop boundary и реальный рестарт прошли;
  UI и восстановление после HTTP503 остановились на F04. Эти падения не скрываются повторным запуском.

После исправлений frontend пересобран и recreate выполнен. Повторный полный Playwright:
5 passed без override native fetch и без подмены основного API. Он включает прямые Pixi-клики,
переключение персоны/роли, продажи/снос, HTTP503 error-state, desktop widths и настоящий рестарт.
Frontend: 14 passed, Docker-stage typecheck успешен; production build успешен.
На WSL/NTFS отдельные host ngc/build команды превышали timeout, поэтому заключительные
typecheck/unit/build подтверждены внутри того же Docker build-stage, без bind-mount исходников.

Итоговые скриншоты страны/города/улицы/сноса просмотрены, центр больше не перекрыт,
выбранная персона соответствует viewer. Они сохранены в docs/pitch/screenshots.
Frontend re-review F01–F06 завершён с passed. Сверены его хеши model.ts/app.html/app.ts;
последний F07 scene/test delta внесён родителем после кандидата и проверен отдельно:
сначала наблюдалась RED регрессия захвата canvas, затем GREEN, полный набор 14 unit и
нативные browser-клики Москва/Владивосток. Раннее ревью не выдаётся за просмотр этого delta.
Проверена большая улица с 50 объектами в доступном DOM-списке, без агрегации.
Windows host-facing frontend/API также вернули HTTP200, тот же mode/version и 25×50 мир.
После smoke мир явно возвращён к initial, результат подтверждён отдельным GET.

Машиночитаемое наблюдение: [verification.json](../pitch/verification.json).
Публикация кода/доказательств `8da5ba8` подтверждена свежим чтением remote main,
совпадением всех 95 remote file hashes и чистым рабочим деревом на этом checkpoint.
S01–S03 закрыты в объёме локального питча. Закрывающая правка статусов — только документация;
она не выдаётся за новый runtime deploy или production-приёмку.
