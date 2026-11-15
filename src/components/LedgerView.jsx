import { useState, useMemo } from 'react';
import { db } from '../db/db';
import { syncService } from '../services/syncService';
import CategoryIcon from './CategoryIcon';
import AdvancedFilterModal from './AdvancedFilterModal';
import { INITIAL_FILTERS } from '../constants/filterConstants';
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
  SlidersHorizontal,
  X,
} from 'lucide-react';

export default function LedgerView({
  transactions = [],
  categories = [],
  accounts = [],
  vault = {},
  onEditTransaction,
  onOpenAdjustBalances
}) {
  const [timeframe, setTimeframe] = useState('monthly'); // 'weekly' | 'monthly' | 'yearly'
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [sphereFilter, setSphereFilter] = useState('all'); // 'all' | 'personal' | 'work'
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

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

  // Period transactions (strictly within date window and sphere filter)
  // Powers the top overview cards (Total Inflow, Total Outflow, True Net Cashflow)
  const periodTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const txDateStr = toIsoDate(tx.date, tx.updatedAt);
      if (txDateStr < startDateStr || txDateStr > endDateStr) return false;
      if (sphereFilter !== 'all' && tx.sphere !== sphereFilter) return false;
      return true;
    });
  }, [transactions, startDateStr, endDateStr, sphereFilter]);

  // Detailed metrics accounting for real earned income, borrowed debt, loans, and monthly EMI
  const {
    totalIncome,
    totalExpense,
    earnedIncome,
    borrowedInflow,
    consumptionExpense,
    moneyLentOut,
    hasPaidEmiInPeriod,
    pendingEmiObligation,
    trueNetCashflow,
    personalExpense,
    workExpense,
    earnedCount,
    borrowedCount,
    personalCount,
    workCount,
  } = useMemo(() => {
    let income = 0;
    let expense = 0;
    let earnedInc = 0;
    let borrowedInc = 0;
    let lentRepayInc = 0;
    let consumptionExp = 0;
    let lentExp = 0;
    let hasEmiPaid = false;
    let personalExp = 0;
    let workExp = 0;
    let eCount = 0;
    let bCount = 0;
    let pCount = 0;
    let wCount = 0;

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
          bCount++;
        } else {
          earnedInc += amt;
          eCount++;
        }
      } else {
        expense += amt;
        if (cat.includes('Debt Repaid') || cat.includes('Repaid debt')) {
          // debt repaid tracking
        } else if (isLoanLinked || cat.includes('Money Lent') || cat.includes('Lent to')) {
          lentExp += amt;
        } else {
          consumptionExp += amt;
          if (cat.includes('Bajaj Finance EMI') || cat.includes('EMI')) {
            hasEmiPaid = true;
          }
          if (tx.sphere === 'personal') {
            personalExp += amt;
            pCount++;
          } else if (tx.sphere === 'work') {
            workExp += amt;
            wCount++;
          }
        }
      }
    });

    // Monthly EMI commitment (Bajaj Finance ₹1,750 deducted on 2nd of each month)
    const emiMonthlyAmount = Number(vault?.bajaj_emi?.monthlyAmount ?? 1750);
    const pendingEmi = hasEmiPaid ? 0 : emiMonthlyAmount;

    // Net money lent out in this period (money that left your wallet as loans to others)
    const netMoneyLent = Math.max(0, lentExp - lentRepayInc);

    // True Operational Net Cashflow:
    // Real Earned Income - Living/Work Expenses - Net Money Lent - Monthly EMI
    const trueNet = earnedInc - consumptionExp - netMoneyLent - pendingEmi;

    return {
      totalIncome: income,
      totalExpense: expense,
      earnedIncome: earnedInc,
      borrowedInflow: borrowedInc,
      consumptionExpense: consumptionExp,
      moneyLentOut: lentExp,
      hasPaidEmiInPeriod: hasEmiPaid,
      pendingEmiObligation: pendingEmi,
      trueNetCashflow: trueNet,
      personalExpense: personalExp,
      workExpense: workExp,
      earnedCount: eCount,
      borrowedCount: bCount,
      personalCount: pCount,
      workCount: wCount,
    };
  }, [periodTransactions, vault]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.nature !== 'all') count++;
    if (filters.bank !== 'all') count++;
    if (filters.category !== 'all') count++;
    if (filters.dateScope !== 'period') {
      if (filters.dateScope === 'all_time') count++;
      else if (filters.dateScope === 'single' && filters.exactDate) count++;
      else if (filters.dateScope === 'range' && (filters.startDate || filters.endDate)) count++;
    }
    if (filters.minAmount || filters.maxAmount) count++;
    if (filters.sortBy !== 'date_desc') count++;
    return count;
  }, [filters]);

  // Filtered transactions for the ledger view
  const ledgerTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const txDateStr = toIsoDate(tx.date, tx.updatedAt);
      const cat = String(tx.category || '');
      const isLoanLinked = Boolean(tx.relatedLoanId);

      // 1. Date Scope Filter
      if (filters.dateScope === 'all_time') {
        // No date constraint
      } else if (filters.dateScope === 'single' && filters.exactDate) {
        if (txDateStr !== filters.exactDate) return false;
      } else if (filters.dateScope === 'range') {
        if (filters.startDate && txDateStr < filters.startDate) return false;
        if (filters.endDate && txDateStr > filters.endDate) return false;
      } else {
        // Default period constraint
        if (txDateStr < startDateStr || txDateStr > endDateStr) return false;
      }

      // 2. Sphere Filter (All / Daily Life / Work)
      if (sphereFilter !== 'all' && tx.sphere !== sphereFilter) return false;

      // 3. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchNote = tx.note && tx.note.toLowerCase().includes(query);
        const matchCategory = tx.category && tx.category.toLowerCase().includes(query);
        const matchAmt = String(tx.amount).includes(query);
        if (!matchNote && !matchCategory && !matchAmt) return false;
      }

      // 4. Nature Filter
      if (filters.nature === 'earned') {
        if (
          tx.type !== 'income' ||
          isLoanLinked ||
          cat.includes('Borrowed') ||
          cat.includes('Money Borrowed') ||
          cat.includes('Repayment') ||
          cat.includes('IOU')
        ) {
          return false;
        }
      } else if (filters.nature === 'borrowed') {
        if (
          tx.type !== 'income' ||
          (!isLoanLinked && !cat.includes('Borrowed') && !cat.includes('Money Borrowed'))
        ) {
          return false;
        }
      } else if (filters.nature === 'all_income') {
        if (tx.type !== 'income') return false;
      } else if (filters.nature === 'personal_expense') {
        if (
          tx.type !== 'expense' ||
          tx.sphere !== 'personal' ||
          isLoanLinked ||
          cat.includes('Money Lent') ||
          cat.includes('Lent to')
        ) {
          return false;
        }
      } else if (filters.nature === 'work_expense') {
        if (
          tx.type !== 'expense' ||
          tx.sphere !== 'work' ||
          isLoanLinked ||
          cat.includes('Money Lent') ||
          cat.includes('Lent to')
        ) {
          return false;
        }
      } else if (filters.nature === 'money_lent') {
        if (
          tx.type !== 'expense' ||
          (!isLoanLinked && !cat.includes('Money Lent') && !cat.includes('Lent to'))
        ) {
          return false;
        }
      } else if (filters.nature === 'all_expense') {
        if (tx.type !== 'expense') return false;
      }

      // 5. Bank Account Filter
      if (filters.bank !== 'all' && tx.account !== filters.bank) {
        return false;
      }

      // 6. Category Filter
      if (filters.category !== 'all' && tx.category !== filters.category) {
        return false;
      }

      // 7. Amount Min/Max Range
      const amt = Number(tx.amount);
      if (filters.minAmount && amt < Number(filters.minAmount)) return false;
      if (filters.maxAmount && amt > Number(filters.maxAmount)) return false;

      return true;
    });
  }, [transactions, startDateStr, endDateStr, sphereFilter, searchQuery, filters]);

  // Aggregate stats of filtered results
  const filteredStats = useMemo(() => {
    let inf = 0;
    let outf = 0;
    ledgerTransactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') inf += amt;
      else outf += amt;
    });
    return { inflow: inf, outflow: outf };
  }, [ledgerTransactions]);

  // Group transactions by date descending or user sort
  const groupedByDate = useMemo(() => {
    const isAmountSort = filters.sortBy?.startsWith('amount');
    const sorted = [...ledgerTransactions].sort((a, b) => {
      if (filters.sortBy === 'amount_desc') {
        return Number(b.amount) - Number(a.amount);
      }
      if (filters.sortBy === 'amount_asc') {
        return Number(a.amount) - Number(b.amount);
      }
      if (filters.sortBy === 'date_asc') {
        const aDate = toIsoDate(a.date, a.updatedAt);
        const bDate = toIsoDate(b.date, b.updatedAt);
        if (aDate !== bDate) return aDate.localeCompare(bDate);
        return (a.updatedAt || '').localeCompare(b.updatedAt || '');
      }
      // default: date_desc
      const aDate = toIsoDate(a.date, a.updatedAt);
      const bDate = toIsoDate(b.date, b.updatedAt);
      if (aDate !== bDate) return bDate.localeCompare(aDate);
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });

    if (isAmountSort) {
      return [['Sorted by Amount', sorted]];
    }

    const groups = {};
    sorted.forEach((tx) => {
      const cleanKey = toIsoDate(tx.date, tx.updatedAt);
      if (!groups[cleanKey]) {
        groups[cleanKey] = [];
      }
      groups[cleanKey].push(tx);
    });

    return Object.entries(groups);
  }, [ledgerTransactions, filters.sortBy]);

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setSearchQuery('');
  };

  const getNatureLabel = (n) => {
    switch (n) {
      case 'earned': return 'Earned Only';
      case 'borrowed': return 'Borrowed (Debt)';
      case 'all_income': return 'All Inflow';
      case 'personal_expense': return 'Daily Life Exp';
      case 'work_expense': return 'Work Exp';
      case 'money_lent': return 'Money Lent';
      case 'all_expense': return 'All Outflow';
      default: return n;
    }
  };

  const getDateScopeLabel = (f) => {
    if (f.dateScope === 'all_time') return 'All Time';
    if (f.dateScope === 'single') return `Date: ${f.exactDate || 'Selected'}`;
    if (f.dateScope === 'range') return `${f.startDate || '...'} to ${f.endDate || '...'}`;
    return 'Period';
  };

  const getSortLabel = (s) => {
    switch (s) {
      case 'date_asc': return 'Oldest First';
      case 'amount_desc': return 'Highest Amount';
      case 'amount_asc': return 'Lowest Amount';
      default: return 'Newest First';
    }
  };

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
        <div className="bg-[#0d111a] border border-gray-800/80 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <ArrowDownRight className="w-4 h-4" />
              <span>Total Inflow</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
              ₹{totalIncome.toLocaleString('en-IN')}
            </p>
          </div>
          {borrowedInflow > 0 ? (
            <div className="text-[10px] text-gray-400 mt-2 pt-1.5 border-t border-gray-800/60 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="truncate">Earned: <b className="text-emerald-400 font-mono">₹{earnedIncome.toLocaleString('en-IN')}</b></span>
                <span className="text-[9px] text-gray-500 font-mono shrink-0 ml-1.5">{earnedCount} {earnedCount === 1 ? 'item' : 'items'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="truncate">Borrowed: <b className="text-rose-400 font-mono">₹{borrowedInflow.toLocaleString('en-IN')}</b></span>
                <span className="text-[9px] text-gray-500 font-mono shrink-0 ml-1.5">{borrowedCount} {borrowedCount === 1 ? 'item' : 'items'}</span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-gray-500 mt-2 pt-1.5 border-t border-gray-800/60 flex items-center justify-between">
              <span className="truncate">100% Real Earned Income</span>
              <span className="text-[9px] text-gray-500 font-mono shrink-0 ml-1.5">{earnedCount} {earnedCount === 1 ? 'item' : 'items'}</span>
            </div>
          )}
        </div>

        {/* Total Outflow */}
        <div className="bg-[#0d111a] border border-gray-800/80 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
              <span>Total Outflow</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold font-mono text-white mt-1">
              ₹{totalExpense.toLocaleString('en-IN')}
            </p>
          </div>
          {moneyLentOut > 0 ? (
            <div className="text-[10px] text-gray-400 mt-2 pt-1.5 border-t border-gray-800/60 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="truncate">Spent: <b className="text-white font-mono">₹{consumptionExpense.toLocaleString('en-IN')}</b></span>
                <span className="text-[9px] text-gray-500 font-mono shrink-0 ml-1.5">{personalCount + workCount} items</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="truncate">Lent: <b className="text-purple-400 font-mono">₹{moneyLentOut.toLocaleString('en-IN')}</b></span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-gray-400 mt-2 pt-1.5 border-t border-gray-800/60 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="truncate">Daily: <b className="text-emerald-400/90 font-mono">₹{personalExpense.toLocaleString('en-IN')}</b></span>
                <span className="text-[9px] text-gray-500 font-mono shrink-0 ml-1.5">{personalCount} {personalCount === 1 ? 'item' : 'items'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="truncate">Work: <b className="text-blue-400/90 font-mono">₹{workExpense.toLocaleString('en-IN')}</b></span>
                <span className="text-[9px] text-gray-500 font-mono shrink-0 ml-1.5">{workCount} {workCount === 1 ? 'item' : 'items'}</span>
              </div>
            </div>
          )}
        </div>

        {/* True Net Cashflow */}
        <div className="col-span-2 sm:col-span-1 bg-[#0d111a] border border-gray-800/80 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-gray-400">
              <span>True Net Cashflow</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  trueNetCashflow >= 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {trueNetCashflow >= 0 ? 'Surplus' : 'Deficit'}
              </span>
            </div>
            <p
              className={`text-xl sm:text-2xl font-bold font-mono mt-1 ${
                trueNetCashflow >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {trueNetCashflow >= 0 ? '+' : ''}₹{trueNetCashflow.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="text-[10px] text-gray-400 mt-2 pt-1.5 border-t border-gray-800/60 flex items-center justify-between flex-wrap gap-1">
            <span>
              {pendingEmiObligation > 0
                ? `Includes ₹${pendingEmiObligation.toLocaleString('en-IN')} EMI (Ded. 2nd)`
                : hasPaidEmiInPeriod
                ? 'EMI Paid (Ded. 2nd)'
                : 'After all commitments'}
            </span>
            {borrowedInflow > 0 && (
              <span className="text-amber-400 font-mono font-medium">(Covered by ₹{borrowedInflow.toLocaleString('en-IN')} borrowed)</span>
            )}
          </div>
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

          {/* Search & Filter Button */}
          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search note, category, or amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-[#0d111a] border border-gray-800 rounded-xl text-xs text-white placeholder-gray-400 outline-none focus:border-emerald-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Advanced Filter Button (matches Total Available Balance button styling) */}
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(true)}
              className={`p-2 rounded-xl border transition-all shadow-sm active:scale-95 relative ${
                activeFilterCount > 0
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400 font-semibold'
                  : 'bg-gray-850 hover:bg-gray-800 text-gray-300 hover:text-white border-gray-750'
              }`}
              title="Advanced Filter & Sort"
              aria-label="Filter transactions"
            >
              <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-extrabold text-black flex items-center justify-center shadow-md">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Active Filter Chips Strip */}
        {(activeFilterCount > 0 || searchQuery.trim()) && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[10px] text-gray-400 font-semibold shrink-0 uppercase tracking-wider">
              Filters:
            </span>

            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-800 border border-gray-750 text-[10px] text-gray-300 font-medium shrink-0 hover:bg-gray-750"
              >
                <span>Search: &quot;{searchQuery}&quot;</span>
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}

            {filters.nature !== 'all' && (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, nature: 'all' }))}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-medium shrink-0 hover:bg-emerald-500/20"
              >
                <span>{getNatureLabel(filters.nature)}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {filters.bank !== 'all' && (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, bank: 'all' }))}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[10px] text-blue-400 font-medium shrink-0 hover:bg-blue-500/20"
              >
                <span>Bank: {accountMap.get(filters.bank)?.shortName || filters.bank.toUpperCase()}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {filters.dateScope !== 'period' && (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, dateScope: 'period', exactDate: '', startDate: '', endDate: '' }))}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-400 font-medium shrink-0 hover:bg-amber-500/20"
              >
                <span>{getDateScopeLabel(filters)}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {filters.category !== 'all' && (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, category: 'all' }))}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-pink-500/10 border border-pink-500/30 text-[10px] text-pink-400 font-medium shrink-0 hover:bg-pink-500/20"
              >
                <span>{filters.category}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {(filters.minAmount || filters.maxAmount) && (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, minAmount: '', maxAmount: '' }))}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-[10px] text-purple-400 font-medium shrink-0 hover:bg-purple-500/20"
              >
                <span>
                  {filters.minAmount && filters.maxAmount
                    ? `₹${filters.minAmount} - ₹${filters.maxAmount}`
                    : filters.minAmount
                    ? `≥ ₹${filters.minAmount}`
                    : `≤ ₹${filters.maxAmount}`}
                </span>
                <X className="w-3 h-3" />
              </button>
            )}

            {filters.sortBy !== 'date_desc' && (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, sortBy: 'date_desc' }))}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-800 border border-gray-700 text-[10px] text-gray-300 font-medium shrink-0 hover:bg-gray-750"
              >
                <span>Sort: {getSortLabel(filters.sortBy)}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[10px] text-rose-400/80 hover:text-rose-400 font-semibold px-1.5 py-0.5 shrink-0"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Filtered Results Summary Bar */}
        {(activeFilterCount > 0 || searchQuery.trim()) && (
          <div className="bg-[#0d111a] border border-gray-800 rounded-2xl p-3 flex items-center justify-between shadow-sm">
            <span className="text-xs text-gray-400">
              Found <b className="text-white font-mono">{ledgerTransactions.length}</b> {ledgerTransactions.length === 1 ? 'item' : 'items'}
            </span>
            <div className="flex items-center gap-2.5 font-mono text-xs">
              {filteredStats.inflow > 0 && (
                <span className="text-emerald-400 font-semibold">
                  Inflow: +₹{filteredStats.inflow.toLocaleString('en-IN')}
                </span>
              )}
              {filteredStats.outflow > 0 && (
                <span className="text-rose-400 font-semibold">
                  Outflow: -₹{filteredStats.outflow.toLocaleString('en-IN')}
                </span>
              )}
              {filteredStats.inflow === 0 && filteredStats.outflow === 0 && (
                <span className="text-gray-500 font-mono">₹0</span>
              )}
            </div>
          </div>
        )}

        {/* Contextual Banner when filtered by Daily Life or Work */}
        {sphereFilter === 'personal' ? (
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
        ) : sphereFilter === 'work' ? (
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
        ) : null}
      </div>

      {/* Transaction List */}
      {groupedByDate.length === 0 ? (
        <div className="text-center py-12 bg-[#0d111a] rounded-2xl border border-gray-800">
          <Calendar className="w-10 h-10 mx-auto text-gray-700 mb-2" />
          <p className="text-sm font-semibold text-gray-400">
            {activeFilterCount > 0 || searchQuery.trim()
              ? 'No matching transactions found'
              : 'No transactions recorded'}
          </p>
          <div className="text-xs text-gray-500 mt-1">
            {activeFilterCount > 0 || searchQuery.trim() ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-emerald-400 hover:underline font-semibold"
              >
                Clear all filters
              </button>
            ) : (
              'Tap the + button to log an expense or income'
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map(([dateKey, txList]) => {
            let dayInflow = 0;
            let dayOutflow = 0;
            txList.forEach((tx) => {
              const amt = Number(tx.amount) || 0;
              if (tx.type === 'income') dayInflow += amt;
              else dayOutflow += amt;
            });

            return (
              <div key={dateKey} className="space-y-2">
                {/* Date Header with Day's Total Sum & Items Count */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider truncate mr-2">
                    {formatDateHeader(dateKey)}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono shrink-0 text-xs text-gray-400">
                    {dayInflow > 0 && (
                      <span className="font-medium">
                        +₹{dayInflow.toLocaleString('en-IN')}{dayOutflow > 0 ? ',' : ''}
                      </span>
                    )}
                    {dayOutflow > 0 && (
                      <span className="font-medium">
                        -₹{dayOutflow.toLocaleString('en-IN')}
                      </span>
                    )}
                    <span className="text-gray-500 text-[11px]">
                      • {txList.length} {txList.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
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
          );
        })}
        </div>
      )}

      {/* Advanced Filter & Sort Modal */}
      <AdvancedFilterModal
        key={isFilterModalOpen ? 'filter-modal-open' : 'filter-modal-closed'}
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApplyFilters={(newFilters) => setFilters(newFilters)}
        onResetFilters={handleResetFilters}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
