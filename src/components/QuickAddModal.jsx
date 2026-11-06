import { useState } from 'react';
import { db } from '../db/db';
import { syncService } from '../services/syncService';
import CategoryIcon from './CategoryIcon';
import { X, Check, User, Briefcase, PlusCircle, MinusCircle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

export default function QuickAddModal({ isOpen, onClose, initialSphere = 'personal', editTransaction = null }) {
  const [sphere, setSphere] = useState(() => editTransaction?.sphere || initialSphere);
  const [type, setType] = useState(() => editTransaction?.type || 'expense');
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
        category: effectiveCategory || (type === 'expense' ? 'Other Expense' : 'Other Income'),
        amount: parsedAmount,
        note: note.trim(),
        updatedAt: now,
        syncStatus: 'pending',
      };

      await db.transactions.put(txRecord);

      // Enqueue sync action
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
      <div className="w-full sm:max-w-lg bg-white dark:bg-[#0d111a] rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-modal-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {editTransaction ? 'Edit Transaction' : 'Record Transaction'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
          {/* Sphere Switcher: Daily Life vs Work */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
              Expense Sphere
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setSphere('personal');
                  setCategory('');
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  sphere === 'personal'
                    ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Daily Life</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSphere('work');
                  setCategory('');
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  sphere === 'work'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
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
              onClick={() => {
                setType('expense');
                setCategory('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                type === 'expense'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                  : 'bg-gray-50 dark:bg-gray-800/50 text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <MinusCircle className="w-4 h-4" />
              <span>Expense (Outflow)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setCategory('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                type === 'income'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-gray-50 dark:bg-gray-800/50 text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Income (Inflow)</span>
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400 dark:text-gray-500">
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
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-2xl text-2xl font-bold text-gray-900 dark:text-white focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-0 outline-none transition-all font-mono"
              />
            </div>
          </div>

          {/* Date Selector (Date only) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              Transaction Date
            </label>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => setDate(todayStr)}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                  date === todayStr
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDate(yesterdayStr)}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all ${
                  date === yesterdayStr
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                }`}
              >
                Yesterday
              </button>
              <div className="flex-1 relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-800 dark:text-gray-200 outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Category Chips */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
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
                        : 'bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
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
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Petrol for Bangalore trip, Lunch with Rahul..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-emerald-500 transition-all"
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
