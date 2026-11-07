import { useState } from 'react';
import { db } from '../db/db';
import { syncService } from '../services/syncService';
import { X, Check, Landmark, Wallet, CreditCard, Star } from 'lucide-react';

export default function AdjustBalancesModal({ isOpen, onClose, accounts = [] }) {
  const [draftBalances, setDraftBalances] = useState(() => {
    const map = {};
    accounts.forEach((acc) => {
      map[acc.id] = String(acc.balance ?? 0);
    });
    return map;
  });

  const [defaultAccId, setDefaultAccId] = useState(() => {
    const def = accounts.find((a) => a.isDefault);
    return def ? def.id : 'pnb';
  });

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleBalanceChange = (accId, val) => {
    setDraftBalances((prev) => ({
      ...prev,
      [accId]: val,
    }));
  };

  const calculateTotalLiquid = () => {
    return accounts
      .filter((acc) => acc.id !== 'cc')
      .reduce((sum, acc) => {
        const amt = parseFloat(draftBalances[acc.id]) || 0;
        return sum + amt;
      }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const updatedAccounts = accounts.map((acc) => ({
        ...acc,
        balance: parseFloat(draftBalances[acc.id]) || 0,
        isDefault: acc.id === defaultAccId,
      }));

      await db.vault.put({
        key: 'bank_accounts',
        value: updatedAccounts,
        updatedAt: now,
      });

      await syncService.enqueue('vault', 'bank_accounts', 'upsert', {
        key: 'bank_accounts',
        value: updatedAccounts,
        updatedAt: now,
      });

      onClose();
    } catch (err) {
      console.error('Failed to update accounts:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getAccountIcon = (id) => {
    if (id === 'cash') return <Wallet className="w-4 h-4 text-purple-400" />;
    if (id === 'cc') return <CreditCard className="w-4 h-4 text-pink-400" />;
    return <Landmark className="w-4 h-4 text-emerald-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#0d111a] rounded-3xl border border-gray-800 shadow-2xl p-5 space-y-4 animate-modal-in max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">
              Account Balances & Shuffle
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Adjust to match your real bank balances
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-2.5">
            {accounts.map((acc) => {
              const isDef = defaultAccId === acc.id;
              return (
                <div
                  key={acc.id}
                  className="p-3 rounded-2xl bg-gray-850/60 border border-gray-800/80 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-gray-800 flex items-center justify-center shrink-0">
                      {getAccountIcon(acc.id)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white truncate">
                          {acc.name}
                        </span>
                        {isDef && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Default
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDefaultAccId(acc.id)}
                        className={`text-[10px] flex items-center gap-1 mt-0.5 transition-colors ${
                          isDef ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        <Star className={`w-3 h-3 ${isDef ? 'fill-amber-400' : ''}`} />
                        <span>{isDef ? 'Default UPI Bank' : 'Set as default'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Balance Input */}
                  <div className="relative w-28 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={draftBalances[acc.id] ?? ''}
                      onChange={(e) => handleBalanceChange(acc.id, e.target.value)}
                      className="w-full pl-6 pr-2.5 py-1.5 bg-[#080a0f] border border-gray-700/80 rounded-xl text-xs font-bold font-mono text-white text-right outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Liquid Summary Footer */}
          <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400">
              Total Available Liquid
            </span>
            <span className="text-base font-bold font-mono text-white">
              ₹{calculateTotalLiquid().toLocaleString('en-IN')}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Update & Save Balances</span>
          </button>
        </form>
      </div>
    </div>
  );
}
