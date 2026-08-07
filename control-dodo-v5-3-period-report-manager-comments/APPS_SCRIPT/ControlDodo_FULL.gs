/**
 * ControlDodo_FULL.gs
 * Полный Apps Script для проекта Control Dodo.
 * Замените только SPREADSHEET_ID и DRIVE_FOLDER_ID.
 */

const CONFIG = {
  SPREADSHEET_ID: "1y4AqtM98_AFNSuoogHP3HuXW78_c6LSP-nsW50TvKHU",
  DRIVE_FOLDER_ID: "14_em-t7o2s2OYT1OAHS5vbX2GMKILYsh",

  SHEET_TEMPLATE: "Шаблон проверки",
  SHEET_CHECKS: "Проверки",
  SHEET_SITE: "SITE_CSV",
  SHEET_ERRORS: "Справочник ошибок",
  SHEET_APPEALS: "Апелляции",
  SHEET_APPEAL_LOG: "Журнал апелляций",
  SHEET_ERROR_ID: "Ошибки_ID",
  SHEET_USERS: "Пользователи",

  STATUS: {
    NEW: "Новая",
    IN_PROGRESS: "В работе",
    APPROVED: "Удовлетворена",
    REJECTED: "Не удовлетворена"
  }
};

const ADMIN_CHECKS_HEADERS = [
  "Дата","Время","Пиццерия","Зона","Тип проверки","Балл","Ошибки","Фото",
  "Проверяющий","Комментарий","Динамика","Время нарушения",
  "Комментарий по нарушению","Ошибка сайта","Фото","Комментарий проверки"
];

const ADMIN_SITE_HEADERS = ["Дата","Пиццерия","Балл","Ошибки","Проверяющий"];

const ADMIN_ERRORS_ID_HEADERS = [
  "ID ошибки","ID проверки","Дата","Пиццерия","Проверяющий","Зона",
  "Время нарушения","Нарушение","Вес баллов","Комментарий проверяющего","Статус ошибки",
  "№ апелляции","Дата изменения","Комментарий контролинга","Комментарий управляющего"
];

const ADMIN_APPEALS_HEADERS = [
  "№ апелляции","ID ошибки","Дата подачи","Период","Дата проверки",
  "Пиццерия","Балл","Нарушение","Комментарий управляющего","Email",
  "Проверяющий","Файлы","Комментарий контролинга","Статус",
  "Дата решения","Email отправлен","Кто изменил статус","Дата изменения"
];

const ADMIN_APPEAL_COL = {
  ID: 1, ERROR_ID: 2, CREATED_AT: 3, PERIOD: 4, CHECK_DATE: 5, PIZZERIA: 6,
  SCORE: 7, ERROR: 8, MANAGER_COMMENT: 9, EMAIL: 10, INSPECTOR: 11, FILES: 12,
  CONTROL_COMMENT: 13, STATUS: 14, DECISION_DATE: 15, EMAIL_SENT: 16,
  CHANGED_BY: 17, CHANGED_AT: 18
};

const ADMIN_USERS_HEADERS = ["ФИО", "Логин", "Пароль", "Email", "Роль", "Активен"];


function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet_() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID.indexOf("ВСТАВЬТЕ") >= 0) {
    throw new Error("В CONFIG не указан SPREADSHEET_ID");
  }
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function ensureHeader_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

