import { useState, useMemo } from 'react';
import CategoryIcon from './CategoryIcon';
import {
  User,
  Briefcase
} from 'lucide-react';

export default function InsightsView({ transactions = [], categories = [] }) {
  const [period, setPeriod] = useState('month'); // 'month' | 'year' | 'all'

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(c.name, c));
    return map;
  }, [categories]);

  // Filter transactions by period
  const filtered = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${currentYear}-${currentMonth}`;
    const yearPrefix = `${currentYear}`;

    return transactions.filter((tx) => {
      if (period === 'month') return tx.date && tx.date.startsWith(monthPrefix);
      if (period === 'year') return tx.date && tx.date.startsWith(yearPrefix);
      return true;
    });
  }, [transactions, period]);

  // Aggregate Category Spends (Expenses only)
  const { categoryBreakdown, totalExpense, totalIncome, personalTotal, workTotal, topExpenses } =
    useMemo(() => {
      let expense = 0;
      let income = 0;
      let pTotal = 0;
      let wTotal = 0;
      const catSums = {};
      const expList = [];

      filtered.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'expense') {
          expense += amt;
          catSums[tx.category] = (catSums[tx.category] || 0) + amt;
          expList.push(tx);
          if (tx.sphere === 'personal') pTotal += amt;
          else if (tx.sphere === 'work') wTotal += amt;
        } else if (tx.type === 'income') {
          income += amt;
        }
      });

      // Sort categories descending
      const sortedCats = Object.entries(catSums)
        .map(([name, amount]) => ({
          name,
          amount,
          percentage: expense > 0 ? Math.round((amount / expense) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      // Sort individual expenses descending
      const top5 = [...expList].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5);

      return {
        categoryBreakdown: sortedCats,
        totalExpense: expense,
        totalIncome: income,
        personalTotal: pTotal,
        workTotal: wTotal,
        topExpenses: top5,
      };
    }, [filtered]);

  // Estimate daily average
  const dailyAverage = useMemo(() => {
    if (totalExpense === 0) return 0;
    const now = new Date();
    const dayOfMonth = now.getDate();
    return period === 'month' ? Math.round(totalExpense / dayOfMonth) : Math.round(totalExpense / 30);
  }, [totalExpense, period]);

  return (
    <div className="space-y-5 pb-20 sm:pb-8">
      {/* Header & Period Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Insights & Spending Analytics
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Categorical breakdowns and cashflow patterns
          </p>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          {[
            { id: 'month', label: 'This Month' },
            { id: 'year', label: 'This Year' },
            { id: 'all', label: 'All Time' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id)}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                period === item.id
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Spent</p>
          <p className="text-xl font-bold font-mono text-rose-500 dark:text-rose-400 mt-1">
            ₹{totalExpense.toLocaleString('en-IN')}
          </p>
        </div>

        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Inflow</p>
          <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            ₹{totalIncome.toLocaleString('en-IN')}
          </p>
        </div>

        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400">Daily Average</p>
          <p className="text-xl font-bold font-mono text-amber-500 mt-1">
            ₹{dailyAverage.toLocaleString('en-IN')}
          </p>
        </div>

        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400">Savings Rate</p>
          <p className="text-xl font-bold font-mono text-indigo-500 mt-1">
            {totalIncome > 0 ? `${Math.max(0, Math.round(((totalIncome - totalExpense) / totalIncome) * 100))}%` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Sphere Split Visual */}
      {totalExpense > 0 && (
        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Spending by Sphere
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <User className="w-4 h-4" />
                <span>Daily Life (Personal)</span>
              </div>
              <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
                ₹{personalTotal.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {Math.round((personalTotal / totalExpense) * 100)}% of total outflows
              </p>
            </div>

            <div className="p-3 rounded-xl bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <Briefcase className="w-4 h-4" />
                <span>Work-Related</span>
              </div>
              <p className="text-xl font-bold font-mono text-gray-900 dark:text-white mt-1">
                ₹{workTotal.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {Math.round((workTotal / totalExpense) * 100)}% of total outflows
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown Bars */}
      <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Top Spending Categories
        </h3>

        {categoryBreakdown.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No expenses recorded for this period</p>
        ) : (
          <div className="space-y-3">
            {categoryBreakdown.map((cat) => {
              const catDef = categoryMap.get(cat.name);
              const color = catDef?.color || '#10b981';

              return (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}15` }}
                      >
                        <CategoryIcon name={catDef?.icon || 'CircleDollarSign'} className="w-3 h-3" color={color} />
                      </div>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {cat.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-gray-900 dark:text-white">
                        ₹{cat.amount.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[11px] text-gray-400 w-8 text-right font-mono">
                        {cat.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${cat.percentage}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top 5 Largest Spends */}
      {topExpenses.length > 0 && (
        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Biggest Outflows
          </h3>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {topExpenses.map((tx) => (
              <div key={tx.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">
                    {tx.category}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {tx.date} {tx.note ? `• ${tx.note}` : ''}
                  </p>
                </div>
                <span className="text-xs font-bold font-mono text-rose-500 dark:text-rose-400">
                  -₹{Number(tx.amount).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
