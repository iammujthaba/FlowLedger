import { Sun, Moon, RefreshCw, Settings, Briefcase, User } from 'lucide-react';

export default function Header({
  activeSphere,
  setActiveSphere,
  isDark,
  setIsDark,
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
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 animate-pulse"
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
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Synced</span>
          </button>
        );
      case 'offline':
        return (
          <div
            title="Working offline. Changes are saved locally and will auto-sync when online."
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20"
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
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
          >
            <Settings className="w-3 h-3" />
            <span>Setup Sync</span>
          </button>
        );
    }
  };

  return (
    <header className="mb-6">
      <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/15">
            <span className="text-white font-bold text-lg">FL</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              FlowLedger
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Personal & Work Cashflow</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getSyncBadge()}

          {/* Theme Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 transition-colors"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-gray-600" />}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 transition-colors"
            title="Settings & Google Sheet Setup"
            aria-label="Open settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sphere Context Switcher */}
      <div className="mt-4 flex p-1 rounded-xl bg-gray-100 dark:bg-gray-850 border border-gray-200/80 dark:border-gray-800">
        <button
          onClick={() => setActiveSphere('personal')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
            activeSphere === 'personal'
              ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/20'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Daily Life (Personal)</span>
        </button>

        <button
          onClick={() => setActiveSphere('work')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
            activeSphere === 'work'
              ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-500/20'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Work-Related</span>
        </button>
      </div>
    </header>
  );
}