function text_(value) { return String(value || "").trim(); }
function normalizeHeader_(value) { return String(value || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim(); }

function formatAdminInputDate_(value) {
  const s = String(value || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  return s || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd.MM.yyyy");
}

function toIsoDateForAdmin_(value) {
  const s = String(value || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

function formatAdminInputTime_(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  return m ? `${m[1]}:${m[2]}:${m[3] || "00"}` : s;
}

function extractEmailForAdmin_(value) {
  const match = String(value || "").replace(/\s+/g, " ").trim().match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : "";
}

function makeSiteErrorForAdmin_(time, zone, errorName, weight, comment) {
  const parts = [];
  if (time) parts.push(String(time));
  if (zone) parts.push(String(zone));
  let errorText = String(errorName || "").trim();
  const n = Number(weight || 0);
  if (n) errorText += " (-" + Math.abs(n) + ")";
  if (errorText) parts.push(errorText);
  if (comment) parts.push(String(comment));
  return parts.join(" — ");
}

function countErrorsInSiteCsvTextForAdmin_(text) {
  const value = String(text || "").trim();
  if (!value) return 0;
  if (value.indexOf(";") >= 0) return value.split(";").map(x => x.trim()).filter(Boolean).length;
  return 1;
}

function findErrorWeight_(ss, errorName) {
  const sheet = ss.getSheetByName(CONFIG.SHEET_ERRORS);
  if (!sheet || sheet.getLastRow() <= 1) return 0;
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(normalizeHeader_);
  let cName = headers.indexOf(normalizeHeader_("Нарушение"));
  let cWeight = headers.indexOf(normalizeHeader_("Вес баллов"));
  if (cName < 0) cName = 0;
  if (cWeight < 0) cWeight = 1;
  const target = normalizeHeader_(errorName);
  for (let i = 1; i < values.length; i++) {
    if (normalizeHeader_(values[i][cName]) === target) {
      const match = String(values[i][cWeight] || "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
      return match ? Math.abs(Number(match[0])) : 0;
    }
  }
  return 0;
}

function doGet() { return json_({ ok: true, message: "Control Dodo API работает" }); }

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(payload.action || "").trim();
    if (action === "login") return json_(loginControlUser_(payload));
    if (action === "listUsers") return json_(listControlUsers_());
    if (action === "saveUser") return json_(saveControlUser_(payload));
    if (action === "listChecks") return json_(listChecksForAdmin_());
    if (action === "createCheck") return json_(createCheckFromAdmin_(payload));
    if (action === "listAppeals") return json_(listAppealsForAdmin_());
    if (action === "updateAppeal") return json_(updateAppealFromAdmin_(payload));
    if (action === "dashboard") return json_(getAdminDashboard_());
    if (action === "listErrors") return json_(listErrorsForAdmin_());
    if (action === "monthlyAverage") return json_(getMonthlyAverageForAdmin_(payload));
    if (action === "periodReport") return json_(getPeriodReportForAdmin_(payload));
    if (action === "saveManagerErrorComment") return json_(saveManagerErrorCommentForAdmin_(payload));
    return createAppealFromSiteForAdmin_(payload);
  } catch (error) {
    return json_({ ok: false, error: true, message: error.message });
  }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Контролинг")
    .addItem("Установить проект", "installProject")
    .addItem("Диагностика", "diagnostic")
    .addItem("Пересчитать апелляции и баллы", "repairAppealsAndScores")
    .addItem("Проверить Drive", "testDriveAccess")
    .addItem("Резервная копия", "createBackup")
    .addToUi();
}

function installProject() {
  const ss = getSpreadsheet_();
  ensureHeader_(getOrCreateSheet_(ss, CONFIG.SHEET_CHECKS), ADMIN_CHECKS_HEADERS);
  ensureHeader_(getOrCreateSheet_(ss, CONFIG.SHEET_SITE), ADMIN_SITE_HEADERS);
  ensureHeader_(getOrCreateSheet_(ss, CONFIG.SHEET_ERROR_ID), ADMIN_ERRORS_ID_HEADERS);
  ensureHeader_(getOrCreateSheet_(ss, CONFIG.SHEET_APPEALS), ADMIN_APPEALS_HEADERS);
  ensureHeader_(getOrCreateSheet_(ss, CONFIG.SHEET_APPEAL_LOG), ["Дата", "№ апелляции", "Действие", "Пользователь"]);
  ensureHeader_(getOrCreateSheet_(ss, CONFIG.SHEET_ERRORS), ["Нарушение", "Вес баллов", "Критичность"]);
  ensureUsersSheetForAdmin_(ss);
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const quota = MailApp.getRemainingDailyQuota();
  Logger.log("✅ Установка завершена\nТаблица: " + ss.getName() + "\nПапка: " + folder.getName() + "\nGmail лимит: " + quota);
  return "✅ Установка завершена";
}

function diagnostic() {
  const lines = [];
  try {
    const ss = getSpreadsheet_();
    lines.push("✅ Таблица открыта: " + ss.getName());
    [CONFIG.SHEET_CHECKS, CONFIG.SHEET_SITE, CONFIG.SHEET_ERROR_ID, CONFIG.SHEET_APPEALS, CONFIG.SHEET_APPEAL_LOG, CONFIG.SHEET_ERRORS, CONFIG.SHEET_USERS].forEach(name => {
      lines.push((ss.getSheetByName(name) ? "✅ " : "❌ ") + "Лист: " + name);
    });
  } catch (e) { lines.push("❌ Таблица: " + e.message); }
  try {
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    lines.push("✅ Доступ к папке Drive есть: " + folder.getName());
  } catch (e) { lines.push("❌ Drive: " + e.message); }
  try { lines.push("✅ Gmail/MailApp доступен. Остаток писем: " + MailApp.getRemainingDailyQuota()); }
  catch (e) { lines.push("❌ Gmail/MailApp: " + e.message); }
  Logger.log(lines.join("\n"));
  return lines.join("\n");
}

function testDriveAccess() {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  Logger.log("Доступ к папке есть: " + folder.getName());
  return folder.getName();
}

function createBackup() {
  const ss = getSpreadsheet_();
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm");
  const backup = SpreadsheetApp.create("Backup Control Dodo " + now);
  [CONFIG.SHEET_CHECKS, CONFIG.SHEET_SITE, CONFIG.SHEET_ERROR_ID, CONFIG.SHEET_APPEALS, CONFIG.SHEET_APPEAL_LOG].forEach(name => {
    const source = ss.getSheetByName(name);
    if (!source) return;
    const target = backup.insertSheet(name);
    const values = source.getDataRange().getValues();
    if (values.length && values[0].length) {
      target.getRange(1, 1, values.length, values[0].length).setValues(values);
      target.setFrozenRows(1);
    }
  });
  const defaultSheet = backup.getSheetByName("Лист1") || backup.getSheetByName("Sheet1");
  if (defaultSheet && backup.getSheets().length > 1) backup.deleteSheet(defaultSheet);
  Logger.log("Резервная копия создана: " + backup.getUrl());
  return backup.getUrl();
}


function ensureUsersSheetForAdmin_(ss) {
  const sheet = getOrCreateSheet_(ss, CONFIG.SHEET_USERS);
  ensureHeader_(sheet, ADMIN_USERS_HEADERS);

  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, 2, ADMIN_USERS_HEADERS.length).setValues([
      ["Мельникова Полина", "polina", "1234", "dodo.controlling2@gmail.com", "Контролинг", "Да"],
      ["Хамидова Камила", "kamila", "1234", "dodo.controlling@gmail.com", "Контролинг", "Да"]
    ]);
  }

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Да", "Нет"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 6, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule);
}

function loginControlUser_(payload) {
  const ss = getSpreadsheet_();
  ensureUsersSheetForAdmin_(ss);

  const nameOrLogin = text_(payload.name || payload.login);
  const password = text_(payload.password);

  if (!nameOrLogin || !password) {
    return { ok: false, message: "Введите пользователя и пароль" };
  }

  const sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
  const values = sheet.getDataRange().getDisplayValues();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const fio = text_(row[0]);
    const login = text_(row[1]);
    const pass = text_(row[2]);
    const email = text_(row[3]);
    const role = text_(row[4] || "Контролинг");
    const active = text_(row[5] || "Да");

    const userMatches = normalizeHeader_(fio) === normalizeHeader_(nameOrLogin) || normalizeHeader_(login) === normalizeHeader_(nameOrLogin);

    if (userMatches) {
      if (active !== "Да") return { ok: false, message: "Пользователь отключён" };
      if (pass !== password) return { ok: false, message: "Неверный пароль" };

      return {
        ok: true,
        user: {
          name: fio,
          login: login,
          email: email,
          role: role
        }
      };
    }
  }

  return { ok: false, message: "Пользователь не найден" };
}

function listControlUsers_() {
  const ss = getSpreadsheet_();
  ensureUsersSheetForAdmin_(ss);
  const sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
  const values = sheet.getDataRange().getDisplayValues();

  const users = values.slice(1).filter(row => text_(row[0])).map(row => ({
    name: text_(row[0]),
    login: text_(row[1]),
    email: text_(row[3]),
    role: text_(row[4]),
    active: text_(row[5] || "Да")
  }));

  return { ok: true, users: users };
}

