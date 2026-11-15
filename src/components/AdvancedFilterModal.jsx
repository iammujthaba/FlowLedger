import { useState } from 'react';
import { INITIAL_FILTERS } from '../constants/filterConstants';
import {
  X,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Landmark,
  Calendar,
  Layers,
  ArrowUpDown,
  Tag,
  DollarSign,
  Wallet,
  CreditCard,
  User,
  Briefcase,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';

export default function AdvancedFilterModal({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters,
  accounts = [],
  categories = [],
}) {
  const [draft, setDraft] = useState(() => filters || INITIAL_FILTERS);

  if (!isOpen) return null;

  const handleUpdateDraft = (key, val) => {
    setDraft((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleApply = (e) => {
    e.preventDefault();
    onApplyFilters(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft(INITIAL_FILTERS);
    onResetFilters();
    onClose();
  };

  const getAccountIcon = (id) => {
    if (id === 'cash') return <Wallet className="w-3.5 h-3.5 text-purple-400" />;
    if (id === 'cc') return <CreditCard className="w-3.5 h-3.5 text-pink-400" />;
    return <Landmark className="w-3.5 h-3.5 text-emerald-400" />;
  };

  // Distinct category names for selection
  const uniqueCategoryNames = Array.from(
    new Set(categories.map((c) => c.name).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-[#0d111a] rounded-3xl border border-gray-800 shadow-2xl p-5 space-y-4 animate-modal-in max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col justify-between">
        
        {/* Header */}
        <div>
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Filter & Sort Transactions</h3>
                <p className="text-[11px] text-gray-400">Refine by nature, bank account, date, or amount</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Form Body */}
        <form onSubmit={handleApply} className="space-y-4 text-xs">
          
          {/* 1. Transaction Nature / Flow */}
          <div className="space-y-1.5">
            <label className="text-gray-300 font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Transaction Nature & Type</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: 'all', label: 'All Flows', icon: null },
                { id: 'earned', label: 'Earned Income', icon: <ArrowDownRight className="w-3 h-3 text-emerald-400" /> },
                { id: 'borrowed', label: 'Borrowed (Debt)', icon: <ArrowDownRight className="w-3 h-3 text-rose-400" /> },
                { id: 'all_income', label: 'All Inflows', icon: <ArrowDownRight className="w-3 h-3 text-emerald-400" /> },
                { id: 'personal_expense', label: 'Daily Life Exp.', icon: <User className="w-3 h-3 text-emerald-400" /> },
                { id: 'work_expense', label: 'Work Exp.', icon: <Briefcase className="w-3 h-3 text-blue-400" /> },
                { id: 'money_lent', label: 'Money Lent', icon: <ArrowUpRight className="w-3 h-3 text-purple-400" /> },
                { id: 'all_expense', label: 'All Outflows', icon: <ArrowUpRight className="w-3 h-3 text-rose-400" /> },
              ].map((opt) => {
                const isSelected = draft.nature === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleUpdateDraft('nature', opt.id)}
                    className={`py-2 px-2.5 rounded-xl border text-left flex items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-white font-semibold shadow-sm'
                        : 'bg-gray-850/60 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {opt.icon}
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Bank / Payment Source */}
          <div className="space-y-1.5">
            <label className="text-gray-300 font-semibold flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-blue-400" />
              <span>Bank Account / Source</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleUpdateDraft('bank', 'all')}
                className={`py-2 px-2.5 rounded-xl border text-left flex items-center gap-1.5 transition-all ${
                  draft.bank === 'all'
                    ? 'bg-blue-500/15 border-blue-500/50 text-white font-semibold shadow-sm'
                    : 'bg-gray-850/60 border-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>All Accounts</span>
              </button>
              {accounts.map((acc) => {
                const isSelected = draft.bank === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleUpdateDraft('bank', acc.id)}
                    className={`py-2 px-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      isSelected
                        ? 'bg-blue-500/15 border-blue-500/50 text-white font-semibold shadow-sm'
                        : 'bg-gray-850/60 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {getAccountIcon(acc.id)}
                    <span className="truncate">{acc.shortName || acc.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Date Selection Mode */}
          <div className="space-y-2">
            <label className="text-gray-300 font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Date Scope</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: 'period', label: 'Selected Period' },
                { id: 'single', label: 'Exact Date' },
                { id: 'range', label: 'Date Range' },
                { id: 'all_time', label: 'All Time' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleUpdateDraft('dateScope', m.id)}
                  className={`py-1.5 px-2.5 rounded-xl border text-center transition-all ${
                    draft.dateScope === m.id
                      ? 'bg-amber-500/15 border-amber-500/50 text-white font-semibold shadow-sm'
                      : 'bg-gray-850/60 border-gray-800 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Inputs based on dateScope */}
            {draft.dateScope === 'single' && (
              <div className="pt-1">
                <input
                  type="date"
                  value={draft.exactDate}
                  onChange={(e) => handleUpdateDraft('exactDate', e.target.value)}
                  className="w-full bg-[#131926] border border-gray-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-400 transition-all font-mono text-xs"
                />
              </div>
            )}

            {draft.dateScope === 'range' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[10px] text-gray-400 block mb-1">From Date</span>
                  <input
                    type="date"
                    value={draft.startDate}
                    onChange={(e) => handleUpdateDraft('startDate', e.target.value)}
                    className="w-full bg-[#131926] border border-gray-700 rounded-xl px-3 py-1.5 text-white outline-none focus:border-amber-400 transition-all font-mono text-xs"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block mb-1">To Date</span>
                  <input
                    type="date"
                    value={draft.endDate}
                    onChange={(e) => handleUpdateDraft('endDate', e.target.value)}
                    className="w-full bg-[#131926] border border-gray-700 rounded-xl px-3 py-1.5 text-white outline-none focus:border-amber-400 transition-all font-mono text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. Category Filter */}
          <div className="space-y-1.5">
            <label className="text-gray-300 font-semibold flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-pink-400" />
              <span>Category</span>
            </label>
            <select
              value={draft.category}
              onChange={(e) => handleUpdateDraft('category', e.target.value)}
              className="w-full bg-[#131926] border border-gray-700 rounded-xl px-3 py-2 text-white outline-none focus:border-pink-400 transition-all text-xs"
            >
              <option value="all">All Categories</option>
              {uniqueCategoryNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Amount Range */}
          <div className="space-y-1.5">
            <label className="text-gray-300 font-semibold flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Amount Range (₹)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono">₹</span>
                <input
                  type="number"
                  placeholder="Min Amount"
                  value={draft.minAmount}
                  onChange={(e) => handleUpdateDraft('minAmount', e.target.value)}
                  className="w-full bg-[#131926] border border-gray-700 rounded-xl pl-7 pr-3 py-1.5 text-white font-mono outline-none focus:border-emerald-400 transition-all text-xs"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono">₹</span>
                <input
                  type="number"
                  placeholder="Max Amount"
                  value={draft.maxAmount}
                  onChange={(e) => handleUpdateDraft('maxAmount', e.target.value)}
                  className="w-full bg-[#131926] border border-gray-700 rounded-xl pl-7 pr-3 py-1.5 text-white font-mono outline-none focus:border-emerald-400 transition-all text-xs"
                />
              </div>
            </div>
            {/* Quick Amount Chips */}
            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
              {['500', '1000', '2000', '5000'].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleUpdateDraft('minAmount', amt)}
                  className="px-2 py-0.5 rounded-lg bg-gray-800 text-[10px] text-gray-300 hover:text-white font-mono shrink-0 border border-gray-700"
                >
                  &ge; ₹{Number(amt).toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Sorting Order */}
          <div className="space-y-1.5">
            <label className="text-gray-300 font-semibold flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-purple-400" />
              <span>Sort Order</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'date_desc', label: 'Date: Newest First' },
                { id: 'date_asc', label: 'Date: Oldest First' },
                { id: 'amount_desc', label: 'Amount: Highest First' },
                { id: 'amount_asc', label: 'Amount: Lowest First' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleUpdateDraft('sortBy', s.id)}
                  className={`py-1.5 px-2.5 rounded-xl border text-left transition-all ${
                    draft.sortBy === s.id
                      ? 'bg-purple-500/15 border-purple-500/50 text-white font-semibold shadow-sm'
                      : 'bg-gray-850/60 border-gray-800 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="truncate">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={handleReset}
              className="py-2.5 px-4 rounded-xl border border-gray-750 bg-gray-850 hover:bg-gray-800 text-gray-300 hover:text-white font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>Apply Filters</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
