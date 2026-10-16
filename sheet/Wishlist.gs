/**
 * Wishlist Shop: the optional "Wishlist" menu for your Google Sheet.
 * https://github.com/nicolenadine/wishlist  (GPL-3.0)
 *
 * What this script can do, and nothing else:
 *   - Check for updates: download the public list of sheet changes from
 *     UPDATES_URL and, if you say yes, add the rows, dropdowns or tabs it lists.
 *     The list is plain data. It can only ask for the actions written below
 *     (see ACTIONS); it can't run any new code.
 *   - Set up gift claiming: make a Google Form in your Drive, connect it to this
 *     sheet, hide the tabs that show purchases, and fill in the claiming rows on
 *     your Settings tab (Enable item claiming, Claim form link, and Claims tab
 *     link when it's needed).
 *   - Show a short note when you open the sheet and an update is waiting.
 *
 * It never sends anything from your sheet anywhere. The only web request it makes
 * is downloading UPDATES_URL, and appsscript.json only allows this project's site.
 * It can't send email or look through your Google Drive.
 */

const SCRIPT_VERSION = 3;
const UPDATES_URL = 'https://nicolenadine.github.io/wishlist/sheet/updates.json';
const DOCS_URL = 'https://github.com/nicolenadine/wishlist/blob/main/docs/sheet-menu.md';
const SETTINGS_TAB = 'Settings';
// The public template. Gift claiming is never set up there, or every copy would share its form.
const TEMPLATE_ID = '1xcYWpix2X1ZDpUfDu7IXhiKeWtpUENBPletfdRZQ8g8';

// ---------- menu ----------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Wishlist')
    .addItem('Check for updates', 'checkForUpdates')
    .addItem('Set up gift claiming', 'setUpClaiming')
    .addSeparator()
    .addItem('About this menu', 'about')
    .addToUi();
}