function saveControlUser_(payload) {
  const ss = getSpreadsheet_();
  ensureUsersSheetForAdmin_(ss);
  const sheet = ss.getSheetByName(CONFIG.SHEET_USERS);

  const name = text_(payload.name);
  if (!name) return { ok: false, message: "Укажите ФИО" };

  const login = text_(payload.login);
  const password = text_(payload.password);
  const email = text_(payload.email);
  const role = text_(payload.role || "Контролинг");
  const active = text_(payload.active || "Да");

  if (!login) return { ok: false, message: "Укажите логин" };
  if (!password) return { ok: false, message: "Укажите пароль" };
  if (!email) return { ok: false, message: "Укажите email" };

  const values = sheet.getDataRange().getDisplayValues();
  let rowNumber = null;

  for (let i = 1; i < values.length; i++) {
    if (normalizeHeader_(values[i][0]) === normalizeHeader_(name) || normalizeHeader_(values[i][1]) === normalizeHeader_(login)) {
      rowNumber = i + 1;
      break;
    }
  }

  const rowValues = [name, login, password, email, role, active];

  if (rowNumber) {
    sheet.getRange(rowNumber, 1, 1, ADMIN_USERS_HEADERS.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return { ok: true, message: "Пользователь сохранён" };
}

function listErrorsForAdmin_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(CONFIG.SHEET_ERRORS);
  if (!sheet) return { ok: false, message: "Лист «Справочник ошибок» не найден" };
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length <= 1) return { ok: true, errors: [] };
  const headers = values[0].map(normalizeHeader_);
  let cName = headers.indexOf(normalizeHeader_("Нарушение"));
  let cWeight = headers.indexOf(normalizeHeader_("Вес баллов"));
  let cCritical = headers.indexOf(normalizeHeader_("Критичность"));
  if (cName < 0) cName = 0;
  if (cWeight < 0) cWeight = 1;
  if (cCritical < 0) cCritical = 2;
  const errors = values.slice(1).map(row => {
    const name = text_(row[cName]);
    const match = String(row[cWeight] || "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    return { name, weight: match ? Math.abs(Number(match[0])) : "", criticality: text_(row[cCritical]) };
  }).filter(item => item.name);
  return { ok: true, errors };
}

function createCheckFromAdmin_(payload) {
  const ss = getSpreadsheet_();
  const checks = getOrCreateSheet_(ss, CONFIG.SHEET_CHECKS);
  const errorsIdSheet = getOrCreateSheet_(ss, CONFIG.SHEET_ERROR_ID);
  ensureHeader_(checks, ADMIN_CHECKS_HEADERS);
  ensureHeader_(errorsIdSheet, ADMIN_ERRORS_ID_HEADERS);
  const checkId = createAdminCheckId_(ss);
  const date = formatAdminInputDate_(payload.date);
  const time = formatAdminInputTime_(payload.time);
  const pizzeria = text_(payload.pizzeria);
  const zone = text_(payload.zone);
  const type = text_(payload.type || "Плановая");
  const inspector = text_(payload.inspector);
  const photo = text_(payload.photo);
  const comment = text_(payload.comment);
  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  if (!pizzeria) return { ok: false, message: "Выберите пиццерию" };
  if (!zone) return { ok: false, message: "Выберите зону" };
  if (!inspector) return { ok: false, message: "Укажите проверяющего" };
  let totalPenalty = 0;
  const activeErrors = [];
  errors.forEach(item => {
    const errorName = text_(item.error);
    if (!errorName) return;
    const weight = Number(item.weight || findErrorWeight_(ss, errorName) || 0);
    const errorTime = formatAdminInputTime_(item.time);
    const errorZone = text_(item.zone || zone);
    const errorComment = text_(item.comment);
    totalPenalty += Math.abs(weight);
    activeErrors.push({ errorName, weight: Math.abs(weight), errorTime, errorZone, errorComment });
  });
  const finalScore = Math.max(0, 100 - totalPenalty);
  const checkRows = [];
  const errorRows = [];
  if (activeErrors.length) {
    activeErrors.forEach(item => {
      const siteError = makeSiteErrorForAdmin_(item.errorTime, item.errorZone, item.errorName, item.weight, item.errorComment);
      checkRows.push([date, time, pizzeria, zone, type, finalScore, siteError, photo, inspector, comment, 0, item.errorTime, item.errorComment, siteError, photo, comment]);
      errorRows.push(["", checkId, date, pizzeria, inspector, item.errorZone, item.errorTime, item.errorName, item.weight, item.errorComment, "Активна", "", "", "", ""]);
    });
  } else {
    checkRows.push([date, time, pizzeria, zone, type, 100, "", photo, inspector, comment, 0, "", "", "", photo, comment]);
  }
  checks.getRange(checks.getLastRow() + 1, 1, checkRows.length, ADMIN_CHECKS_HEADERS.length).setValues(checkRows);
  if (errorRows.length) appendErrorsIdForAdmin_(ss, errorRows);
  rebuildSiteCsvFromErrorsIdForAdmin_(ss);
  return { ok: true, message: "Проверка отправлена", checkId, score: finalScore };
}

function appendErrorsIdForAdmin_(ss, rows) {
  const sheet = getOrCreateSheet_(ss, CONFIG.SHEET_ERROR_ID);
  ensureHeader_(sheet, ADMIN_ERRORS_ID_HEADERS);
  const startNumber = getNextAdminErrorNumber_(sheet);
  const withIds = rows.map((row, index) => {
    row[0] = "ERR-" + String(startNumber + index).padStart(6, "0");
    return row;
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, withIds.length, ADMIN_ERRORS_ID_HEADERS.length).setValues(withIds);
}

function getNextAdminErrorNumber_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  let max = 0;
  ids.forEach(row => {
    const match = String(row[0] || "").match(/ERR-(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  });
  return max + 1;
}

function createAdminCheckId_(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEET_ERROR_ID);
  let max = 0;
  if (sheet && sheet.getLastRow() > 1) {
    const values = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getDisplayValues();
    values.forEach(row => {
      const match = String(row[0] || "").match(/CHK-(\d+)/);
      if (match) max = Math.max(max, Number(match[1]));
    });
  }
  return "CHK-" + String(max + 1).padStart(6, "0");
}

function listSiteCsvChecksForAdmin_() {
  const ss = getSpreadsheet_();
  const errorsSheet = ss.getSheetByName(CONFIG.SHEET_ERROR_ID);

  if (errorsSheet && errorsSheet.getLastRow() > 1) {
    const rows = errorsSheet.getRange(2, 1, errorsSheet.getLastRow() - 1, ADMIN_ERRORS_ID_HEADERS.length).getDisplayValues();
    const groups = {};

    rows.forEach(row => {
      const checkId = text_(row[1]);
      const date = text_(row[2]);
      const pizzeria = text_(row[3]);
      const inspector = text_(row[4]);
      const zone = text_(row[5]);
      const errorTime = text_(row[6]);
      const errorName = text_(row[7]);
      const weight = Number(String(row[8] || "0").replace(",", ".").match(/\d+/)?.[0] || 0);
      const comment = text_(row[9]);
      const status = text_(row[10]);

      if (!checkId || !date || !pizzeria) return;

      if (!groups[checkId]) {
        groups[checkId] = {checkId,date,isoDate:toIsoDateForAdmin_(date),pizzeria,inspector,penalty:0,activeErrors:[],errorDetails:[]};
      }

      if (isErrorActiveForDashboard_(status)) {
        const errorText = makeSiteErrorForAdmin_(errorTime, zone, errorName, weight, "");
        groups[checkId].penalty += Math.abs(weight);
        groups[checkId].activeErrors.push(makeSiteErrorForAdmin_(errorTime, zone, errorName, weight, comment));
        groups[checkId].errorDetails.push({
          errorId:text_(row[0]),
          error:errorName,
          errorText:errorText,
          comment:comment,
          managerComment:text_(row[14]),
          status:status,
          zone:zone,
          time:errorTime,
          weight:weight,
          level:weight >= 100 ? "D3" : (weight >= 50 ? "D2" : "D1")
        });
      }
    });

    return Object.keys(groups).map(checkId => {
      const g = groups[checkId];
      return {
        row:0,checkId:g.checkId,date:g.date,isoDate:g.isoDate,time:"",
        pizzeria:g.pizzeria,zone:"",type:"",
        score:Math.max(0,100-g.penalty),
        errors:g.activeErrors.join("; "),
        errorsCount:g.activeErrors.length,
        errorDetails:g.errorDetails,
        photo:"",inspector:g.inspector,comment:"",dynamic:"",errorTime:"",errorComment:""
      };
    });
  }

  const sheet = getOrCreateSheet_(ss, CONFIG.SHEET_SITE);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), 5)).getDisplayValues();
  return values.filter(row => text_(row[0]) && text_(row[1])).map((row, index) => ({
    row:index+2,date:text_(row[0]),isoDate:toIsoDateForAdmin_(row[0]),time:"",
    pizzeria:text_(row[1]),zone:"",type:"",
    score:Number(String(row[2] || "0").replace(",", ".")) || 0,
    errors:text_(row[3]),errorsCount:countErrorsInSiteCsvTextForAdmin_(row[3]),
    errorDetails:[],photo:"",inspector:text_(row[4]),comment:"",dynamic:"",errorTime:"",errorComment:""
  }));
}

