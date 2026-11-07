import { RefreshCw, Settings } from 'lucide-react';

export default function Header({
  syncInfo,
  onTriggerSync,
  onOpenSettings,
}) {
  const getSyncBadge = () => {
    switch (syncInfo.status) {
      case 'syncing':
        return (
          <button
            disabled
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
          >
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Syncing</span>
          </button>
        );
      case 'synced':
        return (
          <button
            onClick={onTriggerSync}
            title="Synced with Google Sheets. Click to sync again."
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Synced</span>
          </button>
        );
      case 'offline':
        return (
          <div
            title="Working offline. Changes are saved locally and will auto-sync when online."
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            <span>Offline</span>
          </div>
        );
      case 'not_configured':
      default:
        return (
          <button
            onClick={onOpenSettings}
            title="Connect your Google Sheet for cross-device sync"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
          >
            <Settings className="w-3 h-3" />
            <span>Setup Sync</span>
          </button>
        );
    }
  };

  return (
    <header className="mb-5">
      <div className="flex items-center justify-between pb-3 border-b border-gray-800/80">
        <div className="flex items-center gap-3">
          {/* Official FlowLedger App Emblem */}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-md shadow-emerald-500/20 border border-emerald-400/20 shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 32 32" fill="none">
              <path d="M7.5 11.5 L21.5 11.5 M17.5 7.5 L22.5 11.5 L17.5 15.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M24.5 20.5 L10.5 20.5 M14.5 16.5 L9.5 20.5 L14.5 24.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="16" cy="16" r="2.2" fill="currentColor"/>
            </svg>
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              FlowLedger
            </h1>
            <p className="text-xs text-gray-400">Personal & Work Cashflow</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getSyncBadge()}

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 transition-colors"
            title="Settings & Google Sheet Setup"
            aria-label="Open settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
