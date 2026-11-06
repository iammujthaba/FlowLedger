import Dexie from 'dexie';

export const db = new Dexie('FlowLedgerDB');

db.version(1).stores({
  transactions: 'id, date, sphere, type, category, amount, updatedAt, syncStatus',
  loans: 'id, personName, type, amount, remainingAmount, date, dueDate, status, updatedAt, syncStatus',
  vault: 'key, updatedAt',
  syncQueue: '++id, entity, entityId, action, createdAt',
  categories: 'id, sphere, type, name',
});

// Default categories
export const DEFAULT_CATEGORIES = [
  // Daily Life (Personal) Expense Categories
  { id: 'cat_food', sphere: 'personal', type: 'expense', name: 'Food & Dining', icon: 'UtensilsCrossed', color: '#f97316' },
  { id: 'cat_groceries', sphere: 'personal', type: 'expense', name: 'Groceries', icon: 'ShoppingBag', color: '#10b981' },
  { id: 'cat_fuel_p', sphere: 'personal', type: 'expense', name: 'Fuel & Personal Travel', icon: 'Fuel', color: '#eab308' },
  { id: 'cat_bills', sphere: 'personal', type: 'expense', name: 'Bills & Utilities', icon: 'Receipt', color: '#06b6d4' },
  { id: 'cat_health', sphere: 'personal', type: 'expense', name: 'Healthcare & Medical', icon: 'HeartPulse', color: '#ec4899' },
  { id: 'cat_shopping', sphere: 'personal', type: 'expense', name: 'Shopping & Personal', icon: 'Shirt', color: '#8b5cf6' },
  { id: 'cat_entertainment', sphere: 'personal', type: 'expense', name: 'Entertainment & Leisure', icon: 'Film', color: '#f43f5e' },
  { id: 'cat_rent_p', sphere: 'personal', type: 'expense', name: 'House Rent', icon: 'Home', color: '#6366f1' },
  { id: 'cat_emi_p', sphere: 'personal', type: 'expense', name: 'Bajaj Finance EMI', icon: 'CreditCard', color: '#f59e0b' },
  { id: 'cat_other_p', sphere: 'personal', type: 'expense', name: 'Other Personal', icon: 'MoreHorizontal', color: '#64748b' },

  // Work-Related Expense Categories
  { id: 'cat_fuel_w', sphere: 'work', type: 'expense', name: 'Work Travel & Fuel', icon: 'Car', color: '#3b82f6' },
  { id: 'cat_client_food', sphere: 'work', type: 'expense', name: 'Work Meals & Client', icon: 'Coffee', color: '#f97316' },
  { id: 'cat_tools', sphere: 'work', type: 'expense', name: 'Work Tools & Hardware', icon: 'Wrench', color: '#14b8a6' },
  { id: 'cat_software', sphere: 'work', type: 'expense', name: 'Software & Subscriptions', icon: 'Laptop', color: '#6366f1' },
  { id: 'cat_office', sphere: 'work', type: 'expense', name: 'Office Supplies', icon: 'Package', color: '#84cc16' },
  { id: 'cat_other_w', sphere: 'work', type: 'expense', name: 'Other Work Expense', icon: 'Briefcase', color: '#64748b' },

  // Income Categories
  { id: 'cat_salary', sphere: 'work', type: 'income', name: 'Salary / Client Payout', icon: 'Wallet', color: '#10b981' },
  { id: 'cat_freelance', sphere: 'work', type: 'income', name: 'Freelance / Business', icon: 'Briefcase', color: '#06b6d4' },
  { id: 'cat_investment', sphere: 'personal', type: 'income', name: 'Trading / Investment Profits', icon: 'TrendingUp', color: '#8b5cf6' },
  { id: 'cat_cashback', sphere: 'personal', type: 'income', name: 'Cashback & Rewards', icon: 'Gift', color: '#f59e0b' },
  { id: 'cat_other_inc', sphere: 'personal', type: 'income', name: 'Other Income', icon: 'PlusCircle', color: '#10b981' },
];

export async function initializeDatabase() {
  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }

  // Initialize vault with default values if not present
  const usdtVault = await db.vault.get('usdt_balance');
  if (!usdtVault) {
    await db.vault.put({ key: 'usdt_balance', value: 0, updatedAt: new Date().toISOString() });
  }

  const emiConfig = await db.vault.get('bajaj_emi');
  if (!emiConfig) {
    await db.vault.put({
      key: 'bajaj_emi',
      value: {
        monthlyAmount: 1750,
        dueDay: 5,
        totalMonths: 12,
        paidMonths: 0,
        startDate: '2026-11-01',
        lender: 'Bajaj Finance',
      },
      updatedAt: new Date().toISOString(),
    });
  }

  const rentConfig = await db.vault.get('rent_config');
  if (!rentConfig) {
    await db.vault.put({
      key: 'rent_config',
      value: {
        monthlyAmount: 0,
        dueDay: 1,
      },
      updatedAt: new Date().toISOString(),
    });
  }
}

