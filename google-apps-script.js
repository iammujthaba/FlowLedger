/**
 * =========================================================================
 * FlowLedger Google Apps Script Backend
 * =========================================================================
 * 
 * INSTRUCTIONS TO DEPLOY:
 * 1. Open Google Sheets (create a new blank spreadsheet, e.g., "FlowLedger DB").
 * 2. In the menu, go to Extensions > Apps Script.
 * 3. Delete any code in the editor and paste this entire file.
 * 4. Click the "Save" icon.
 * 5. Click "Deploy" > "New deployment".
 * 6. Click the gear icon (Select type) > "Web app".
 * 7. Set:
 *    - Description: "FlowLedger API"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (crucial so your phone and PC can sync)
 * 8. Click "Deploy" and authorize the script when prompted.
 * 9. Copy the "Web app URL" (ends in /exec) and paste it into the FlowLedger app settings!
 * =========================================================================
 */

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets(ss);

  const action = e.parameter.action || 'pull';
  const since = e.parameter.since || '';

  if (action === 'pull') {
    const transactions = getSheetData(ss.getSheetByName('Transactions'), since);
    const loans = getSheetData(ss.getSheetByName('Loans'), since);
    const vault = getSheetData(ss.getSheetByName('Vault'), since);

    return jsonResponse({
      status: 'success',
      serverTime: new Date().toISOString(),
      transactions: transactions,
      loans: loans,
      vault: vault
    });
  }

  return jsonResponse({ status: 'ok', message: 'FlowLedger API is live' });
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheets(ss);

    const payload = JSON.parse(e.postData.contents);
    const { action, transactions, loans, vault } = payload;

    if (action === 'sync') {
      const txSheet = ss.getSheetByName('Transactions');
      const loansSheet = ss.getSheetByName('Loans');
      const vaultSheet = ss.getSheetByName('Vault');

      if (transactions && transactions.length > 0) {
        upsertRows(txSheet, transactions, 'id');
      }

      if (loans && loans.length > 0) {
        upsertRows(loansSheet, loans, 'id');
      }

      if (vault && vault.length > 0) {
        upsertRows(vaultSheet, vault, 'key');
      }

      return jsonResponse({
        status: 'success',
        message: 'Sync completed',
        serverTime: new Date().toISOString()
      });
    }

    if (action === 'reset_all') {
      const txSheet = ss.getSheetByName('Transactions');
      const loansSheet = ss.getSheetByName('Loans');
      const vaultSheet = ss.getSheetByName('Vault');

      [txSheet, loansSheet, vaultSheet].forEach(sheet => {
        if (sheet && sheet.getLastRow() > 1) {
          sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
        }
      });

      return jsonResponse({
        status: 'success',
        message: 'All cloud data wiped',
        serverTime: new Date().toISOString()
      });
    }

    return jsonResponse({ status: 'error', message: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ status: 'error', error: err.toString() });
  }
}

function ensureSheets(ss) {
  const sheets = [
    {
      name: 'Transactions',
      headers: ['id', 'date', 'sphere', 'type', 'category', 'amount', 'account', 'relatedLoanId', 'note', 'updatedAt', 'isDeleted']
    },
    {
      name: 'Loans',
      headers: ['id', 'personName', 'type', 'amount', 'remainingAmount', 'account', 'date', 'dueDate', 'status', 'notes', 'updatedAt', 'isDeleted']
    },
    {
      name: 'Vault',
      headers: ['key', 'value', 'updatedAt']
    }
  ];

  sheets.forEach(def => {
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    // If the sheet is empty or headers were deleted, automatically restore them
    if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
      sheet.appendRow(def.headers);
      sheet.getRange(1, 1, 1, def.headers.length).setFontWeight('bold').setBackground('#f3f4f6');
      sheet.setFrozenRows(1);
    }
  });
}

function getSheetData(sheet, since) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = [];
  const sinceDate = since ? new Date(since) : null;

  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }

    if (sinceDate && row.updatedAt) {
      const rowDate = new Date(row.updatedAt);
      if (rowDate <= sinceDate) continue;
    }

    rows.push(row);
  }
  return rows;
}

function upsertRows(sheet, items, keyField) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const keyIndex = headers.indexOf(keyField);

  if (keyIndex === -1) return;

  const existingMap = new Map();
  for (let i = 1; i < data.length; i++) {
    existingMap.set(String(data[i][keyIndex]), i + 1); // 1-indexed row number
  }

  items.forEach(item => {
    const keyValue = String(item[keyField]);
    const rowData = headers.map(h => {
      let val = item[h];
      if (typeof val === 'object' && val !== null) {
        val = JSON.stringify(val);
      }
      return val !== undefined ? val : '';
    });

    if (existingMap.has(keyValue)) {
      const rowNum = existingMap.get(keyValue);
      sheet.getRange(rowNum, 1, 1, headers.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
      existingMap.set(keyValue, sheet.getLastRow());
    }
  });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

