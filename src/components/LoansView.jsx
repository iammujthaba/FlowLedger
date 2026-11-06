import { useState, useMemo } from 'react';
import { db } from '../db/db';
import { syncService } from '../services/syncService';
import {
  Users,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Trash2,
  X
} from 'lucide-react';

export default function LoansView({ loans = [] }) {
  const [activeTab, setActiveTab] = useState('lent'); // 'lent' | 'borrowed'
  const [showAddModal, setShowAddModal] = useState(false);
  const [settleLoan, setSettleLoan] = useState(null);
  const [repaymentAmount, setRepaymentAmount] = useState('');

  // Form states for adding loan
  const [personName, setPersonName] = useState('');
  const [loanType, setLoanType] = useState('lent');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Calculated summaries
  const { totalLentPending, totalBorrowedPending } = useMemo(() => {
    let lent = 0;
    let borrowed = 0;

    loans.forEach((l) => {
      if (l.status !== 'settled') {
        const remaining = Number(l.remainingAmount ?? l.amount) || 0;
        if (l.type === 'lent') lent += remaining;
        else if (l.type === 'borrowed') borrowed += remaining;
      }
    });

    return { totalLentPending: lent, totalBorrowedPending: borrowed };
  }, [loans]);

  const filteredLoans = useMemo(() => {
    return loans
      .filter((l) => l.type === activeTab)
      .sort((a, b) => {
        // Pending first, then by date desc
        if (a.status === 'pending' && b.status === 'settled') return -1;
        if (a.status === 'settled' && b.status === 'pending') return 1;
        return (b.date || '').localeCompare(a.date || '');
      });
  }, [loans, activeTab]);

  const handleCreateLoan = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!personName.trim() || !parsedAmount || parsedAmount <= 0) return;

    try {
      const now = new Date().toISOString();
      const id = `loan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const newLoan = {
        id,
        personName: personName.trim(),
        type: loanType,
        amount: parsedAmount,
        remainingAmount: parsedAmount,
        date: date || new Date().toISOString().split('T')[0],
        dueDate: dueDate || '',
        status: 'pending',
        notes: notes.trim(),
        updatedAt: now,
        syncStatus: 'pending',
      };

      await db.loans.put(newLoan);
      await syncService.enqueue('loans', id, 'upsert', {
        ...newLoan,
        isDeleted: false,
      });

      // Reset
      setPersonName('');
      setAmount('');
      setDueDate('');
      setNotes('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to create loan:', err);
    }
  };

  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!settleLoan) return;

    const repay = parseFloat(repaymentAmount);
    if (!repay || repay <= 0) return;

    try {
      const currentRemaining = Number(settleLoan.remainingAmount ?? settleLoan.amount);
      const newRemaining = Math.max(0, currentRemaining - repay);
      const newStatus = newRemaining === 0 ? 'settled' : 'partially_paid';
      const now = new Date().toISOString();

      const updated = {
        ...settleLoan,
        remainingAmount: newRemaining,
        status: newStatus,
        updatedAt: now,
        syncStatus: 'pending',
      };

      await db.loans.put(updated);
      await syncService.enqueue('loans', updated.id, 'upsert', {
        ...updated,
        isDeleted: false,
      });

      setSettleLoan(null);
      setRepaymentAmount('');
    } catch (err) {
      console.error('Failed to settle loan:', err);
    }
  };

  const handleDeleteLoan = async (loan) => {
    if (!window.confirm(`Delete record with ${loan.personName}?`)) return;
    try {
      await db.loans.delete(loan.id);
      await syncService.enqueue('loans', loan.id, 'delete', {
        id: loan.id,
        isDeleted: true,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to delete loan:', err);
    }
  };

  return (
    <div className="space-y-5 pb-20 sm:pb-8">
      {/* Header and Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Informal Loans & IOUs
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Track money lent to or borrowed from friends & family
          </p>
        </div>
        <button
          onClick={() => {
            setLoanType(activeTab);
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New IOU</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total to collect */}
        <div
          onClick={() => setActiveTab('lent')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === 'lent'
              ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/30'
              : 'bg-white dark:bg-[#0d111a] border-gray-200 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="w-4 h-4" />
            <span>Money Lent (To Collect)</span>
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            ₹{totalLentPending.toLocaleString('en-IN')}
          </p>
        </div>

        {/* Total to repay */}
        <div
          onClick={() => setActiveTab('borrowed')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            activeTab === 'borrowed'
              ? 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/30'
              : 'bg-white dark:bg-[#0d111a] border-gray-200 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 dark:text-rose-400">
            <ArrowDownLeft className="w-4 h-4" />
            <span>Money Borrowed (To Repay)</span>
          </div>
          <p className="text-2xl font-bold font-mono text-rose-500 dark:text-rose-400 mt-1">
            ₹{totalBorrowedPending.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-gray-100 dark:bg-gray-850 p-1 rounded-xl border border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('lent')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'lent'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Money Lent ({loans.filter((l) => l.type === 'lent' && l.status !== 'settled').length} active)
        </button>
        <button
          onClick={() => setActiveTab('borrowed')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'borrowed'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Money Borrowed ({loans.filter((l) => l.type === 'borrowed' && l.status !== 'settled').length} active)
        </button>
      </div>

      {/* Loan Items List */}
      {filteredLoans.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#0d111a] rounded-2xl border border-gray-200 dark:border-gray-800">
          <Users className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-700 mb-2" />
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
            No {activeTab === 'lent' ? 'lent' : 'borrowed'} money records
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Click &quot;New IOU&quot; to log informal agreements
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLoans.map((loan) => {
            const isSettled = loan.status === 'settled';
            const remaining = Number(loan.remainingAmount ?? loan.amount);

            return (
              <div
                key={loan.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isSettled
                    ? 'bg-gray-50/60 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800/60 opacity-60'
                    : 'bg-white dark:bg-[#0d111a] border-gray-200 dark:border-gray-800 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                        {loan.personName}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSettled
                            ? 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            : loan.status === 'partially_paid'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {isSettled ? 'Settled' : loan.status === 'partially_paid' ? 'Partial' : 'Pending'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Given on: {new Date(loan.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {loan.dueDate && (
                        <span> • Due: {new Date(loan.dueDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      )}
                    </p>

                    {loan.notes && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 italic mt-1.5">
                        &quot;{loan.notes}&quot;
                      </p>
                    )}
                  </div>

                  {/* Amounts */}
                  <div className="text-right">
                    <p className="text-base font-bold font-mono text-gray-900 dark:text-white">
                      ₹{remaining.toLocaleString('en-IN')}
                    </p>
                    {remaining !== Number(loan.amount) && (
                      <p className="text-[11px] text-gray-400 line-through font-mono">
                        ₹{Number(loan.amount).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                {!isSettled && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <button
                      onClick={() => handleDeleteLoan(loan)}
                      className="text-xs text-gray-400 hover:text-rose-500 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>

                    <button
                      onClick={() => {
                        setSettleLoan(loan);
                        setRepaymentAmount(String(remaining));
                      }}
                      className="py-1 px-3 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-all flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Record Payment / Settle</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#0d111a] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-5 space-y-4 animate-modal-in">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Record Informal IOU / Loan
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="space-y-3">
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setLoanType('lent')}
                  className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                    loanType === 'lent'
                      ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-gray-500'
                  }`}
                >
                  I Lent (They owe me)
                </button>
                <button
                  type="button"
                  onClick={() => setLoanType('borrowed')}
                  className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                    loanType === 'borrowed'
                      ? 'bg-white dark:bg-gray-700 text-rose-500 dark:text-rose-400 shadow-sm'
                      : 'text-gray-500'
                  }`}
                >
                  I Borrowed (I owe them)
                </button>
              </div>

              {/* Person Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Friend or Family Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul, Aunt Mary..."
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-base font-bold font-mono text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Date Given / Taken
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Expected Due Date (Opt)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Agreement Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Promised to return by end of next month"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-md transition-all mt-2"
              >
                Save Record
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Settle Repayment Modal */}
      {settleLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#0d111a] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-5 space-y-4 animate-modal-in">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Record Payment for {settleLoan.personName}
              </h3>
              <button
                onClick={() => setSettleLoan(null)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="space-y-3">
              <p className="text-xs text-gray-500">
                Current outstanding balance: <b className="text-gray-900 dark:text-white font-mono">₹{Number(settleLoan.remainingAmount ?? settleLoan.amount).toLocaleString('en-IN')}</b>
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Repayment Amount (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  max={settleLoan.remainingAmount ?? settleLoan.amount}
                  value={repaymentAmount}
                  onChange={(e) => setRepaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-lg font-bold font-mono text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRepaymentAmount(String(settleLoan.remainingAmount ?? settleLoan.amount))}
                  className="flex-1 py-1.5 px-2 rounded-lg text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Pay Full Balance
                </button>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-md transition-all mt-2"
              >
                Confirm Settlement
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
