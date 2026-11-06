import { useState, useMemo } from 'react';
import { db } from '../db/db';
import { syncService } from '../services/syncService';
import CategoryIcon from './CategoryIcon';
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
  Briefcase
} from 'lucide-react';

export default function LedgerView({ transactions = [], categories = [], onEditTransaction }) {
  const [timeframe, setTimeframe] = useState('monthly'); // 'weekly' | 'monthly' | 'yearly'
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [sphereFilter, setSphereFilter] = useState('all'); // 'all' | 'personal' | 'work'
  const [searchQuery, setSearchQuery] = useState('');

  // Category color lookup
  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(c.name, c));
    return map;
  }, [categories]);

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

      // Format ISO string carefully using local year/month/date
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
      if (tx.date < startDateStr || tx.date > endDateStr) return false;
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
  const { totalIncome, totalExpense, personalExpense, workExpense } = useMemo(() => {
    let income = 0;
    let expense = 0;
    let personalExp = 0;
    let workExp = 0;

    filteredTransactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        income += amt;
      } else {
        expense += amt;
        if (tx.sphere === 'personal') personalExp += amt;
        else if (tx.sphere === 'work') workExp += amt;
      }
    });

    return {
      totalIncome: income,
      totalExpense: expense,
      personalExpense: personalExp,
      workExpense: workExp,
    };
  }, [filteredTransactions]);

  const netSavings = totalIncome - totalExpense;

  // Group transactions by date descending
  const groupedByDate = useMemo(() => {
    const groups = {};
    const sorted = [...filteredTransactions].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });

    sorted.forEach((tx) => {
      if (!groups[tx.date]) {
        groups[tx.date] = [];
      }
      groups[tx.date].push(tx);
    });

    return Object.entries(groups);
  }, [filteredTransactions]);

  const handleDelete = async (tx) => {
    if (!window.confirm(`Delete "${tx.category}" (₹${tx.amount})?`)) return;
    try {
      await db.transactions.delete(tx.id);
      await syncService.enqueue('transactions', tx.id, 'delete', {
        id: tx.id,
        isDeleted: true,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const formatDateHeader = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-5 pb-20 sm:pb-8">
      {/* Timeframe & Date Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#0d111a] p-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        {/* Timeframe selector pills */}
        <div className="flex bg-gray-100 dark:bg-gray-850 p-1 rounded-xl">
          {['weekly', 'monthly', 'yearly'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-semibold capitalize transition-all ${
                timeframe === tf
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
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
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
            aria-label="Previous period"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 min-w-36 text-center">
            {label}
          </span>
          <button
            onClick={handleNext}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
            aria-label="Next period"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Total Inflow */}
        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ArrowDownRight className="w-4 h-4" />
            <span>Total Inflow</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1">
            ₹{totalIncome.toLocaleString('en-IN')}
          </p>
        </div>

        {/* Total Outflow */}
        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400">
            <ArrowUpRight className="w-4 h-4" />
            <span>Total Outflow</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-gray-900 dark:text-white mt-1">
            ₹{totalExpense.toLocaleString('en-IN')}
          </p>
        </div>

        {/* Net Savings */}
        <div className="col-span-2 sm:col-span-1 bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <span>Net Cashflow</span>
          </div>
          <p
            className={`text-xl sm:text-2xl font-bold font-mono mt-1 ${
              netSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
            }`}
          >
            {netSavings >= 0 ? '+' : ''}₹{netSavings.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Sphere Split Indicator Card */}
      {totalExpense > 0 && (
        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800/80 rounded-2xl p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <User className="w-3 h-3 text-emerald-500" />
              Daily Life: <b className="text-gray-900 dark:text-white font-mono">₹{personalExpense.toLocaleString('en-IN')}</b> ({Math.round((personalExpense / totalExpense) * 100)}%)
            </span>
            <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <Briefcase className="w-3 h-3 text-blue-500" />
              Work: <b className="text-gray-900 dark:text-white font-mono">₹{workExpense.toLocaleString('en-IN')}</b> ({Math.round((workExpense / totalExpense) * 100)}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${(personalExpense / totalExpense) * 100}%` }}
              title="Daily Life"
            />
            <div
              className="h-full bg-blue-500"
              style={{ width: `${(workExpense / totalExpense) * 100}%` }}
              title="Work"
            />
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Sphere Filter */}
        <div className="flex bg-gray-100 dark:bg-gray-850 p-1 rounded-xl border border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setSphereFilter('all')}
            className={`flex-1 py-1 px-3 rounded-lg text-xs font-semibold transition-all ${
              sphereFilter === 'all'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSphereFilter('personal')}
            className={`flex-1 flex items-center justify-center gap-1 py-1 px-3 rounded-lg text-xs font-semibold transition-all ${
              sphereFilter === 'personal'
                ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <User className="w-3 h-3" />
            <span>Daily Life</span>
          </button>
          <button
            onClick={() => setSphereFilter('work')}
            className={`flex-1 flex items-center justify-center gap-1 py-1 px-3 rounded-lg text-xs font-semibold transition-all ${
              sphereFilter === 'work'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
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
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* Transaction List */}
      {groupedByDate.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#0d111a] rounded-2xl border border-gray-200 dark:border-gray-800">
          <Calendar className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-700 mb-2" />
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">No transactions recorded</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Tap the + button to log an expense or income
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map(([dateKey, txList]) => (
            <div key={dateKey} className="space-y-2">
              {/* Date Header */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {formatDateHeader(dateKey)}
                </span>
                <span className="text-xs font-mono font-medium text-gray-400 dark:text-gray-500">
                  {txList.length} {txList.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Transactions in this date */}
              <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800/80 rounded-2xl divide-y divide-gray-100 dark:divide-gray-800/60 overflow-hidden shadow-sm">
                {txList.map((tx) => {
                  const catDef = categoryMap.get(tx.category);
                  const isExpense = tx.type === 'expense';
                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors group"
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
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {tx.category}
                            </span>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                                tx.sphere === 'work'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {tx.sphere === 'work' ? 'Work' : 'Daily'}
                            </span>
                          </div>
                          {tx.note && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
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
                              ? 'text-rose-500 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isExpense ? '-' : '+'}₹{Number(tx.amount).toLocaleString('en-IN')}
                        </span>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onEditTransaction(tx)}
                            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx)}
                            className="p-1 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
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
