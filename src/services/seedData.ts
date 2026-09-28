import { AppSettings, Product, Customer, Supplier, Expense, Invoice, PurchaseInvoice, CustomerPayment, SupplierTransaction } from '../types';

export const initialSettings: AppSettings = {
  exchangeRate: 15000, // 1 USD = 15,000 SYP
  baseCurrency: 'SYP',
  centerName: 'مركز العطايا لتوزيع المواد الغذائية',
  centerPhone: '',
  centerAddress: '',
  receiptFooter: 'شكراً لتعاملكم مع مركز العطايا - البضاعة المباعة لا ترد بعد 3 أيام',
  themeMode: 'light',
};

export const initialProducts: Product[] = [];

export const initialCustomers: Customer[] = [];

export const initialSuppliers: Supplier[] = [];

export const initialExpenses: Expense[] = [];

export const initialInvoices: Invoice[] = [];

export const initialCustomerPayments: CustomerPayment[] = [];

export const initialSupplierTransactions: SupplierTransaction[] = [];

export const initialPurchaseInvoices: PurchaseInvoice[] = [];

