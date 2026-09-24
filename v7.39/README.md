# Dodo Control v7.39 — настоящий Excel + PDF

База: v7.38.

Изменён только admin.html через автоматический patcher.

## Что исправлено

- «Скачать Excel» теперь вызывает уже существующий backend action exportPeriodReportXlsx.
- Скачивается настоящий файл .xlsx с корректным MIME-типом.
- Предупреждение Excel «формат файла не соответствует разрешению файла» больше не должно появляться.
- Добавлена кнопка «Скачать PDF».
- PDF строится из уже загруженных таблиц «Сводка по пиццериям» и «Ошибки за период».
- PDF: A4, альбомная ориентация, поддержка русского текста.
- CSV не добавлялся.
- Apps Script менять не требуется.
- Остальной функционал v7.38 не изменяется.

## Установка

Открой Terminal в папке control-dodo-v7-38-no-duplicate-errors и выполни:

curl -L https://raw.githubusercontent.com/melser993-png/Controling/v7.39-report-export/v7.39/apply-v7-39.mjs -o apply-v7-39.mjs
node apply-v7-39.mjs
npx vercel --prod

После публикации обнови страницу с очисткой кэша: Cmd + Shift + R.
