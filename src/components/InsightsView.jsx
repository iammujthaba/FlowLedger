import { useState, useMemo } from 'react';
import CategoryIcon from './CategoryIcon';
import {
  User,
  Briefcase
} from 'lucide-react';
import { toIsoDate, parseAnyDate } from '../utils/dateUtils';

export default function InsightsView({ transactions = [], categories = [], vault = {} }) {
  const [period, setPeriod] = useState('month'); // 'month' | 'year' | 'all'
  const [sphereFilter, setSphereFilter] = useState('all'); // 'all' | 'personal' | 'work'

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(c.name, c));
    return map;
  }, [categories]);

  // Filter transactions by period using robust toIsoDate
  const periodTransactions = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${currentYear}-${currentMonth}`;
    const yearPrefix = `${currentYear}`;

    return transactions.filter((tx) => {
      const iso = toIsoDate(tx.date, tx.updatedAt);
      if (period === 'month') return iso.startsWith(monthPrefix);
      if (period === 'year') return iso.startsWith(yearPrefix);
      return true;
    });
  }, [transactions, period]);

  // Overall Financial Metrics for the period (Total Spent, Total Inflow, True Net Cashflow, Sphere totals)
  const {
    totalExpense,
    totalIncome,
    earnedIncome,
    borrowedInflow,
    personalTotal,
    workTotal,
    trueNetCashflow,
  } = useMemo(() => {
    let expense = 0;
    let income = 0;
    let earnedInc = 0;
    let borrowedInc = 0;
    let lentRepayInc = 0;
    let consumptionExp = 0;
    let lentExp = 0;
    let hasEmiPaid = false;
    let pTotal = 0;
    let wTotal = 0;

    periodTransactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      const cat = String(tx.category || '');
      const isLoanLinked = Boolean(tx.relatedLoanId);

      if (tx.type === 'income') {
        income += amt;
        if (cat.includes('Repayment') || cat.includes('IOU Repayment')) {
          lentRepayInc += amt;
        } else if (isLoanLinked || cat.includes('Borrowed') || cat.includes('Money Borrowed')) {
          borrowedInc += amt;
        } else {
          earnedInc += amt;
        }
      } else {
        expense += amt;
        if (cat.includes('Debt Repaid') || cat.includes('Repaid debt')) {
          // debt principal repayments
        } else if (isLoanLinked || cat.includes('Money Lent') || cat.includes('Lent to')) {
          lentExp += amt;
        } else {
          consumptionExp += amt;
          if (cat.includes('Bajaj Finance EMI') || cat.includes('EMI')) {
            hasEmiPaid = true;
          }
          if (tx.sphere === 'personal') pTotal += amt;
          else if (tx.sphere === 'work') wTotal += amt;
        }
      }
    });

    // Monthly EMI obligation (Bajaj Finance ₹1,750 deducted on 2nd of each month)
    const emiMonthlyAmount = Number(vault?.bajaj_emi?.monthlyAmount ?? 1750);
    const pendingEmi = (period === 'month' && !hasEmiPaid) ? emiMonthlyAmount : 0;
    const netMoneyLent = Math.max(0, lentExp - lentRepayInc);
    const trueNet = earnedInc - consumptionExp - netMoneyLent - pendingEmi;

    return {
      totalExpense: expense,
      totalIncome: income,
      earnedIncome: earnedInc,
      borrowedInflow: borrowedInc,
      personalTotal: pTotal,
      workTotal: wTotal,
      trueNetCashflow: trueNet,
    };
  }, [periodTransactions, vault, period]);

  // Proportional percentages for spheres
  const { personalPercent, workPercent } = useMemo(() => {
    if (totalExpense === 0) return { personalPercent: 50, workPercent: 50 };
    const pPct = Math.round((personalTotal / totalExpense) * 100);
    const wPct = 100 - pPct;
    return { personalPercent: pPct, workPercent: wPct };
  }, [personalTotal, totalExpense]);

  // Accurate daily average based on elapsed days in period
  const { dailyAverage, daysElapsed } = useMemo(() => {
    if (totalExpense === 0) return { dailyAverage: 0, daysElapsed: 1 };
    const now = new Date();

    if (period === 'month') {
      const days = Math.max(1, now.getDate());
      return { dailyAverage: Math.round(totalExpense / days), daysElapsed: days };
    }

    if (period === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const days = Math.max(1, Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      return { dailyAverage: Math.round(totalExpense / days), daysElapsed: days };
    }

    // 'all' time
    let days = 1;
    if (periodTransactions.length > 0) {
      let minDate = now;
      periodTransactions.forEach((tx) => {
        const d = parseAnyDate(tx.date);
        if (d && d < minDate) minDate = d;
      });
      days = Math.max(1, Math.floor((now.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }
    return { dailyAverage: Math.round(totalExpense / days), daysElapsed: days };
  }, [totalExpense, period, periodTransactions]);

  // Category breakdown and Top 5 Outflows filtered by sphereFilter ('all' | 'personal' | 'work')
  const { categoryBreakdown, topExpenses, sphereTotalExpense } = useMemo(() => {
    const catSums = {};
    const expList = [];
    let sphereSum = 0;

    periodTransactions.forEach((tx) => {
      if (tx.type !== 'expense') return;
      if (sphereFilter !== 'all' && tx.sphere !== sphereFilter) return;

      const amt = Number(tx.amount) || 0;
      sphereSum += amt;
      catSums[tx.category] = (catSums[tx.category] || 0) + amt;
      expList.push(tx);
    });

    const sortedCats = Object.entries(catSums)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: sphereSum > 0 ? Math.round((amount / sphereSum) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const top5 = [...expList].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5);

    return {
      categoryBreakdown: sortedCats,
      topExpenses: top5,
      sphereTotalExpense: sphereSum,
    };
  }, [periodTransactions, sphereFilter]);

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
        {/* Total Spent */}
        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Spent</p>
            <p className="text-xl font-bold font-mono text-rose-500 dark:text-rose-400 mt-1">
              ₹{totalExpense.toLocaleString('en-IN')}
            </p>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {periodTransactions.filter((tx) => tx.type === 'expense').length} outflows
          </p>
        </div>

        {/* Total Inflow with breakdown */}
        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Inflow</p>
            <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              ₹{totalIncome.toLocaleString('en-IN')}
            </p>
          </div>
          <p className="text-[11px] text-gray-400 mt-1 truncate" title={`Earned: ₹${earnedIncome.toLocaleString('en-IN')} • Borrowed: ₹${borrowedInflow.toLocaleString('en-IN')}`}>
            {borrowedInflow > 0 ? (
              <>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">₹{earnedIncome.toLocaleString('en-IN')}</span> earned
                <span className="mx-1">•</span>
                <span className="text-purple-500 dark:text-purple-400 font-medium">₹{borrowedInflow.toLocaleString('en-IN')}</span> debt
              </>
            ) : totalIncome > 0 ? (
              <span className="text-emerald-500">100% Earned</span>
            ) : (
              '₹0 received'
            )}
          </p>
        </div>

        {/* Daily Average */}
        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Daily Average</p>
            <p className="text-xl font-bold font-mono text-amber-500 mt-1">
              ₹{dailyAverage.toLocaleString('en-IN')}
            </p>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Across {daysElapsed} day{daysElapsed === 1 ? '' : 's'}
          </p>
        </div>

        {/* True Net Cashflow (replaces misleading Savings Rate) */}
        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">True Net Cashflow</p>
            <p
              className={`text-xl font-bold font-mono mt-1 ${
                trueNetCashflow >= 0
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : 'text-rose-500 dark:text-rose-400'
              }`}
            >
              {trueNetCashflow >= 0 ? '+' : '−'}₹{Math.abs(trueNetCashflow).toLocaleString('en-IN')}
            </p>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {trueNetCashflow >= 0 ? 'Surplus cash' : 'Cash deficit (excl debt)'}
          </p>
        </div>
      </div>

      {/* Sphere Split Visual & Dual-Color Ratio Bar */}
      {totalExpense > 0 && (
        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Spending by Sphere
            </h3>
            <span className="text-[11px] font-mono text-gray-400">
              ₹{totalExpense.toLocaleString('en-IN')} total
            </span>
          </div>

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
                {personalPercent}% of total outflows
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
                {workPercent}% of total outflows
              </p>
            </div>
          </div>

          {/* Dual-color continuous ratio bar */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-800 shadow-inner">
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{ width: `${personalPercent}%` }}
                title={`Daily Life: ${personalPercent}%`}
              />
              <div
                className="bg-blue-500 transition-all duration-500"
                style={{ width: `${workPercent}%` }}
                title={`Work: ${workPercent}%`}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-gray-400 font-medium px-0.5">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Daily Life: {personalPercent}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                Work: {workPercent}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown Bars with Sphere Selector */}
      <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Top Spending Categories
            </h3>
            {sphereFilter !== 'all' && (
              <span className="text-[11px] font-mono text-gray-400">
                (₹{sphereTotalExpense.toLocaleString('en-IN')})
              </span>
            )}
          </div>

          {/* Sphere Filter Selector */}
          <div className="flex bg-gray-100 dark:bg-gray-800/80 p-0.5 rounded-lg text-[11px] font-medium self-start sm:self-auto">
            <button
              onClick={() => setSphereFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                sphereFilter === 'all'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs font-semibold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSphereFilter('personal')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                sphereFilter === 'personal'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Daily Life
            </button>
            <button
              onClick={() => setSphereFilter('work')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                sphereFilter === 'work'
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Work
            </button>
          </div>
        </div>

        {categoryBreakdown.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">
            No {sphereFilter !== 'all' ? (sphereFilter === 'personal' ? 'daily life' : 'work') : ''} expenses recorded for this period
          </p>
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
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Biggest Outflows
            </h3>
            {sphereFilter !== 'all' && (
              <span className="text-[10px] font-semibold text-gray-400 uppercase">
                {sphereFilter === 'personal' ? 'Daily Life' : 'Work'}
              </span>
            )}
          </div>

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