function about() {
  SpreadsheetApp.getUi().alert(
    'Wishlist menu (version ' + SCRIPT_VERSION + ')',
    'Check for updates: adds anything new to your sheet, like a new setting. Nothing changes until you say yes.\n\n' +
    'Set up gift claiming: makes your claim form and connects it for you.\n\n' +
    'More about this menu, including what it can and can\'t do:\n' + DOCS_URL,
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// ---------- updates ----------

function checkForUpdates() {
  const ui = SpreadsheetApp.getUi();
  turnOnUpdateNotes_();
  let list;
  try { list = fetchUpdates_(); } catch (e) {
    ui.alert('Couldn\'t check for updates', 'The update list couldn\'t be downloaded. Try again in a few minutes.\n\n(' + e.message + ')', ui.ButtonSet.OK);
    return;
  }
  const pending = pendingUpdates_(list);
  const newerMenu = list.menuVersion && list.menuVersion > SCRIPT_VERSION
    ? '\n\nA newer version of this menu is available. See ' + DOCS_URL + ' to update it.' : '';

  if (!pending.length) {
    ui.alert('Your sheet is up to date ✓', 'There\'s nothing new to add.' + newerMenu, ui.ButtonSet.OK);
    return;
  }
  const text = pending.map((u) => '• ' + u.title + (u.about ? '\n   ' + u.about : '')).join('\n\n');
  const answer = ui.alert(
    pending.length === 1 ? '1 update for your sheet' : pending.length + ' updates for your sheet',
    text + '\n\nThese only add things. Nothing you\'ve typed is changed or removed.\n\nAdd ' + (pending.length === 1 ? 'it' : 'them') + ' now?' + newerMenu,
    ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;

  const failed = [];
  pending.forEach((u) => u.ops.forEach((op) => {
    const action = ACTIONS[op.op];
    try { if (action && !action.done(op)) action.apply(op); } catch (e) { failed.push(u.title + ': ' + e.message); }
  }));
  SpreadsheetApp.flush();
  if (failed.length) ui.alert('Some updates didn\'t finish', failed.join('\n') + '\n\nYou can add these by hand: see the Sheet changes page.', ui.ButtonSet.OK);
  else ui.alert('All done ✓', 'Your sheet is up to date. Changes show on your site within about 5 minutes.', ui.ButtonSet.OK);
}

function fetchUpdates_() {
  const res = UrlFetchApp.fetch(UPDATES_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
  const list = JSON.parse(res.getContentText());
  if (!list || !Array.isArray(list.updates)) throw new Error('unexpected format');
  return list;
}

// An update is pending when any of its actions isn't done yet. Actions this version
// doesn't know are skipped (a newer menu handles them).
function pendingUpdates_(list) {
  return list.updates
    .map((u) => Object.assign({}, u, { ops: (u.ops || []).filter((op) => ACTIONS[op.op]) }))
    .filter((u) => u.ops.some((op) => !ACTIONS[op.op].done(op)));
}

// Every action can say whether it's already done, so updates never repeat or overwrite.
const ACTIONS = {
  // A row on the Settings tab: { name, value?, checkbox?, note? }
  settingRow: {
    done: (op) => Boolean(findSetting_(op.name)),
    apply: (op) => {
      const sh = settingsSheet_();
      const row = sh.getLastRow() + 1;
      sh.getRange(row, 1).setValue(op.name);
      const cell = sh.getRange(row, 2);
      if (op.checkbox) cell.insertCheckboxes();
      if (op.value != null) cell.setValue(op.value);
      if (op.note) sh.getRange(row, 1).setNote(op.note);
    },
  },
  // A hidden tab whose cell A1 holds a formula: { tab, formula }
  formulaTab: {
    done: (op) => Boolean(findTab_(op.tab)),
    apply: (op) => {
      const sh = SpreadsheetApp.getActiveSpreadsheet().insertSheet(op.tab, SpreadsheetApp.getActiveSpreadsheet().getNumSheets());
      sh.getRange('A1').setFormula(op.formula);
      sh.hideSheet();
    },
  },
  // A dropdown in a setting's value cell, from a range on another tab: { name, tab, range }
  settingDropdown: {
    done: (op) => { const c = settingCell_(op.name); return !c || Boolean(c.getDataValidation()); },
    apply: (op) => {
      const tab = findTab_(op.tab);
      if (!tab) throw new Error('the ' + op.tab + ' tab is missing');
      settingCell_(op.name).setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInRange(tab.getRange(op.range), true).setAllowInvalid(true).build());
    },
  },
};

// ---------- gift claiming ----------

function setUpClaiming() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getId() === TEMPLATE_ID) {
    ui.alert('This is the template', 'Gift claiming is set up in each person\'s own copy, not in the template. Make a copy first (File → Make a copy).', ui.ButtonSet.OK);
    return;
  }
  turnOnUpdateNotes_();

  const existing = settingCell_('Claim form link');
  if (existing && String(existing.getValue()).trim()) {
    const again = ui.alert('You already have a claim form link',
      'Make a new claim form and replace it? Purchases already recorded stay in your old responses tab, but the site will stop showing them.',
      ui.ButtonSet.YES_NO);
    if (again !== ui.Button.YES) return;
  }

  // 1. The form, with the three questions the site sends answers to.
  const form = FormApp.create('Wishlist claims');
  form.setDescription('Used by your wishlist site to record what gift-givers bought. Don\'t change the questions.');
  form.setCollectEmail(false);
  const items = ['item', 'quantity', 'ref'].map((t) => form.addTextItem().setTitle(t));
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // 2. Find the responses tab Google just added, hide it, and keep Items first.
  const responses = waitForResponsesTab_(ss, form.getId());
  if (!responses) throw new Error('The form was made, but its responses tab didn\'t appear. Reload the sheet and try again.');
  keepTabAtEnd_(ss, responses);
  responses.hideSheet();

  // 3. The pre-filled link carries the question ids the site needs.
  const pre = form.createResponse();
  items.forEach((it, i) => pre.withItemResponse(it.createResponse(['item', '1', 'ref'][i])));
  setSetting_('Claim form link', pre.toPrefilledUrl());

  // 4. Point the site at the responses: through the template's hidden log tab if it's
  //    free to use, otherwise with a Claims tab link row.
  const log = ss.getSheets().find((s) => /^claimed items/i.test(s.getName()) && !s.getFormUrl());
  if (log) log.getRange('A1').setFormula('={\'' + responses.getName().replace(/'/g, '\'\'') + '\'!A:D}');
  else setSetting_('Claims tab link', String(responses.getSheetId()));

  // 5. Hide every tab that shows purchases: the claims log and any form responses tabs.
  ss.getSheets().forEach((s) => {
    if (/^claimed items/i.test(s.getName()) || s.getFormUrl()) { try { s.hideSheet(); } catch (e) { /* already hidden */ } }
  });

  // 6. Switch it on.
  setSetting_('Enable item claiming', true, true);
  ss.setActiveSheet(settingsSheet_());
  SpreadsheetApp.flush();

  ui.alert('Gift claiming is set up ✓',
    'Your claim form "Wishlist claims" is in your Google Drive, and its responses go to a hidden "' + responses.getName() + '" tab.\n\n' +
    'The buttons appear on your site within about 5 minutes. Don\'t change the form\'s three questions.',
    ui.ButtonSet.OK);
}

function waitForResponsesTab_(ss, formId) {
  for (let i = 0; i < 15; i++) {
    SpreadsheetApp.flush();
    const tab = SpreadsheetApp.getActiveSpreadsheet().getSheets().find((s) => {
      const url = s.getFormUrl();
      if (!url) return false;
      try { return FormApp.openByUrl(url).getId() === formId; } catch (e) { return false; }
    });
    if (tab) return tab;
    Utilities.sleep(1000);
  }
  return null;
}

// Your site reads the first tab as your list, so new tabs go to the end.
function keepTabAtEnd_(ss, sheet) {
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(ss.getNumSheets());
}

// ---------- update notes on open ----------

// After the first time someone uses the menu, opening the sheet shows a small note
// in the corner when an update is waiting. (Triggers belong to each person's copy.)
function turnOnUpdateNotes_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const has = ScriptApp.getUserTriggers(ss).some((t) => t.getHandlerFunction() === 'noteUpdates');
    if (!has) ScriptApp.newTrigger('noteUpdates').forSpreadsheet(ss).onOpen().create();
  } catch (e) { /* the menu still works without the notes */ }
}

