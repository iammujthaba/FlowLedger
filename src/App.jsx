import { useState, useEffect, useMemo } from 'react';
import { db, initializeDatabase, DEFAULT_ACCOUNTS } from './db/db';
import { syncService } from './services/syncService';
import { useLiveQuery } from 'dexie-react-hooks';

import Header from './components/Header';
import Navigation from './components/Navigation';
import LedgerView from './components/LedgerView';
import LoansView from './components/LoansView';
import VaultCommitmentsView from './components/VaultCommitmentsView';
import InsightsView from './components/InsightsView';
import QuickAddModal from './components/QuickAddModal';
import SettingsModal from './components/SettingsModal';
import AdjustBalancesModal from './components/AdjustBalancesModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'loans' | 'vault' | 'insights'
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdjustBalancesOpen, setIsAdjustBalancesOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  // Sync state
  const [syncInfo, setSyncInfo] = useState({
    status: 'idle',
    lastSyncTime: localStorage.getItem('flowledger_last_sync') || null,
  });

  // Permanently lock Dark Mode
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Initialize IndexedDB & subscribe to sync
  useEffect(() => {
    initializeDatabase().catch((err) => console.error('Database init error:', err));
    const unsubscribe = syncService.subscribe((info) => setSyncInfo(info));

    // Initial background sync check: force full pull to ensure bank balances & full vault state are up to date
    if (navigator.onLine && syncService.getScriptUrl()) {
      syncService.sync({ forceFull: true });
    }

    return () => unsubscribe();
  }, []);

  // Live queries from IndexedDB
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || [];
  const loans = useLiveQuery(() => db.loans.toArray(), []) || [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];
  const rawVault = useLiveQuery(() => db.vault.toArray(), []) || [];

  // Convert raw vault rows into key-value map
  const vault = rawVault.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  // Robust parsing of bank_accounts from vault
  const accounts = useMemo(() => {
    let raw = vault.bank_accounts;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse bank_accounts from vault:', err);
      }
    }
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((acc) => ({
        ...acc,
        balance: Number(acc.balance) || 0,
      }));
    }
    return DEFAULT_ACCOUNTS;
  }, [vault.bank_accounts]);

  const handleEditTransaction = (tx) => {
    setEditingTransaction(tx);
    setIsAddOpen(true);
  };

  const handleCloseAdd = () => {
    setIsAddOpen(false);
    setEditingTransaction(null);
  };

  const handleTriggerSync = (forceFull = false) => {
    syncService.sync({ forceFull });
  };

  return (
    <div className="min-h-screen bg-[#080a0f] text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-5 sm:py-8">
        {/* Header */}
        <Header
          syncInfo={syncInfo}
          onTriggerSync={handleTriggerSync}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Navigation Bar (Desktop top tabs & Mobile bottom bar) */}
        <Navigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenAdd={() => setIsAddOpen(true)}
        />

        {/* Main View Area */}
        <main className="mt-2">
          {activeTab === 'ledger' && (
            <LedgerView
              transactions={transactions}
              categories={categories}
              accounts={accounts}
              loans={loans}
              vault={vault}
              onEditTransaction={handleEditTransaction}
              onOpenAdjustBalances={() => setIsAdjustBalancesOpen(true)}
            />
          )}

          {activeTab === 'loans' && <LoansView loans={loans} accounts={accounts} />}

          {activeTab === 'vault' && <VaultCommitmentsView vault={vault} />}

          {activeTab === 'insights' && (
            <InsightsView transactions={transactions} categories={categories} vault={vault} />
          )}
        </main>
      </div>

      {/* Quick Add Modal */}
      {isAddOpen && (
        <QuickAddModal
          key={editingTransaction ? editingTransaction.id : 'new'}
          isOpen={isAddOpen}
          onClose={handleCloseAdd}
          initialSphere="work"
          editTransaction={editingTransaction}
          accounts={accounts}
        />
      )}

      {/* Adjust Balances / Account Shuffle Modal */}
      {isAdjustBalancesOpen && (
        <AdjustBalancesModal
          key={isAdjustBalancesOpen ? 'adjust-modal-open' : 'adjust-modal-closed'}
          isOpen={isAdjustBalancesOpen}
          onClose={() => setIsAdjustBalancesOpen(false)}
          accounts={accounts}
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          syncInfo={syncInfo}
          onTriggerSync={handleTriggerSync}
        />
      )}
    </div>
  );
}
