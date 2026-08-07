# Control Dodo v5.2 — исправление API после v5.1

Причина демо-режима найдена:
в v5.1 функция `listSiteCsvChecksForAdmin_()` обращалась к
`isErrorActiveForDashboard_()`, но эта функция отсутствовала в Apps Script.

Из-за этого Apps Script возвращал ошибку, а сайт показывал:
`Демо-режим: API не загрузил таблицу`.

В v5.2 функция восстановлена.

ID уже вставлены:
SPREADSHEET_ID = 1y4AqtM98_AFNSuoogHP3HuXW78_c6LSP-nsW50TvKHU
DRIVE_FOLDER_ID = 14_em-t7o2s2OYT1OAHS5vbX2GMKILYsh

Что делать:
1. В Apps Script заменить весь старый ControlDodo_FULL.gs файлом из папки APPS_SCRIPT.
2. Сохранить.
3. Запустить diagnostic.
4. Обновить развертывание Web App новой версией.
5. Vercel менять НЕ обязательно, если уже установлен v5.1.