function noteUpdates() {
  try {
    const n = pendingUpdates_(fetchUpdates_()).length;
    if (n) SpreadsheetApp.getActiveSpreadsheet().toast(
      (n === 1 ? 'There\'s 1 update' : 'There are ' + n + ' updates') + ' for your sheet. Open Wishlist → Check for updates.', 'Wishlist', 15);
  } catch (e) { /* quietly try again next time */ }
}

// ---------- Settings tab helpers ----------

// Names match the way the site reads them: case, spaces and "(notes)" don't matter.
function norm_(s) { return String(s).replace(/\(.*?\)/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function settingsSheet_() {
  const sh = findTab_(SETTINGS_TAB);
  if (!sh) throw new Error('This sheet has no Settings tab');
  return sh;
}

function findTab_(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets().find((s) => norm_(s.getName()) === norm_(name)) || null;
}

function findSetting_(name) {
  const sh = findTab_(SETTINGS_TAB);
  if (!sh || !sh.getLastRow()) return 0;
  const names = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  const i = names.findIndex((r) => norm_(r[0]) === norm_(name));
  return i < 0 ? 0 : i + 1;
}

function settingCell_(name) {
  const row = findSetting_(name);
  return row ? settingsSheet_().getRange(row, 2) : null;
}

function setSetting_(name, value, checkbox) {
  if (!findSetting_(name)) ACTIONS.settingRow.apply({ name: name, checkbox: checkbox });
  const cell = settingCell_(name);
  if (checkbox && !cell.getDataValidation()) cell.insertCheckboxes();
  cell.setValue(value);
}
