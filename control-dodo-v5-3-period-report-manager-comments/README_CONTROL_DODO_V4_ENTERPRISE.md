# Control Dodo v4 Enterprise

Готовый проект с восстановленным дашбордом как в старой версии и текущими доработками.

## Что внутри

- Публичный дашборд сети в стиле старого интерфейса.
- Кабинет контролинга.
- Новая проверка:
  - дата через календарь;
  - время проверки;
  - время нарушения;
  - комментарий по каждому нарушению.
- Апелляции с файлами.
- Пересчёт баллов через `Ошибки_ID` и `SITE_CSV`.
- Отчёты по среднему баллу за месяц.
- Vercel API proxy.
- Apps Script одним файлом.

## Установка

### 1. Apps Script

В папке `APPS_SCRIPT` файл `ControlDodo_FULL.gs`.

Вставьте его в Apps Script вашей Google Таблицы и замените:

```javascript
SPREADSHEET_ID: "ID_ТАБЛИЦЫ",
DRIVE_FOLDER_ID: "ID_ПАПКИ_DRIVE",
```

Запустите:
- `installProject`
- `diagnostic`

### 2. Web App

Развернуть как Web App:

- Выполнять как: Меня
- Доступ: Все

Скопировать URL `/exec`.

### 3. Vercel

Добавить переменные:

```text
APPS_SCRIPT_URL
APPEAL_WEBHOOK_URL
NEXT_PUBLIC_APPS_SCRIPT_URL
```

Во все три вставить URL Apps Script `/exec`.

После этого сделать Redeploy.