function isErrorActiveForDashboard_(status) {
  const s = String(status || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .trim();

  // Пустой статус и "Активна" считаются активными.
  if (!s) return true;

  // Любая ошибка, удалённая после удовлетворённой апелляции,
  // полностью исключается из дашборда и пересчёта.
  if (s.indexOf("удал") >= 0) return false;
  if (s.indexOf("удовлетвор") >= 0) return false;

  return s === "активна" || s === "active";
}

function listChecksForAdmin_() {
  const checks = listSiteCsvChecksForAdmin_().sort((a, b) => String(b.isoDate).localeCompare(String(a.isoDate)) || String(a.pizzeria).localeCompare(String(b.pizzeria)));
  return { ok: true, checks };
}

function rebuildSiteCsvFromErrorsIdForAdmin_(ss) {
  const errorsSheet = ss.getSheetByName(CONFIG.SHEET_ERROR_ID);
  const siteSheet = getOrCreateSheet_(ss, CONFIG.SHEET_SITE);
  const checksSheet = getOrCreateSheet_(ss, CONFIG.SHEET_CHECKS);
  ensureHeader_(siteSheet, ADMIN_SITE_HEADERS);
  ensureHeader_(checksSheet, ADMIN_CHECKS_HEADERS);
  const siteOut = [ADMIN_SITE_HEADERS];
  const checkOut = [];
  if (!errorsSheet || errorsSheet.getLastRow() <= 1) {
    siteSheet.clear();
    siteSheet.getRange(1, 1, 1, ADMIN_SITE_HEADERS.length).setValues([ADMIN_SITE_HEADERS]);
    return;
  }
  const rows = errorsSheet.getRange(2, 1, errorsSheet.getLastRow() - 1, ADMIN_ERRORS_ID_HEADERS.length).getDisplayValues();
  const groups = {};
  rows.forEach(row => {
    const checkId = text_(row[1]);
    const date = text_(row[2]);
    const pizzeria = text_(row[3]);
    const inspector = text_(row[4]);
    const zone = text_(row[5]);
    const errorTime = text_(row[6]);
    const errorName = text_(row[7]);
    const weight = Number(String(row[8] || "0").replace(",", ".").match(/\d+/)?.[0] || 0);
    const comment = text_(row[9]);
    const status = text_(row[10]);
    if (!checkId || !date || !pizzeria) return;
    if (!groups[checkId]) groups[checkId] = { date, pizzeria, inspector, zone, penalty: 0, errors: [] };
    if (isErrorActiveForDashboard_(status)) {
      groups[checkId].penalty += Math.abs(weight);
      groups[checkId].errors.push({ zone, errorTime, errorName, weight, comment });
    }
  });
  Object.keys(groups).forEach(checkId => {
    const group = groups[checkId];
    const finalScore = Math.max(0, 100 - group.penalty);
    if (group.errors.length) {
      const errorsText = group.errors.map(item => makeSiteErrorForAdmin_(item.errorTime, item.zone, item.errorName, item.weight, item.comment));
      group.errors.forEach(item => {
        const siteError = makeSiteErrorForAdmin_(item.errorTime, item.zone, item.errorName, item.weight, item.comment);
        checkOut.push([group.date, "", group.pizzeria, item.zone || group.zone, "Плановая", finalScore, siteError, "", group.inspector, "", 0, item.errorTime, item.comment, siteError, "", ""]);
      });
      siteOut.push([group.date, group.pizzeria, finalScore, errorsText.join("; "), group.inspector]);
    } else {
      checkOut.push([group.date, "", group.pizzeria, group.zone || "", "Плановая", 100, "", "", group.inspector, "", 0, "", "", "", "", ""]);
      siteOut.push([group.date, group.pizzeria, 100, "", group.inspector]);
    }
  });
  siteSheet.clear();
  siteSheet.getRange(1, 1, siteOut.length, ADMIN_SITE_HEADERS.length).setValues(siteOut);
  siteSheet.setFrozenRows(1);
  if (checksSheet.getLastRow() > 1) checksSheet.getRange(2, 1, checksSheet.getLastRow() - 1, ADMIN_CHECKS_HEADERS.length).clearContent();
  if (checkOut.length) checksSheet.getRange(2, 1, checkOut.length, ADMIN_CHECKS_HEADERS.length).setValues(checkOut);
}

function forceRebuildDashboardData() {
  const ss = getSpreadsheet_();
  rebuildSiteCsvFromErrorsIdForAdmin_(ss);
  SpreadsheetApp.flush();
  Logger.log("SITE_CSV и Проверки пересобраны. Дашборд теперь берёт только активные ошибки.");
  return "SITE_CSV и Проверки пересобраны. Дашборд теперь берёт только активные ошибки.";
}

function getAdminDashboard_() {
  const checksData = listSiteCsvChecksForAdmin_();
  const appealsData = listAppealsForAdmin_().appeals || [];
  const pizzerias = {};
  checksData.forEach(c => {
    if (!c.pizzeria) return;
    if (!pizzerias[c.pizzeria]) pizzerias[c.pizzeria] = { count: 0, scoreSum: 0, errors: 0 };
    pizzerias[c.pizzeria].count++;
    pizzerias[c.pizzeria].scoreSum += Number(c.score || 0);
    pizzerias[c.pizzeria].errors += Number(c.errorsCount || 0);
  });
  const rating = Object.keys(pizzerias).map(name => {
    const item = pizzerias[name];
    return { pizzeria: name, checks: item.count, avgScore: item.count ? Math.round(item.scoreSum / item.count) : 0, errors: item.errors };
  }).sort((a, b) => b.avgScore - a.avgScore || a.pizzeria.localeCompare(b.pizzeria));
  return {
    ok: true,
    dashboard: {
      checksCount: checksData.length,
      errorsCount: checksData.reduce((sum, c) => sum + Number(c.errorsCount || 0), 0),
      appealsCount: appealsData.length,
      newAppeals: appealsData.filter(a => a.status === CONFIG.STATUS.NEW).length,
      inWorkAppeals: appealsData.filter(a => a.status === CONFIG.STATUS.IN_PROGRESS).length,
      closedAppeals: appealsData.filter(a => a.status === CONFIG.STATUS.APPROVED || a.status === CONFIG.STATUS.REJECTED).length,
      rating: rating,
      top3: rating.slice(0, 3),
      risk: rating.filter(r => r.avgScore < 85)
    }
  };
}


function saveManagerErrorCommentForAdmin_(payload) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(CONFIG.SHEET_ERROR_ID);
  if (!sheet) return { ok: false, message: "Лист Ошибки_ID не найден" };

  const errorId = text_(payload.errorId);
  const managerComment = text_(payload.managerComment);

  if (!errorId) return { ok: false, message: "Не передан ID ошибки" };

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { ok: false, message: "Ошибка не найдена" };

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  let rowNumber = null;

  for (let i = 0; i < ids.length; i++) {
    if (text_(ids[i][0]) === errorId) {
      rowNumber = i + 2;
      break;
    }
  }

  if (!rowNumber) return { ok: false, message: "Ошибка " + errorId + " не найдена" };

  // Колонка O — комментарий управляющего.
  sheet.getRange(rowNumber, 15).setValue(managerComment);
  sheet.getRange(rowNumber, 13).setValue(new Date());
  SpreadsheetApp.flush();

  return {
    ok: true,
    errorId: errorId,
    managerComment: managerComment,
    message: "Комментарий управляющего сохранён"
  };
}

