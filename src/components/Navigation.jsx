import { FileText, Users, Plus, ShieldCheck, PieChart } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, onOpenAdd }) {
  const tabs = [
    { id: 'ledger', label: 'Ledger', icon: FileText },
    { id: 'loans', label: 'Loans / IOUs', icon: Users },
    { id: 'add', label: 'Add', icon: Plus, isAction: true },
    { id: 'vault', label: 'Vault & EMI', icon: ShieldCheck },
    { id: 'insights', label: 'Insights', icon: PieChart },
  ];

  return (
    <>
      {/* Mobile Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0c0f17]/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 px-2 py-1.5 shadow-lg">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            if (tab.isAction) {
              return (
                <button
                  key={tab.id}
                  onClick={onOpenAdd}
                  className="-mt-5 w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all"
                  aria-label="Add transaction"
                >
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </button>
              );
            }

            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
                <span className="text-[10px] mt-0.5">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Top Tabs Navigation */}
      <div className="hidden sm:flex items-center justify-between mb-6 p-1.5 bg-gray-100/80 dark:bg-gray-850/70 border border-gray-200 dark:border-gray-800 rounded-2xl">
        <div className="flex items-center gap-1">
          {tabs
            .filter((t) => !t.isAction)
            .map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-gray-200/50 dark:border-gray-700/50'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
        </div>

        <button
          onClick={onOpenAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Transaction</span>
        </button>
      </div>
    </>
  );
}
