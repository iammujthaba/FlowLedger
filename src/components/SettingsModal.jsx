import { useState } from 'react';
import { syncService } from '../services/syncService';
import { db, DEFAULT_ACCOUNTS } from '../db/db';
import {
  X,
  RefreshCw,
  Download,
  HelpCircle,
  Link2,
  Trash2,
  AlertTriangle
} from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, syncInfo, onTriggerSync }) {
  const [scriptUrl, setScriptUrl] = useState(() => syncService.getScriptUrl());
  const [isSaving, setIsSaving] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  if (!isOpen) return null;

  const handleSaveUrl = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    syncService.setScriptUrl(scriptUrl);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    setIsSaving(false);

    if (scriptUrl.trim()) {
      onTriggerSync();
    }
  };

  const handleExportBackup = async () => {
    try {
      const transactions = await db.transactions.toArray();
      const loans = await db.loans.toArray();
      const vault = await db.vault.toArray();

      const backup = {
        exportedAt: new Date().toISOString(),
        version: 1,
        transactions,
        loans,
        vault,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flowledger_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Backup failed:', err);
    }
  };

  const handleWipeAllData = async () => {
    const confirmed = window.confirm(
      '⚠️ RESET EVERYTHING FOR TESTING?\n\nThis will permanently:\n• Delete all Transactions\n• Delete all Loans & IOUs\n• Reset all Bank Balances to ₹0\n• Clear Cloud Sync Queue & wipe Google Sheet\n\nAre you sure you want to start with a fresh blank slate?'
    );
    if (!confirmed) return;

    setIsWiping(true);
    try {
      // 1. Wipe cloud sheet if connected
      const url = syncService.getScriptUrl();
      if (url) {
        try {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'reset_all' }),
          });
        } catch (e) {
          console.warn('Could not wipe cloud sheet (offline or url invalid):', e);
        }
      }

      // 2. Clear local IndexedDB tables
      await db.transactions.clear();
      await db.loans.clear();
      await db.syncQueue.clear();

      // 3. Reset bank balances to ₹0 in vault
      const resetAccounts = DEFAULT_ACCOUNTS.map((a) => ({ ...a, balance: 0 }));
      await db.vault.put({
        key: 'bank_accounts',
        value: resetAccounts,
        updatedAt: new Date().toISOString(),
      });
      await db.vault.put({
        key: 'usdt_balance',
        value: 0,
        updatedAt: new Date().toISOString(),
      });

      // 4. Clear last sync timestamp
      localStorage.removeItem('flowledger_last_sync');

      alert('Clean slate! All data has been wiped and reset to ₹0.');
      window.location.reload();
    } catch (err) {
      console.error('Failed to wipe data:', err);
      alert('Error wiping data: ' + err.message);
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-[#0d111a] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-5 animate-modal-in max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Settings & Cloud Sync
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google Sheets Sync Configuration */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              Google Apps Script Web App URL
            </label>
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showGuide ? 'Hide Instructions' : 'How to set up'}</span>
            </button>
          </div>

          {/* Quick Setup Instructions Accordion */}
          {showGuide && (
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 space-y-2">
              <p className="font-semibold text-gray-900 dark:text-white">
                How to link your free Google Sheet:
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                <li>Create a blank Google Sheet in Google Drive (name it e.g. &quot;FlowLedger&quot;).</li>
                <li>Go to <b>Extensions &gt; Apps Script</b> in your sheet.</li>
                <li>Copy the code from the project file <code className="text-emerald-500 font-mono">google-apps-script.js</code> and paste it in.</li>
                <li>Click <b>Deploy &gt; New deployment</b> &gt; Gear icon &gt; <b>Web app</b>.</li>
                <li>Set <i>Execute as:</i> &quot;Me&quot;, and <i>Who has access:</i> &quot;Anyone&quot;.</li>
                <li>Copy the generated Web App URL and paste it below!</li>
              </ol>
            </div>
          )}

          <form onSubmit={handleSaveUrl} className="space-y-2">
            <div className="relative">
              <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all"
              >
                {saveSuccess ? 'Saved!' : 'Save & Connect'}
              </button>

              <button
                type="button"
                onClick={onTriggerSync}
                disabled={syncInfo.status === 'syncing' || !scriptUrl}
                className="py-2 px-3 rounded-xl text-xs font-semibold border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-all flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncInfo.status === 'syncing' ? 'animate-spin' : ''}`} />
                <span>Sync Now</span>
              </button>
            </div>
          </form>

          {syncInfo.lastSyncTime && (
            <p className="text-[11px] text-gray-400">
              Last synced: {new Date(syncInfo.lastSyncTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}, {new Date(syncInfo.lastSyncTime).toLocaleDateString('en-IN')}
            </p>
          )}
        </div>

        {/* Local Backup Section */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300">
            Offline Backup & Export
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Download your entire financial history as a portable JSON file.
          </p>

          <button
            onClick={handleExportBackup}
            className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center gap-2 transition-all"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>Export Offline Backup (JSON)</span>
          </button>
        </div>

        {/* Development & Testing: Wipe Data Section */}
        <div className="pt-4 border-t border-rose-500/20 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-500">
            <AlertTriangle className="w-4 h-4" />
            <span>Testing & Development (Danger Zone)</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Permanently clear all transactions, loans, and reset all bank balances back to ₹0 for a fresh testing slate.
          </p>

          <button
            type="button"
            onClick={handleWipeAllData}
            disabled={isWiping}
            className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isWiping ? 'Wiping All Data...' : 'Reset & Wipe All Data'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