function getPeriodReportForAdmin_(payload) {
  const ss = getSpreadsheet_();
  const errorsSheet = ss.getSheetByName(CONFIG.SHEET_ERROR_ID);

  const dateFrom = normalizeDateForReport_(payload.dateFrom);
  const dateTo = normalizeDateForReport_(payload.dateTo);

  if (!dateFrom || !dateTo) {
    return { ok: false, message: "Выберите дату начала и дату окончания периода" };
  }
  if (dateFrom > dateTo) {
    return { ok: false, message: "Дата начала не может быть позже даты окончания" };
  }

  // Текущие итоги проверок (с учётом удовлетворённых апелляций).
  const checks = listSiteCsvChecksForAdmin_().filter(c => {
    const iso = normalizeDateForReport_(c.isoDate || c.date);
    return iso && iso >= dateFrom && iso <= dateTo;
  });

  const summaryMap = {};
  checks.forEach(c => {
    if (!c.pizzeria) return;
    if (!summaryMap[c.pizzeria]) {
      summaryMap[c.pizzeria] = {
        pizzeria: c.pizzeria,
        checks: 0,
        scoreSum: 0,
        activeErrors: 0
      };
    }
    const s = summaryMap[c.pizzeria];
    s.checks++;
    s.scoreSum += Number(c.score || 0);
    s.activeErrors += Number(c.errorsCount || 0);
  });

  // Все когда-либо зафиксированные ошибки за период — даже если позже апелляция удовлетворена.
  const errorRows = [];
  if (errorsSheet && errorsSheet.getLastRow() > 1) {
    const values = errorsSheet
      .getRange(2, 1, errorsSheet.getLastRow() - 1, ADMIN_ERRORS_ID_HEADERS.length)
      .getDisplayValues();

    values.forEach(row => {
      const iso = normalizeDateForReport_(row[2]);
      if (!iso || iso < dateFrom || iso > dateTo) return;

      const weight = Number(String(row[8] || "0").replace(",", ".").match(/\d+/)?.[0] || 0);
      const status = text_(row[10]);
      const appealId = text_(row[11]);

      errorRows.push({
        errorId: text_(row[0]),
        checkId: text_(row[1]),
        date: text_(row[2]),
        isoDate: iso,
        pizzeria: text_(row[3]),
        inspector: text_(row[4]),
        zone: text_(row[5]),
        time: text_(row[6]),
        error: text_(row[7]),
        weight: weight,
        level: weight >= 100 ? "D3" : (weight >= 50 ? "D2" : "D1"),
        inspectorComment: text_(row[9]),
        status: status || "Активна",
        appealId: appealId,
        controlComment: text_(row[13]),
        managerComment: text_(row[14])
      });

      if (!summaryMap[text_(row[3])]) {
        summaryMap[text_(row[3])] = {
          pizzeria: text_(row[3]),
          checks: 0,
          scoreSum: 0,
          activeErrors: 0
        };
      }
    });
  }

  // Дополняем сводку количеством всех зафиксированных ошибок, D2/D3 и удалённых по апелляции.
  const totalsByPizza = {};
  errorRows.forEach(e => {
    if (!totalsByPizza[e.pizzeria]) {
      totalsByPizza[e.pizzeria] = { totalErrors: 0, d2: 0, d3: 0, approvedAppeals: 0 };
    }
    const t = totalsByPizza[e.pizzeria];
    t.totalErrors++;
    if (e.level === "D2") t.d2++;
    if (e.level === "D3") t.d3++;
    if (!isErrorActiveForDashboard_(e.status)) t.approvedAppeals++;
  });

  const summary = Object.keys(summaryMap).filter(Boolean).map(name => {
    const s = summaryMap[name];
    const t = totalsByPizza[name] || { totalErrors: 0, d2: 0, d3: 0, approvedAppeals: 0 };
    return {
      pizzeria: name,
      avgScore: s.checks ? Math.round((s.scoreSum / s.checks) * 10) / 10 : 0,
      checks: s.checks,
      activeErrors: s.activeErrors,
      totalErrors: t.totalErrors,
      d2: t.d2,
      d3: t.d3,
      approvedAppeals: t.approvedAppeals
    };
  }).sort((a, b) => b.avgScore - a.avgScore || a.pizzeria.localeCompare(b.pizzeria));

  errorRows.sort((a, b) =>
    String(a.pizzeria).localeCompare(String(b.pizzeria)) ||
    String(a.isoDate).localeCompare(String(b.isoDate)) ||
    String(a.time).localeCompare(String(b.time))
  );

  return {
    ok: true,
    dateFrom: dateFrom,
    dateTo: dateTo,
    summary: summary,
    errors: errorRows
  };
}

function normalizeDateForReport_(value) {
  const s = String(value || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
}

function getMonthlyAverageForAdmin_(payload) {
  const month = text_(payload.month) || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
  const checks = listSiteCsvChecksForAdmin_().filter(c => {
    const iso = c.isoDate || toIsoDateForAdmin_(c.date);
    return iso && String(iso).startsWith(month);
  });
  const grouped = {};
  checks.forEach(c => {
    if (!c.pizzeria) return;
    if (!grouped[c.pizzeria]) grouped[c.pizzeria] = { count: 0, scoreSum: 0, errors: 0 };
    grouped[c.pizzeria].count++;
    grouped[c.pizzeria].scoreSum += Number(c.score || 0);
    grouped[c.pizzeria].errors += Number(c.errorsCount || 0);
  });
  const rows = Object.keys(grouped).map(name => {
    const item = grouped[name];
    return { month: month, pizzeria: name, avgScore: item.count ? Math.round((item.scoreSum / item.count) * 10) / 10 : 0, checks: item.count, errors: item.errors };
  }).sort((a, b) => b.avgScore - a.avgScore || a.pizzeria.localeCompare(b.pizzeria));
  return { ok: true, month: month, rows: rows };
}

function ensureAppealsSheetForAdmin_(sheet) {
  ensureHeader_(sheet, ADMIN_APPEALS_HEADERS);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList([CONFIG.STATUS.NEW, CONFIG.STATUS.IN_PROGRESS, CONFIG.STATUS.APPROVED, CONFIG.STATUS.REJECTED], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, ADMIN_APPEAL_COL.STATUS, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule);
}

function createAppealFromSiteForAdmin_(payload) {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, CONFIG.SHEET_APPEALS);
  ensureAppealsSheetForAdmin_(sheet);
  const appealId = createAppealIdForAdmin_(sheet);
  const saveResult = saveAppealFilesForAdminSafe_(payload.attachments || []);
  let errorId = payload.errorId || payload.idError || payload.error_id || "";
  if (!errorId) {
    try {
      const errorsSheet = ss.getSheetByName(CONFIG.SHEET_ERROR_ID);
      if (errorsSheet) {
        const foundRow = findErrorIdRowForAppeal_(errorsSheet, {
          errorId: "",
          date: payload.displayDate || payload.date || "",
          pizzeria: payload.pizzeria || "",
          errorText: payload.errors || payload.error || ""
        });
        if (foundRow) errorId = text_(errorsSheet.getRange(foundRow, 1).getDisplayValue());
      }
    } catch (e) {
      // Не мешаем подаче апелляции, если ID не удалось определить.
    }
  }
  let filesText = saveResult.links.join("\n");
  if (saveResult.errors.length) filesText += (filesText ? "\n" : "") + "Файлы не сохранены: " + saveResult.errors.join("; ");
  sheet.appendRow([
    appealId,
    errorId,
    new Date(),
    payload.period || "",
    payload.displayDate || payload.date || "",
    payload.pizzeria || "",
    payload.score || "",
    payload.errors || payload.error || "",
    payload.comment || "",
    payload.replyEmail || payload.email || "",
    payload.inspector || "",
    filesText,
    "",
    CONFIG.STATUS.NEW,
    "",
    "",
    "",
    ""
  ]);
  logAppealAction_(ss, appealId, "Создана апелляция", payload.replyEmail || payload.email || "");
  return json_({ ok: true, appealId: appealId, message: "Апелляция сохранена", filesSaved: saveResult.links.length, fileErrors: saveResult.errors });
}

