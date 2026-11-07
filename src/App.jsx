import { useState, useEffect } from 'react';
import { db, initializeDatabase } from './db/db';
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

export default function App() {
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'loans' | 'vault' | 'insights'
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

    // Initial background sync check if configured
    if (navigator.onLine && syncService.getScriptUrl()) {
      syncService.sync();
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

  const handleEditTransaction = (tx) => {
    setEditingTransaction(tx);
    setIsAddOpen(true);
  };

  const handleCloseAdd = () => {
    setIsAddOpen(false);
    setEditingTransaction(null);
  };

  const handleTriggerSync = () => {
    syncService.sync();
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
              onEditTransaction={handleEditTransaction}
            />
          )}

          {activeTab === 'loans' && <LoansView loans={loans} />}

          {activeTab === 'vault' && <VaultCommitmentsView vault={vault} />}

          {activeTab === 'insights' && (
            <InsightsView transactions={transactions} categories={categories} />
          )}
        </main>
      </div>

      {/* Quick Add Modal */}
      {isAddOpen && (
        <QuickAddModal
          key={editingTransaction ? editingTransaction.id : 'new'}
          isOpen={isAddOpen}
          onClose={handleCloseAdd}
          initialSphere="personal"
          editTransaction={editingTransaction}
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
