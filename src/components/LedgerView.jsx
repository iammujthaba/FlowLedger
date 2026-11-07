import { useState, useMemo } from 'react';
import { db } from '../db/db';
import { syncService } from '../services/syncService';
import CategoryIcon from './CategoryIcon';
import { toIsoDate, formatDateHeader } from '../utils/dateUtils';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  Trash2,
  Edit2,
  Calendar,
  User,
  Briefcase,
  SlidersHorizontal
} from 'lucide-react';

export default function LedgerView({
  transactions = [],
  categories = [],
  accounts = [],
  onEditTransaction,
  onOpenAdjustBalances
}) {
  const [timeframe, setTimeframe] = useState('monthly'); // 'weekly' | 'monthly' | 'yearly'
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [sphereFilter, setSphereFilter] = useState('all'); // 'all' | 'personal' | 'work'
  const [searchQuery, setSearchQuery] = useState('');

  // Liquid accounts and Total Liquid Balance
  const liquidAccounts = useMemo(() => {
    return accounts.filter((a) => a.id !== 'cc');
  }, [accounts]);

  const totalLiquidBalance = useMemo(() => {
    return liquidAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  }, [liquidAccounts]);

  // Category color lookup
  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(c.name, c));
    return map;
  }, [categories]);

  // Account map for bank tags
  const accountMap = useMemo(() => {
    const map = new Map();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  // Navigate timeframes
  const handlePrev = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (timeframe === 'weekly') d.setDate(d.getDate() - 7);
      else if (timeframe === 'monthly') d.setMonth(d.getMonth() - 1);
      else if (timeframe === 'yearly') d.setFullYear(d.getFullYear() - 1);
      return d;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (timeframe === 'weekly') d.setDate(d.getDate() + 7);
      else if (timeframe === 'monthly') d.setMonth(d.getMonth() + 1);
      else if (timeframe === 'yearly') d.setFullYear(d.getFullYear() + 1);
      return d;
    });
  };

  // Helper date boundaries
  const { startDateStr, endDateStr, label } = useMemo(() => {
    const d = new Date(currentDate);

    if (timeframe === 'weekly') {
      const day = d.getDay();
      const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(d.setDate(diffToMonday));
      const end = new Date(start);
      end.setDate(end.getDate() + 6);

      const sStr = start.toISOString().split('T')[0];
      const eStr = end.toISOString().split('T')[0];
      const l = `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      return { startDateStr: sStr, endDateStr: eStr, label: l };
    }

    if (timeframe === 'monthly') {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      const sYear = start.getFullYear();
      const sMonth = String(start.getMonth() + 1).padStart(2, '0');
      const eDay = String(end.getDate()).padStart(2, '0');

      const sStr = `${sYear}-${sMonth}-01`;
      const eStr = `${sYear}-${sMonth}-${eDay}`;
      const l = start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      return { startDateStr: sStr, endDateStr: eStr, label: l };
    }

    // Yearly
    const year = d.getFullYear();
    return {
      startDateStr: `${year}-01-01`,
      endDateStr: `${year}-12-31`,
      label: `${year}`,
    };
  }, [currentDate, timeframe]);

  // Filter transactions for this timeframe and criteria
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const txDateStr = toIsoDate(tx.date, tx.updatedAt);
      if (txDateStr < startDateStr || txDateStr > endDateStr) return false;
      if (sphereFilter !== 'all' && tx.sphere !== sphereFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchNote = tx.note && tx.note.toLowerCase().includes(query);
        const matchCategory = tx.category && tx.category.toLowerCase().includes(query);
        if (!matchNote && !matchCategory) return false;
      }
      return true;
    });
  }, [transactions, startDateStr, endDateStr, sphereFilter, searchQuery]);

  // Aggregate metrics
  const { totalIncome, totalExpense, personalExpense, workExpense, personalCount, workCount } = useMemo(() => {
    let income = 0;
    let expense = 0;
    let personalExp = 0;
    let workExp = 0;
    let pCount = 0;
    let wCount = 0;

    filteredTransactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        income += amt;
      } else {
        expense += amt;
        if (tx.sphere === 'personal') {
          personalExp += amt;
          pCount++;
        } else if (tx.sphere === 'work') {
          workExp += amt;
          wCount++;
        }
      }
    });

    return {
      totalIncome: income,
      totalExpense: expense,
      personalExpense: personalExp,
      workExpense: workExp,
      personalCount: pCount,
      workCount: wCount,
    };
  }, [filteredTransactions]);

  const netSavings = totalIncome - totalExpense;

  // Group transactions by date descending
  const groupedByDate = useMemo(() => {
    const groups = {};
    const sorted = [...filteredTransactions].sort((a, b) => {
      const aDate = toIsoDate(a.date, a.updatedAt);
      const bDate = toIsoDate(b.date, b.updatedAt);
      if (aDate !== bDate) return bDate.localeCompare(aDate);
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });

    sorted.forEach((tx) => {
      const cleanKey = toIsoDate(tx.date, tx.updatedAt);
      if (!groups[cleanKey]) {
        groups[cleanKey] = [];
      }
      groups[cleanKey].push(tx);
    });

    return Object.entries(groups);
  }, [filteredTransactions]);

  const handleDelete = async (tx) => {
    const isLoanTx = Boolean(tx.relatedLoanId);
    const confirmMsg = isLoanTx
      ? `Delete "${tx.category}" (₹${tx.amount})? This will also revert the bank balance and update related IOU records.`
      : `Delete "${tx.category}" (₹${tx.amount})?`;

    if (!window.confirm(confirmMsg)) return;
    try {
      await db.transactions.delete(tx.id);

      // Revert the account balance
      const accountsVault = await db.vault.get('bank_accounts');
      if (accountsVault && Array.isArray(accountsVault.value)) {
        const revertDelta = tx.type === 'expense' ? Number(tx.amount) : -Number(tx.amount);
        const updatedAccs = accountsVault.value.map((acc) => {
          if (acc.id === (tx.account || 'pnb')) {
            return { ...acc, balance: (Number(acc.balance) || 0) + revertDelta };
          }
          return acc;
        });
        await db.vault.put({ key: 'bank_accounts', value: updatedAccs, updatedAt: new Date().toISOString() });
        await syncService.enqueue('vault', 'bank_accounts', 'upsert', {
          key: 'bank_accounts',
          value: updatedAccs,
          updatedAt: new Date().toISOString(),
        });
      }

      await syncService.enqueue('transactions', tx.id, 'delete', {
        id: tx.id,
        isDeleted: true,
        updatedAt: new Date().toISOString(),
      });

      // If this was the main loan transaction, also delete the loan
      if (tx.relatedLoanId && tx.id === `tx_loan_${tx.relatedLoanId}`) {
        await db.loans.delete(tx.relatedLoanId);
        await syncService.enqueue('loans', tx.relatedLoanId, 'delete', {
          id: tx.relatedLoanId,
          isDeleted: true,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="space-y-4 pb-20 sm:pb-8">
      {/* ─── Total Available Balance Card ─── */}
      <div className="bg-[#0d111a] border border-gray-800 rounded-3xl p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Total Available Balance</span>
          </div>
          <button
            onClick={onOpenAdjustBalances}
            className="p-2 rounded-xl bg-gray-850 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-750 transition-all shadow-sm active:scale-95"
            title="Shuffle / Adjust Balances"
            aria-label="Adjust Balances"
          >
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
          </button>
        </div>

        <div>
          <p className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
            ₹{totalLiquidBalance.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Timeframe & Date Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0d111a] p-3 rounded-2xl border border-gray-800 shadow-sm">
        {/* Timeframe selector pills */}
        <div className="flex bg-gray-800 p-1 rounded-xl">
          {['weekly', 'monthly', 'yearly'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-semibold capitalize transition-all ${
                timeframe === tf
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Date Navigator */}
        <div className="flex items-center justify-between sm:justify-end gap-2">
          <button
            onClick={handlePrev}
            className="p-1.5 rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-300 transition-colors"
            aria-label="Previous period"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-gray-200 min-w-36 text-center">
            {label}
          </span>
          <button
            onClick={handleNext}
            className="p-1.5 rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-300 transition-colors"
            aria-label="Next period"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Total Inflow */}
        <div className="bg-[#0d111a] border border-gray-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <ArrowDownRight className="w-4 h-4" />
            <span>Total Inflow</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
            ₹{totalIncome.toLocaleString('en-IN')}
          </p>
        </div>

        {/* Total Outflow */}
        <div className="bg-[#0d111a] border border-gray-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
            <ArrowUpRight className="w-4 h-4" />
            <span>Total Outflow</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
            ₹{totalExpense.toLocaleString('en-IN')}
          </p>
        </div>

        {/* Net Savings */}
        <div className="col-span-2 sm:col-span-1 bg-[#0d111a] border border-gray-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
            <span>Net Cashflow</span>
          </div>
          <p
            className={`text-xl sm:text-2xl font-bold font-mono mt-1 ${
              netSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {netSavings >= 0 ? '+' : ''}₹{netSavings.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Sphere Filter */}
          <div className="flex bg-gray-850 p-1 rounded-xl border border-gray-800">
            <button
              onClick={() => setSphereFilter('all')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                sphereFilter === 'all'
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSphereFilter('personal')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                sphereFilter === 'personal'
                  ? 'bg-gray-700 text-emerald-400 shadow-sm'
                  : 'text-gray-400'
              }`}
            >
              <User className="w-3 h-3" />
              <span>Daily Life</span>
            </button>
            <button
              onClick={() => setSphereFilter('work')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                sphereFilter === 'work'
                  ? 'bg-gray-700 text-blue-400 shadow-sm'
                  : 'text-gray-400'
              }`}
            >
              <Briefcase className="w-3 h-3" />
              <span>Work</span>
            </button>
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search note or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#0d111a] border border-gray-800 rounded-xl text-xs text-white placeholder-gray-400 outline-none focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Organized Sub-Cards Under Filter: Contextual Breakdown */}
        {sphereFilter === 'all' ? (
          <div className="grid grid-cols-2 gap-2.5">
            {/* Daily Life Card */}
            <div className="bg-[#0d111a] border border-gray-800/80 rounded-2xl p-3 shadow-sm">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                  <User className="w-3.5 h-3.5" />
                  <span>Daily Life</span>
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  {personalCount} {personalCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-lg font-bold font-mono text-white">
                ₹{personalExpense.toLocaleString('en-IN')}
              </p>
            </div>

            {/* Work Card */}
            <div className="bg-[#0d111a] border border-gray-800/80 rounded-2xl p-3 shadow-sm">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span className="flex items-center gap-1.5 font-medium text-blue-400">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Work-Related</span>
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  {workCount} {workCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-lg font-bold font-mono text-white">
                ₹{workExpense.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        ) : sphereFilter === 'personal' ? (
          <div className="bg-[#0d111a] border border-emerald-500/25 rounded-2xl p-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-400">Daily Life Expenses</p>
                <p className="text-[11px] text-gray-400 font-mono">
                  {personalCount} {personalCount === 1 ? 'entry recorded' : 'entries recorded'}
                </p>
              </div>
            </div>
            <p className="text-lg font-bold font-mono text-white">
              ₹{personalExpense.toLocaleString('en-IN')}
            </p>
          </div>
        ) : (
          <div className="bg-[#0d111a] border border-blue-500/25 rounded-2xl p-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-400">Work-Related Expenses</p>
                <p className="text-[11px] text-gray-400 font-mono">
                  {workCount} {workCount === 1 ? 'entry recorded' : 'entries recorded'}
                </p>
              </div>
            </div>
            <p className="text-lg font-bold font-mono text-white">
              ₹{workExpense.toLocaleString('en-IN')}
            </p>
          </div>
        )}
      </div>

      {/* Transaction List */}
      {groupedByDate.length === 0 ? (
        <div className="text-center py-12 bg-[#0d111a] rounded-2xl border border-gray-800">
          <Calendar className="w-10 h-10 mx-auto text-gray-700 mb-2" />
          <p className="text-sm font-semibold text-gray-400">No transactions recorded</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Tap the + button to log an expense or income
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map(([dateKey, txList]) => (
            <div key={dateKey} className="space-y-2">
              {/* Date Header */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {formatDateHeader(dateKey)}
                </span>
                <span className="text-xs font-mono font-medium text-gray-500">
                  {txList.length} {txList.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Transactions in this date */}
              <div className="bg-[#0d111a] border border-gray-800/80 rounded-2xl divide-y divide-gray-800/60 overflow-hidden shadow-sm">
                {txList.map((tx) => {
                  const catDef = categoryMap.get(tx.category);
                  const isExpense = tx.type === 'expense';
                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-800/40 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Icon */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: catDef?.color ? `${catDef.color}15` : '#10b98115',
                          }}
                        >
                          <CategoryIcon
                            name={catDef?.icon || 'CircleDollarSign'}
                            className="w-4 h-4"
                            color={catDef?.color || '#10b981'}
                          />
                        </div>

                        {/* Title and details */}
                        <div className="min-w-0">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="text-sm font-semibold text-white truncate">
                              {tx.category}
                            </span>
                            {tx.relatedLoanId || tx.category?.includes('IOU') ? (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                IOU
                              </span>
                            ) : (
                              <span
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                                  tx.sphere === 'work'
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : 'bg-emerald-500/10 text-emerald-400'
                                }`}
                              >
                                {tx.sphere === 'work' ? 'Work' : 'Daily'}
                              </span>
                            )}
                            {tx.account && (
                              <span className="text-[10px] font-mono text-gray-400 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-750">
                                {accountMap.get(tx.account)?.shortName || tx.account.toUpperCase()}
                              </span>
                            )}
                          </div>
                          {tx.note && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {tx.note}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Amount and Actions */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-sm font-bold font-mono ${
                            isExpense
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {isExpense ? '-' : '+'}₹{Number(tx.amount).toLocaleString('en-IN')}
                        </span>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onEditTransaction(tx)}
                            className="p-1 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-800 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx)}
                            className="p-1 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-950/30 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