function saveAppealFilesForAdminSafe_(attachments) {
  const result = { links: [], errors: [] };
  if (!attachments || !attachments.length) return result;
  if (!CONFIG.DRIVE_FOLDER_ID || CONFIG.DRIVE_FOLDER_ID.indexOf("ВСТАВЬТЕ") >= 0) {
    result.errors.push("не указан DRIVE_FOLDER_ID");
    return result;
  }
  let folder;
  try { folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID); }
  catch (e) { result.errors.push("нет доступа к папке Drive"); return result; }
  attachments.forEach(file => {
    try {
      if (!file || !file.base64) return;
      const bytes = Utilities.base64Decode(file.base64);
      const blob = Utilities.newBlob(bytes, file.type || "application/octet-stream", file.name || "file");
      const savedFile = folder.createFile(blob);
      result.links.push(savedFile.getUrl());
    } catch (e) {
      result.errors.push((file && file.name ? file.name + ": " : "") + e.message);
    }
  });
  return result;
}

function createAppealIdForAdmin_(sheet) {
  const year = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy");
  let maxNumber = 0;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const ids = sheet.getRange(2, ADMIN_APPEAL_COL.ID, lastRow - 1, 1).getDisplayValues();
    ids.forEach(row => {
      const match = String(row[0] || "").match(/APL-\d{4}-(\d+)/);
      if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
    });
  }
  return "APL-" + year + "-" + String(maxNumber + 1).padStart(6, "0");
}

function listAppealsForAdmin_() {
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet_(ss, CONFIG.SHEET_APPEALS);
  ensureAppealsSheetForAdmin_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { ok: true, appeals: [] };
  const rows = sheet.getRange(2, 1, lastRow - 1, ADMIN_APPEALS_HEADERS.length).getDisplayValues();
  const appeals = rows.filter(row => text_(row[ADMIN_APPEAL_COL.ID - 1])).map(row => ({
    id: row[ADMIN_APPEAL_COL.ID - 1],
    errorId: row[ADMIN_APPEAL_COL.ERROR_ID - 1],
    createdAt: row[ADMIN_APPEAL_COL.CREATED_AT - 1],
    period: row[ADMIN_APPEAL_COL.PERIOD - 1],
    checkDate: row[ADMIN_APPEAL_COL.CHECK_DATE - 1],
    pizzeria: row[ADMIN_APPEAL_COL.PIZZERIA - 1],
    score: row[ADMIN_APPEAL_COL.SCORE - 1],
    error: row[ADMIN_APPEAL_COL.ERROR - 1],
    managerComment: row[ADMIN_APPEAL_COL.MANAGER_COMMENT - 1],
    email: row[ADMIN_APPEAL_COL.EMAIL - 1],
    inspector: row[ADMIN_APPEAL_COL.INSPECTOR - 1],
    files: row[ADMIN_APPEAL_COL.FILES - 1],
    controlComment: row[ADMIN_APPEAL_COL.CONTROL_COMMENT - 1],
    status: row[ADMIN_APPEAL_COL.STATUS - 1],
    decisionDate: row[ADMIN_APPEAL_COL.DECISION_DATE - 1],
    emailSent: row[ADMIN_APPEAL_COL.EMAIL_SENT - 1],
    changedBy: row[ADMIN_APPEAL_COL.CHANGED_BY - 1],
    changedAt: row[ADMIN_APPEAL_COL.CHANGED_AT - 1]
  })).reverse();
  return { ok: true, appeals: appeals };
}

function updateAppealFromAdmin_(payload) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(CONFIG.SHEET_APPEALS);
  if (!sheet) return { ok: false, message: "Лист Апелляции не найден" };
  ensureAppealsSheetForAdmin_(sheet);
  const appealId = text_(payload.id);
  if (!appealId) return { ok: false, message: "Не передан номер апелляции" };
  const row = findAppealRowByIdForAdmin_(sheet, appealId);
  if (!row) return { ok: false, message: "Апелляция не найдена" };
  const currentStatus = text_(sheet.getRange(row, ADMIN_APPEAL_COL.STATUS).getDisplayValue());
  if (currentStatus === CONFIG.STATUS.APPROVED || currentStatus === CONFIG.STATUS.REJECTED) {
    return {
      ok: false,
      message: "Апелляция уже обработана: " + currentStatus + ". Изменение решения запрещено."
    };
  }

  const status = text_(payload.status);
  const comment = text_(payload.controlComment);
  if (!comment) return { ok: false, message: "Заполните комментарий контролинга" };
  if (status !== CONFIG.STATUS.NEW && status !== CONFIG.STATUS.IN_PROGRESS && status !== CONFIG.STATUS.APPROVED && status !== CONFIG.STATUS.REJECTED) {
    return { ok: false, message: "Некорректный статус" };
  }
  sheet.getRange(row, ADMIN_APPEAL_COL.CONTROL_COMMENT).setValue(comment);
  sheet.getRange(row, ADMIN_APPEAL_COL.STATUS).setValue(status);
  sheet.getRange(row, ADMIN_APPEAL_COL.CHANGED_BY).setValue(payload.actorEmail || payload.actorName || Session.getActiveUser().getEmail() || "site");
  sheet.getRange(row, ADMIN_APPEAL_COL.CHANGED_AT).setValue(new Date());
  if (status === CONFIG.STATUS.APPROVED || status === CONFIG.STATUS.REJECTED) {
    updateErrorIdStatusAfterAppealForAdmin_(ss, appealId, status, comment);
    rebuildSiteCsvFromErrorsIdForAdmin_(ss);
    sendAppealDecisionEmailSafeForAdmin_(sheet, row);
  }
  logAppealAction_(ss, appealId, "Обновлено через кабинет: " + status, payload.actorEmail || payload.actorName || Session.getActiveUser().getEmail() || "site");
  return { ok: true, message: "Апелляция обновлена" };
}

