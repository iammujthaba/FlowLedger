import { useState } from 'react';
import { db, DEFAULT_ACCOUNTS } from '../db/db';
import { syncService } from '../services/syncService';
import CategoryIcon from './CategoryIcon';
import { X, Check, User, Briefcase, PlusCircle, MinusCircle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

// Contextual smart default bank account based on user preferences:
// 1. Work-related expense -> Punjab National Bank ('pnb')
// 2. Personal / Daily Life expense -> Kerala Gramin Bank ('kgb')
// 3. Incoming cash / Inflow -> South Indian Bank ('sib')
const getContextualAccount = (curType, curSphere) => {
  if (curType === 'income') return 'sib';
  if (curSphere === 'work') return 'pnb';
  return 'kgb';
};

export default function QuickAddModal({
  isOpen,
  onClose,
  initialSphere = 'work',
  editTransaction = null,
  accounts = []
}) {
  const accountsList = accounts.length > 0 ? accounts : DEFAULT_ACCOUNTS;

  const [sphere, setSphere] = useState(() => editTransaction?.sphere || initialSphere);
  const [type, setType] = useState(() => editTransaction?.type || 'expense');
  const [hasManualAccount, setHasManualAccount] = useState(() => Boolean(editTransaction?.account));
  const [account, setAccount] = useState(() => {
    if (editTransaction?.account) return editTransaction.account;
    const initialT = editTransaction?.type || 'expense';
    const initialS = editTransaction?.sphere || initialSphere;
    return getContextualAccount(initialT, initialS);
  });
  const [amount, setAmount] = useState(() => (editTransaction ? String(editTransaction.amount) : ''));
  const [date, setDate] = useState(() => editTransaction?.date || new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState(() => editTransaction?.category || '');
  const [note, setNote] = useState(() => editTransaction?.note || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch available categories from IndexedDB
  const categories = useLiveQuery(() => db.categories.toArray(), []) || [];

  // Filter categories matching current sphere and type
  const filteredCategories = categories.filter(
    (c) => c.sphere === sphere && c.type === type
  );

  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const effectiveCategory = category || (filteredCategories.length > 0 ? filteredCategories[0].name : '');
  const activeAccountId = account || getContextualAccount(type, sphere);

  const handleSphereChange = (newSphere) => {
    setSphere(newSphere);
    setCategory('');
    if (!hasManualAccount) {
      setAccount(getContextualAccount(type, newSphere));
    }
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    setCategory('');
    if (!hasManualAccount) {
      setAccount(getContextualAccount(newType, sphere));
    }
  };

  const handleSelectAccount = (accId) => {
    setAccount(accId);
    setHasManualAccount(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return;

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const txId = editTransaction ? editTransaction.id : `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const txRecord = {
        id: txId,
        date: date || todayStr,
        sphere,
        type,
        account: activeAccountId,
        category: effectiveCategory || (type === 'expense' ? 'Other Expense' : 'Other Income'),
        amount: parsedAmount,
        note: note.trim(),
        updatedAt: now,
        syncStatus: 'pending',
      };

      await db.transactions.put(txRecord);

      // Adjust the chosen account balance in vault
      const accountsVault = await db.vault.get('bank_accounts');
      if (accountsVault && Array.isArray(accountsVault.value)) {
        const delta = type === 'expense' ? -parsedAmount : parsedAmount;
        let prevDelta = 0;
        if (editTransaction) {
          prevDelta = editTransaction.type === 'expense' ? Number(editTransaction.amount) : -Number(editTransaction.amount);
        }

        const updatedAccs = accountsVault.value.map((acc) => {
          let bal = acc.balance;
          if (editTransaction && editTransaction.account === acc.id) {
            bal += prevDelta;
          }
          if (acc.id === activeAccountId) {
            bal += delta;
          }
          return { ...acc, balance: bal };
        });

        await db.vault.put({ key: 'bank_accounts', value: updatedAccs, updatedAt: now });
        await syncService.enqueue('vault', 'bank_accounts', 'upsert', {
          key: 'bank_accounts',
          value: updatedAccs,
          updatedAt: now,
        });
      }

      // Enqueue sync action for transaction
      await syncService.enqueue('transactions', txId, 'upsert', {
        ...txRecord,
        isDeleted: false,
      });

      onClose();
    } catch (err) {
      console.error('Failed to save transaction:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:max-w-lg bg-[#0d111a] rounded-t-3xl sm:rounded-3xl border border-gray-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">
              {editTransaction ? 'Edit Transaction' : 'Record Transaction'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
          {/* Sphere Switcher: Daily Life vs Work */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">
              Expense Sphere
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-850 rounded-xl">
              <button
                type="button"
                onClick={() => handleSphereChange('personal')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  sphere === 'personal'
                    ? 'bg-gray-700 text-emerald-400 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Daily Life</span>
              </button>
              <button
                type="button"
                onClick={() => handleSphereChange('work')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  sphere === 'work'
                    ? 'bg-gray-700 text-blue-400 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Work-Related</span>
              </button>
            </div>
          </div>

          {/* Type Toggle: Expense vs Income */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                type === 'expense'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : 'bg-gray-850/50 text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              <MinusCircle className="w-4 h-4" />
              <span>Expense (Outflow)</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                type === 'income'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-gray-850/50 text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Income (Inflow)</span>
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">
              Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-500">
                ₹
              </span>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                autoFocus
                required
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-850/60 border border-gray-750 rounded-2xl text-2xl font-bold text-white focus:border-emerald-500 focus:ring-0 outline-none transition-all font-mono"
              />
            </div>
          </div>

          {/* Optional Bank / Account Selector (Pre-selected to PNB / Default) */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center justify-between">
              <span>{type === 'expense' ? 'Paid From Account' : 'Deposited To Account'}</span>
              <span className="text-[11px] text-gray-500 font-normal">Optional</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {accountsList.map((acc) => {
                const isSelected = activeAccountId === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleSelectAccount(acc.id)}
                    className={`py-1.5 px-2.5 rounded-xl text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-gray-800 text-white border-emerald-500 shadow-sm'
                        : 'bg-gray-850/50 text-gray-400 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <span>{acc.shortName || acc.name}</span>
                    {acc.isDefault && <span className="text-amber-400 ml-1 font-bold">★</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Selector (Date only) */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">
              Transaction Date
            </label>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => setDate(todayStr)}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                  date === todayStr
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-gray-850/50 text-gray-400 border-gray-750'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDate(yesterdayStr)}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                  date === yesterdayStr
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-gray-850/50 text-gray-400 border-gray-750'
                }`}
              >
                Yesterday
              </button>
              <div className="flex-1 relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-850/50 border border-gray-750 rounded-lg text-xs text-gray-200 outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Category Chips */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">
              Category
            </label>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 custom-scrollbar">
              {filteredCategories.map((cat) => {
                const isSelected = effectiveCategory === cat.name;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.name)}
                    className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                        : 'bg-gray-850/60 text-gray-300 border-gray-750 hover:border-gray-600'
                    }`}
                  >
                    <CategoryIcon name={cat.icon} className="w-3.5 h-3.5" color={isSelected ? '#ffffff' : cat.color} />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Petrol for Bangalore trip, Lunch with Rahul..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-850/60 border border-gray-750 rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{editTransaction ? 'Save Changes' : 'Record Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
