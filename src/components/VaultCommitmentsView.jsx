import { useState } from 'react';
import { db } from '../db/db';
import { syncService } from '../services/syncService';
import {
  CreditCard,
  Home,
  CheckCircle2,
  Edit3,
  X
} from 'lucide-react';

export default function VaultCommitmentsView({ vault = {} }) {
  const [showUsdtModal, setShowUsdtModal] = useState(false);
  const [usdtInput, setUsdtInput] = useState('');
  const [showRentModal, setShowRentModal] = useState(false);
  const [rentInput, setRentInput] = useState('');

  const usdtBalance = Number(vault.usdt_balance ?? 0);
  const emiData = vault.bajaj_emi || {
    monthlyAmount: 1750,
    dueDay: 5,
    totalMonths: 12,
    paidMonths: 0,
    startDate: '2026-11-01',
    lender: 'Bajaj Finance',
  };
  const rentData = vault.rent_config || {
    monthlyAmount: 0,
    dueDay: 1,
  };

  // Record EMI payment into the ledger with 1 tap
  const handlePayEmi = async () => {
    const confirmMsg = `Record ₹${emiData.monthlyAmount} EMI payment for this month?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const now = new Date().toISOString();
      const dateStr = now.split('T')[0];
      const txId = `tx_emi_${Date.now()}`;

      // 1. Add expense transaction
      const txRecord = {
        id: txId,
        date: dateStr,
        sphere: 'personal',
        type: 'expense',
        category: 'Bajaj Finance EMI',
        amount: Number(emiData.monthlyAmount),
        note: `Bajaj Finance EMI - Month ${(emiData.paidMonths || 0) + 1} of ${emiData.totalMonths}`,
        updatedAt: now,
        syncStatus: 'pending',
      };
      await db.transactions.put(txRecord);
      await syncService.enqueue('transactions', txId, 'upsert', {
        ...txRecord,
        isDeleted: false,
      });

      // 2. Update EMI counter
      const updatedEmi = {
        ...emiData,
        paidMonths: Math.min(emiData.totalMonths, (emiData.paidMonths || 0) + 1),
      };
      await db.vault.put({ key: 'bajaj_emi', value: updatedEmi, updatedAt: now });
      await syncService.enqueue('vault', 'bajaj_emi', 'upsert', {
        key: 'bajaj_emi',
        value: updatedEmi,
        updatedAt: now,
      });
    } catch (err) {
      console.error('Failed to log EMI:', err);
    }
  };

  // Record Rent payment into ledger with 1 tap
  const handlePayRent = async () => {
    if (!rentData.monthlyAmount || rentData.monthlyAmount <= 0) {
      setShowRentModal(true);
      return;
    }

    const confirmMsg = `Record ₹${rentData.monthlyAmount} House Rent payment?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const now = new Date().toISOString();
      const dateStr = now.split('T')[0];
      const txId = `tx_rent_${Date.now()}`;

      const txRecord = {
        id: txId,
        date: dateStr,
        sphere: 'personal',
        type: 'expense',
        category: 'House Rent',
        amount: Number(rentData.monthlyAmount),
        note: `Monthly House Rent payment`,
        updatedAt: now,
        syncStatus: 'pending',
      };
      await db.transactions.put(txRecord);
      await syncService.enqueue('transactions', txId, 'upsert', {
        ...txRecord,
        isDeleted: false,
      });
    } catch (err) {
      console.error('Failed to log Rent:', err);
    }
  };

  // Save USDT Balance
  const handleSaveUsdt = async (e) => {
    e.preventDefault();
    const parsed = parseFloat(usdtInput);
    if (isNaN(parsed) || parsed < 0) return;

    try {
      const now = new Date().toISOString();
      await db.vault.put({ key: 'usdt_balance', value: parsed, updatedAt: now });
      await syncService.enqueue('vault', 'usdt_balance', 'upsert', {
        key: 'usdt_balance',
        value: parsed,
        updatedAt: now,
      });
      setShowUsdtModal(false);
    } catch (err) {
      console.error('Failed to update USDT balance:', err);
    }
  };

  // Save Rent Config
  const handleSaveRent = async (e) => {
    e.preventDefault();
    const parsed = parseFloat(rentInput);
    if (isNaN(parsed) || parsed < 0) return;

    try {
      const now = new Date().toISOString();
      const updatedRent = { ...rentData, monthlyAmount: parsed };
      await db.vault.put({ key: 'rent_config', value: updatedRent, updatedAt: now });
      await syncService.enqueue('vault', 'rent_config', 'upsert', {
        key: 'rent_config',
        value: updatedRent,
        updatedAt: now,
      });
      setShowRentModal(false);
    } catch (err) {
      console.error('Failed to update Rent config:', err);
    }
  };

  const emiPercentage = Math.round(((emiData.paidMonths || 0) / (emiData.totalMonths || 12)) * 100);

  return (
    <div className="space-y-5 pb-20 sm:pb-8">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          Vault & Fixed Commitments
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Fixed recurring payments and Binance USDT crypto swing reserve
        </p>
      </div>

      {/* ─── USDT Crypto Savings Card ─── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 rounded-3xl p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                ₮
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Binance USDT Vault
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Low-Risk Swing Trade Reserve
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-3xl font-extrabold font-mono text-gray-900 dark:text-white">
                ${usdtBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-xs font-semibold text-amber-500 ml-1.5">USDT</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ≈ ₹{(usdtBalance * 87).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (Estimated at ~₹87/USDT)
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setUsdtInput(String(usdtBalance));
              setShowUsdtModal(true);
            }}
            className="p-2 rounded-xl border border-amber-500/30 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-colors"
            title="Update USDT Balance"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Fixed Commitments ─── */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
          Monthly Commitments
        </h3>

        {/* Bajaj Finance EMI */}
        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Bajaj Finance EMI
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Fixed monthly commitment • Due around 5th
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-lg font-bold font-mono text-gray-900 dark:text-white">
                ₹{emiData.monthlyAmount.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-gray-400 font-mono">/ month</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Progress: {emiData.paidMonths || 0} of {emiData.totalMonths} months paid</span>
              <span className="font-mono font-bold text-indigo-500">{emiPercentage}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${emiPercentage}%` }}
              />
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between">
            <span className="text-[11px] text-gray-400">
              Remaining: ₹{((emiData.totalMonths - (emiData.paidMonths || 0)) * emiData.monthlyAmount).toLocaleString('en-IN')}
            </span>

            <button
              onClick={handlePayEmi}
              className="py-1.5 px-3 rounded-xl text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white border border-indigo-500/20 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Log Month&apos;s EMI Paid</span>
            </button>
          </div>
        </div>

        {/* Monthly House Rent */}
        <div className="bg-white dark:bg-[#0d111a] border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  House Rent
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Monthly recurring accommodation
                </p>
              </div>
            </div>

            <div className="text-right">
              {rentData.monthlyAmount > 0 ? (
                <>
                  <p className="text-lg font-bold font-mono text-gray-900 dark:text-white">
                    ₹{Number(rentData.monthlyAmount).toLocaleString('en-IN')}
                  </p>
                  <p className="text-[11px] text-gray-400 font-mono">/ month</p>
                </>
              ) : (
                <button
                  onClick={() => setShowRentModal(true)}
                  className="text-xs text-emerald-500 hover:underline"
                >
                  Set Rent Amount
                </button>
              )}
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between">
            <button
              onClick={() => {
                setRentInput(String(rentData.monthlyAmount || ''));
                setShowRentModal(true);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              Edit Rent Details
            </button>

            <button
              onClick={handlePayRent}
              className="py-1.5 px-3 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Log Rent Paid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Edit USDT Modal */}
      {showUsdtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#0d111a] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-5 space-y-4 animate-modal-in">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Update Binance USDT Reserve
              </h3>
              <button
                onClick={() => setShowUsdtModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUsdt} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Current Balance in Binance ($ USDT)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">
                    $
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    autoFocus
                    placeholder="0.00"
                    value={usdtInput}
                    onChange={(e) => setUsdtInput(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-xl font-bold font-mono text-gray-900 dark:text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                This updates your swing trading reserve without mixing into daily rupee expenses.
              </p>

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-all mt-2"
              >
                Save USDT Balance
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rent Modal */}
      {showRentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#0d111a] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-5 space-y-4 animate-modal-in">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Set Monthly House Rent
              </h3>
              <button
                onClick={() => setShowRentModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRent} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Monthly Rent Amount (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  placeholder="e.g. 12000"
                  value={rentInput}
                  onChange={(e) => setRentInput(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-lg font-bold font-mono text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-md transition-all mt-2"
              >
                Save Rent Amount
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