function findAppealRowByIdForAdmin_(sheet, appealId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  const ids = sheet.getRange(2, ADMIN_APPEAL_COL.ID, lastRow - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) {
    if (text_(ids[i][0]) === appealId) return i + 2;
  }
  return null;
}

function updateErrorIdStatusAfterAppealForAdmin_(ss, appealId, status, controlComment) {
  const appeals = ss.getSheetByName(CONFIG.SHEET_APPEALS);
  const errorsSheet = ss.getSheetByName(CONFIG.SHEET_ERROR_ID);

  if (!appeals || !errorsSheet) return;

  const appealRow = findAppealRowByIdForAdmin_(appeals, appealId);
  if (!appealRow) return;

  const appealValues = appeals.getRange(appealRow, 1, 1, ADMIN_APPEALS_HEADERS.length).getDisplayValues()[0];

  const appealErrorId = text_(appealValues[ADMIN_APPEAL_COL.ERROR_ID - 1]);
  const appealDate = text_(appealValues[ADMIN_APPEAL_COL.CHECK_DATE - 1]);
  const appealPizzeria = text_(appealValues[ADMIN_APPEAL_COL.PIZZERIA - 1]);
  const appealErrorText = text_(appealValues[ADMIN_APPEAL_COL.ERROR - 1]);

  const newStatus = status === CONFIG.STATUS.APPROVED
    ? "Удалена по апелляции"
    : "Активна";

  const targetRow = findErrorIdRowForAppeal_(errorsSheet, {
    errorId: appealErrorId,
    date: appealDate,
    pizzeria: appealPizzeria,
    errorText: appealErrorText
  });

  if (!targetRow) {
    throw new Error(
      "Не удалось найти связанную ошибку в листе Ошибки_ID. " +
      "Проверьте, что в апелляции указаны пиццерия, дата и текст нарушения."
    );
  }

  errorsSheet.getRange(targetRow, 11).setValue(newStatus);
  errorsSheet.getRange(targetRow, 12).setValue(appealId);
  errorsSheet.getRange(targetRow, 13).setValue(new Date());
  errorsSheet.getRange(targetRow, 14).setValue(controlComment);
}

function findErrorIdRowForAppeal_(errorsSheet, params) {
  const lastRow = errorsSheet.getLastRow();
  if (lastRow <= 1) return null;

  const rows = errorsSheet.getRange(2, 1, lastRow - 1, ADMIN_ERRORS_ID_HEADERS.length).getDisplayValues();

  // 1. Самый точный вариант — по ID ошибки
  if (params.errorId) {
    for (let i = 0; i < rows.length; i++) {
      if (text_(rows[i][0]) === text_(params.errorId)) {
        return i + 2;
      }
    }
  }

  // 2. Если ID ошибки в апелляции пустой — ищем по пиццерии + дате + тексту ошибки
  const appealDate = normalizeDateForMatch_(params.date);
  const appealPizzeria = normalizeHeader_(params.pizzeria);
  const appealError = normalizeAppealErrorForMatch_(params.errorText);
  const appealWeight = extractWeightForMatch_(params.errorText);
  const appealTime = extractTimeForMatch_(params.errorText);

  let bestRow = null;
  let bestScore = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const rowDate = normalizeDateForMatch_(row[2]);
    const rowPizzeria = normalizeHeader_(row[3]);
    const rowZone = text_(row[5]);
    const rowTime = text_(row[6]);
    const rowErrorName = text_(row[7]);
    const rowWeight = extractWeightForMatch_(row[8]);
    const rowComment = text_(row[9]);

    if (appealPizzeria && rowPizzeria !== appealPizzeria) continue;
    if (appealDate && rowDate && rowDate !== appealDate) continue;

    const rowFullText = normalizeAppealErrorForMatch_(
      makeSiteErrorForAdmin_(rowTime, rowZone, rowErrorName, rowWeight, rowComment)
    );
    const rowNameText = normalizeAppealErrorForMatch_(rowErrorName);

    let score = 0;

    if (appealTime && normalizeTimeForMatch_(rowTime) === normalizeTimeForMatch_(appealTime)) score += 4;
    if (appealWeight && rowWeight && Number(appealWeight) === Number(rowWeight)) score += 4;
    if (rowNameText && appealError.indexOf(rowNameText) >= 0) score += 6;
    if (rowFullText && appealError.indexOf(rowFullText) >= 0) score += 8;
    if (rowFullText && rowFullText.indexOf(appealError) >= 0) score += 5;

    // На случай если в тексте апелляции есть только часть нарушения
    const rowWords = rowNameText.split(" ").filter(w => w.length > 3);
    const matchedWords = rowWords.filter(w => appealError.indexOf(w) >= 0).length;
    if (matchedWords) score += Math.min(4, matchedWords);

    if (score > bestScore) {
      bestScore = score;
      bestRow = i + 2;
    }
  }

  return bestScore >= 4 ? bestRow : null;
}

function normalizeDateForMatch_(value) {
  const s = String(value || "").trim();

  let m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  return s;
}

function normalizeTimeForMatch_(value) {
  const s = String(value || "").trim();
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return "";
  return String(m[1]).padStart(2, "0") + ":" + m[2] + ":" + (m[3] || "00");
}

function extractTimeForMatch_(value) {
  const s = String(value || "");
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return m ? normalizeTimeForMatch_(m[0]) : "";
}

function extractWeightForMatch_(value) {
  const s = String(value || "");
  const m = s.match(/-?(\d+)/);
  return m ? Math.abs(Number(m[1])) : 0;
}

function normalizeAppealErrorForMatch_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .replace(/[—–]/g, "-")
    .replace(/[()]/g, "")
    .trim();
}

function repairAppealsAndScores() {
  const ss = getSpreadsheet_();
  const appeals = ss.getSheetByName(CONFIG.SHEET_APPEALS);
  if (!appeals || appeals.getLastRow() <= 1) {
    Logger.log("Апелляций нет");
    return "Апелляций нет";
  }

  let processed = 0;
  let skipped = 0;
  let errors = [];

  const values = appeals.getRange(2, 1, appeals.getLastRow() - 1, ADMIN_APPEALS_HEADERS.length).getDisplayValues();

  values.forEach(row => {
    const appealId = text_(row[ADMIN_APPEAL_COL.ID - 1]);
    const status = text_(row[ADMIN_APPEAL_COL.STATUS - 1]);
    const comment = text_(row[ADMIN_APPEAL_COL.CONTROL_COMMENT - 1]) || "Пересчёт выполнен";

    if (!appealId) return;

    if (status === CONFIG.STATUS.APPROVED || status === CONFIG.STATUS.REJECTED) {
      try {
        updateErrorIdStatusAfterAppealForAdmin_(ss, appealId, status, comment);
        processed++;
      } catch (e) {
        errors.push(appealId + ": " + e.message);
      }
    } else {
      skipped++;
    }
  });

  rebuildSiteCsvFromErrorsIdForAdmin_(ss);

  const result =
    "Пересчёт завершён\n" +
    "Обработано: " + processed + "\n" +
    "Пропущено: " + skipped + "\n" +
    (errors.length ? "Ошибки:\n" + errors.join("\n") : "Ошибок нет");

  Logger.log(result);
  return result;
}


