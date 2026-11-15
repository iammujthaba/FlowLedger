export const INITIAL_FILTERS = {
  nature: 'all', // 'all' | 'earned' | 'borrowed' | 'personal_expense' | 'work_expense' | 'money_lent' | 'all_income' | 'all_expense'
  bank: 'all', // 'all' | account.id
  category: 'all', // 'all' | category.name
  dateScope: 'period', // 'period' | 'single' | 'range' | 'all_time'
  exactDate: '',
  startDate: '',
  endDate: '',
  minAmount: '',
  maxAmount: '',
  sortBy: 'date_desc', // 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'
};
