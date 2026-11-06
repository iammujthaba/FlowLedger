import { useState } from 'react';
import { syncService } from '../services/syncService';
import { db } from '../db/db';
import {
  X,
  RefreshCw,
  Download,
  HelpCircle,
  Link2
} from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, syncInfo, onTriggerSync }) {
  const [scriptUrl, setScriptUrl] = useState(() => syncService.getScriptUrl());
  const [isSaving, setIsSaving] = useState(false);
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
      </div>
    </div>
  );
}