function sendAppealDecisionEmailSafeForAdmin_(sheet, row) {
  const values = sheet.getRange(row, 1, 1, ADMIN_APPEALS_HEADERS.length).getDisplayValues()[0];

  const appealId = values[ADMIN_APPEAL_COL.ID - 1] || "";
  const pizzeria = values[ADMIN_APPEAL_COL.PIZZERIA - 1] || "";
  const score = values[ADMIN_APPEAL_COL.SCORE - 1] || "";
  const errorText = values[ADMIN_APPEAL_COL.ERROR - 1] || "";
  const managerComment = values[ADMIN_APPEAL_COL.MANAGER_COMMENT - 1] || "";
  const email = extractEmailForAdmin_(values[ADMIN_APPEAL_COL.EMAIL - 1]);
  const controlComment = values[ADMIN_APPEAL_COL.CONTROL_COMMENT - 1] || "";
  const status = values[ADMIN_APPEAL_COL.STATUS - 1] || "";

  if (!email) throw new Error("Email не найден. В листе «Апелляции» email должен быть в колонке J.");
  if (status !== CONFIG.STATUS.APPROVED && status !== CONFIG.STATUS.REJECTED) return;
  if (!controlComment) throw new Error("Заполните комментарий контролинга");

  const emailSentCell = sheet.getRange(row, ADMIN_APPEAL_COL.EMAIL_SENT);
  if (text_(emailSentCell.getDisplayValue())) return;

  const approved = status === CONFIG.STATUS.APPROVED;
  const subject = approved
    ? "✅ Апелляция удовлетворена — " + appealId
    : "ℹ️ Решение по апелляции — " + appealId;

  const plainBody =
    "Добрый день!\n\n" +
    "По вашей апелляции принято решение.\n\n" +
    "№ апелляции: " + appealId + "\n" +
    "Пиццерия: " + pizzeria + "\n" +
    "Балл: " + score + "\n" +
    "Статус: " + status + "\n\n" +
    "Нарушение:\n" + errorText + "\n\n" +
    "Комментарий управляющего:\n" + managerComment + "\n\n" +
    "Комментарий контролинга:\n" + controlComment + "\n\n" +
    "С уважением,\nКонтролинг сети";

  const htmlBody = buildAppealDecisionHtmlEmail_({
    appealId,
    pizzeria,
    score,
    status,
    approved,
    errorText,
    managerComment,
    controlComment
  });

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: plainBody,
    htmlBody: htmlBody,
    name: "Dodo Control"
  });

  sheet.getRange(row, ADMIN_APPEAL_COL.DECISION_DATE).setValue(new Date());
  emailSentCell.setValue("Отправлено: " + email);
}

function buildAppealDecisionHtmlEmail_(data) {
  const statusColor = data.approved ? "#16a34a" : "#dc2626";
  const statusBg = data.approved ? "#dcfce7" : "#fee2e2";
  const statusText = data.approved ? "Апелляция удовлетворена" : "Апелляция не удовлетворена";
  const statusIcon = data.approved ? "✅" : "❌";
  const mainMessage = data.approved
    ? "Баллы по подтверждённой ошибке будут возвращены, а показатели проверки пересчитаны автоматически."
    : "Нарушение остаётся в проверке, итоговый балл не изменяется.";

  return `
  <div style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="620" cellspacing="0" cellpadding="0" style="width:620px;max-width:94%;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,.12);">
            <tr>
              <td style="background:linear-gradient(135deg,#ff6900,#ff8a2a);padding:26px 30px;color:#ffffff;">
                <div style="font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">Dodo Control</div>
                <div style="font-size:30px;font-weight:900;margin-top:6px;line-height:1.15;">Решение по апелляции</div>
                <div style="font-size:15px;margin-top:8px;opacity:.95;">Контролинг сети · ${escapeHtmlEmail_(data.pizzeria)}</div>
              </td>
            </tr>

            <tr>
              <td style="padding:26px 30px 8px;">
                <div style="display:inline-block;background:${statusBg};color:${statusColor};border-radius:999px;padding:10px 16px;font-size:15px;font-weight:900;">
                  ${statusIcon} ${statusText}
                </div>

                <p style="font-size:16px;line-height:1.55;margin:20px 0 0;color:#374151;">
                  Добрый день! По вашей апелляции принято решение.
                </p>

                <p style="font-size:15px;line-height:1.55;margin:10px 0 0;color:#4b5563;">
                  ${mainMessage}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 30px 0;">
                <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 10px;">
                  ${emailInfoRow_("№ апелляции", data.appealId)}
                  ${emailInfoRow_("Пиццерия", data.pizzeria)}
                  ${emailInfoRow_("Балл до решения", data.score)}
                  ${emailInfoRow_("Итоговый статус", data.status)}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 30px;">
                ${emailBlock_("Нарушение", data.errorText, "#fff7ed", "#ff6900")}
                ${emailBlock_("Комментарий управляющего", data.managerComment || "—", "#f8fafc", "#64748b")}
                ${emailBlock_("Комментарий контролинга", data.controlComment || "—", "#f0fdf4", "#16a34a")}
              </td>
            </tr>

            <tr>
              <td style="padding:0 30px 26px;">
                <div style="background:#111827;color:#ffffff;border-radius:18px;padding:18px 20px;">
                  <div style="font-size:17px;font-weight:900;margin-bottom:6px;">Спасибо за обратную связь</div>
                  <div style="font-size:14px;line-height:1.5;color:#d1d5db;">
                    Апелляции помогают нам точнее оценивать проверки и поддерживать единый стандарт качества в сети.
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 30px;text-align:center;">
                <div style="font-size:13px;color:#6b7280;">С уважением, команда контролинга сети</div>
                <div style="font-size:13px;color:#ff6900;font-weight:900;margin-top:4px;">Dodo Control</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

function emailInfoRow_(label, value) {
  return `
    <tr>
      <td style="width:190px;background:#f9fafb;border:1px solid #e5e7eb;border-right:0;border-radius:14px 0 0 14px;padding:12px 14px;color:#6b7280;font-size:14px;font-weight:700;">
        ${escapeHtmlEmail_(label)}
      </td>
      <td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:0 14px 14px 0;padding:12px 14px;color:#111827;font-size:14px;font-weight:900;">
        ${escapeHtmlEmail_(value || "—")}
      </td>
    </tr>`;
}

function emailBlock_(title, text, bg, accent) {
  return `
    <div style="background:${bg};border-left:5px solid ${accent};border-radius:16px;padding:16px 18px;margin:0 0 12px;">
      <div style="font-size:13px;font-weight:900;color:${accent};text-transform:uppercase;letter-spacing:.04em;margin-bottom:7px;">
        ${escapeHtmlEmail_(title)}
      </div>
      <div style="font-size:15px;line-height:1.55;color:#1f2937;white-space:pre-line;">
        ${escapeHtmlEmail_(text || "—")}
      </div>
    </div>`;
}

function escapeHtmlEmail_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function logAppealAction_(ss, appealId, action, actor) {
  const sheet = getOrCreateSheet_(ss, CONFIG.SHEET_APPEAL_LOG);
  ensureHeader_(sheet, ["Дата", "№ апелляции", "Действие", "Пользователь"]);
  sheet.appendRow([new Date(), appealId, action, actor || Session.getActiveUser().getEmail() || ""]);
}
