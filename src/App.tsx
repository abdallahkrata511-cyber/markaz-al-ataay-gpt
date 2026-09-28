import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { App as CapApp } from '@capacitor/app';
import {
  Product,
  Invoice,
  PurchaseInvoice,
  Customer,
  CustomerPayment,
  Supplier,
  SupplierTransaction,
  Expense,
  AppSettings,
  ActiveTab,
} from './types';
import { LocalDatabase } from './services/db';
import { BottomNavigation } from './components/layout/BottomNavigation';
import { DashboardView } from './components/dashboard/DashboardView';
import { CashBoxView } from './components/cashbox/CashBoxView';
import { ProductsView } from './components/products/ProductsView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { SalesView } from './components/sales/SalesView';
import { CustomersView } from './components/customers/CustomersView';
import { SuppliersView } from './components/suppliers/SuppliersView';
const ExpensesView = lazy(() => import('./components/expenses/ExpensesView').then((m) => ({ default: m.ExpensesView })));
const PartnersView = lazy(() => import('./components/partners/PartnersView').then((m) => ({ default: m.PartnersView })));
const UsdExchangeView = lazy(() => import('./components/cashbox/UsdExchangeView').then((m) => ({ default: m.UsdExchangeView })));
const AuditsView = lazy(() => import('./components/audits/AuditsView').then((m) => ({ default: m.AuditsView })));
const ProfitsView = lazy(() => import('./components/profits/ProfitsView').then((m) => ({ default: m.ProfitsView })));
import { SettingsModal } from './components/settings/SettingsModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export default function App() {
  // Navigation Stack for true Android Back Button behavior
  const [navStack, setNavStack] = useState<ActiveTab[]>(['dashboard']);
  const currentTab = navStack[navStack.length - 1] || 'dashboard';

  // Core Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierTransactions, setSupplierTransactions] = useState<
    SupplierTransaction[]
  >([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<AppSettings>(LocalDatabase.getSettings());

  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Quick Action triggers
  const [quickActionModal, setQuickActionModal] = useState<string | null>(null);

  // Push new tab to Navigation Stack
  const navigateToTab = useCallback((nextTab: ActiveTab) => {
    setQuickActionModal(null);
    setNavStack((prevStack) => {
      const current = prevStack[prevStack.length - 1];
      if (current === nextTab) return prevStack;
      // Push state into browser history for Android Back button
      window.history.pushState({ tab: nextTab }, '', `#${nextTab}`);
      return [...prevStack, nextTab];
    });
  }, []);

  // Pop from Navigation Stack (Android Back action)
  const navigateBack = useCallback(() => {
    setNavStack((prevStack) => {
      if (prevStack.length > 1) {
        return prevStack.slice(0, -1);
      }
      return prevStack;
    });
  }, []);

  // Listen to popstate (Android Physical/Virtual Back Button)
  useEffect(() => {
    // Initial state setup
    window.history.replaceState({ tab: 'dashboard' }, '', '#dashboard');

    const handlePopState = (event: PopStateEvent) => {
      // If a modal was open, it already popped itself via Modal component popstate listener
      if (event.state && event.state.modalOpen) {
        return;
      }
      setNavStack((prevStack) => {
        if (prevStack.length > 1) {
          return prevStack.slice(0, -1);
        }
        return prevStack;
      });
    };

    window.addEventListener('popstate', handlePopState);

    // Native Capacitor Android Hardware Back Button listener
    let capBackHandle: any = null;
    const registerCapacitorBack = async () => {
      try {
        capBackHandle = await CapApp.addListener('backButton', () => {
          if (isSettingsOpen) {
            setIsSettingsOpen(false);
            return;
          }
          if (quickActionModal) {
            setQuickActionModal(null);
            return;
          }
          setNavStack((prevStack) => {
            if (prevStack.length > 1) {
              return prevStack.slice(0, -1);
            }
            // On dashboard root: minimize app instead of killing
            CapApp.minimizeApp();
            return prevStack;
          });
        });
      } catch {
        // Not running inside native mobile container
      }
    };
    registerCapacitorBack();

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (capBackHandle && capBackHandle.remove) {
        capBackHandle.remove();
      }
    };
  }, [isSettingsOpen, quickActionModal]);

  // Reload all state from LocalDatabase
  const reloadData = useCallback(() => {
    setProducts(LocalDatabase.getProducts());
    setInvoices(LocalDatabase.getInvoices());
    setPurchaseInvoices(LocalDatabase.getPurchaseInvoices());
    setCustomers(LocalDatabase.getCustomers());
    setCustomerPayments(LocalDatabase.getCustomerPayments());
    setSuppliers(LocalDatabase.getSuppliers());
    setSupplierTransactions(LocalDatabase.getSupplierTransactions());
    setExpenses(LocalDatabase.getExpenses());
    setSettings(LocalDatabase.getSettings());
  }, []);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // Dark Mode side effect listener
  useEffect(() => {
    const isDark =
      settings.themeMode === 'dark' ||
      (settings.themeMode === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.themeMode]);

  // Product actions
  const handleAddProduct = (
    p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    LocalDatabase.addProduct(p);
    reloadData();
  };

  const handleUpdateProduct = (p: Product) => {
    LocalDatabase.updateProduct(p);
    reloadData();
  };

  const handleDeleteProduct = (productId: string) => {
    LocalDatabase.deleteProduct(productId);
    reloadData();
  };

  const handleUpdateStock = (productId: string, newTotalPieces: number) => {
    LocalDatabase.updateProductStock(productId, newTotalPieces);
    reloadData();
  };

  // Purchase Invoice actions
  const handleCreatePurchaseInvoice = (
    inv: Omit<PurchaseInvoice, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const created = LocalDatabase.createPurchaseInvoice(inv);
    reloadData();
    return created;
  };

  const handleUpdatePurchaseInvoice = (inv: PurchaseInvoice) => {
    LocalDatabase.updatePurchaseInvoice(inv);
    reloadData();
  };

  const handleDeletePurchaseInvoice = (id: string) => {
    LocalDatabase.deletePurchaseInvoice(id);
    reloadData();
  };

  // Invoice actions
  const handleCreateInvoice = (
    inv: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const created = LocalDatabase.createInvoice(inv);
    reloadData();
    return created;
  };

  const handleUpdateInvoice = (inv: Invoice) => {
    LocalDatabase.updateInvoice(inv);
    reloadData();
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    LocalDatabase.deleteInvoice(invoiceId);
    reloadData();
  };

  // Customer actions
  const handleAddCustomer = (c: Omit<Customer, 'id' | 'createdAt'>) => {
    LocalDatabase.addCustomer(c);
    reloadData();
  };

  const handleUpdateCustomer = (c: Customer) => {
    LocalDatabase.updateCustomer(c);
    reloadData();
  };

  const handleDeleteCustomer = (customerId: string) => {
    LocalDatabase.deleteCustomer(customerId);
    reloadData();
  };

  const handleAddCustomerPayment = (
    p: Omit<CustomerPayment, 'id' | 'createdAt'>
  ) => {
    LocalDatabase.addCustomerPayment(p);
    reloadData();
  };

  const handleDeleteCustomerPayment = (paymentId: string) => {
    LocalDatabase.deleteCustomerPayment(paymentId);
    reloadData();
  };

  const getCustomerBalance = (customerId: string) => {
    return LocalDatabase.getCustomerBalance(customerId);
  };

  // Supplier actions
  const handleAddSupplier = (s: Omit<Supplier, 'id' | 'createdAt'>) => {
    LocalDatabase.addSupplier(s);
    reloadData();
  };

  const handleUpdateSupplier = (s: Supplier) => {
    LocalDatabase.updateSupplier(s);
    reloadData();
  };

  const handleDeleteSupplier = (supplierId: string) => {
    LocalDatabase.deleteSupplier(supplierId);
    reloadData();
  };

  const handleAddSupplierTransaction = (
    tx: Omit<SupplierTransaction, 'id' | 'createdAt'>
  ) => {
    LocalDatabase.addSupplierTransaction(tx);
    reloadData();
  };

  const handleDeleteSupplierTransaction = (txId: string) => {
    LocalDatabase.deleteSupplierTransaction(txId);
    reloadData();
  };

  const getSupplierBalance = (supplierId: string) => {
    return LocalDatabase.getSupplierBalance(supplierId);
  };

  // Expense actions
  const handleAddExpense = (e: Omit<Expense, 'id' | 'createdAt'>) => {
    LocalDatabase.addExpense(e);
    reloadData();
  };

  const handleDeleteExpense = (expenseId: string) => {
    LocalDatabase.deleteExpense(expenseId);
    reloadData();
  };

  // Settings
  const handleSaveSettings = (newSettings: AppSettings) => {
    LocalDatabase.saveSettings(newSettings);
    setSettings(newSettings);
  };

  // Navigation from dashboard shortcuts
  const handleNavigate = (tab: ActiveTab, action?: string) => {
    navigateToTab(tab);
    if (action) {
      setQuickActionModal(action);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] dark:bg-[#0E1A22] text-slate-900 dark:text-slate-100 flex flex-col antialiased selection:bg-[#FFAA47]/30 selection:text-slate-900 font-display transition-colors duration-200">
      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-24">
        <ErrorBoundary resetKey={currentTab}>
        <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">جارٍ التحميل...</div>}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {currentTab === 'dashboard' && (
              <DashboardView
                products={products}
                invoices={invoices}
                customers={customers}
                suppliers={suppliers}
                expenses={expenses}
                settings={settings}
                onNavigate={handleNavigate}
                getCustomerBalance={getCustomerBalance}
                getSupplierBalance={getSupplierBalance}
              />
            )}

            {currentTab === 'audits' && (
              <AuditsView
                settings={settings}
                dataVersion={invoices.length + purchaseInvoices.length + customerPayments.length + supplierTransactions.length + expenses.length + customers.length + suppliers.length}
              />
            )}

            {currentTab === 'profits' && (
              <ProfitsView
                invoices={invoices}
                expenses={expenses}
                settings={settings}
              />
            )}

            {currentTab === 'cashbox' && (
              <CashBoxView
                settings={settings}
                onUpdateSettings={handleSaveSettings}
                onRefreshData={reloadData}
              />
            )}

            {currentTab === 'usd_exchange' && (
              <UsdExchangeView
                settings={settings}
                onUpdateSettings={handleSaveSettings}
                onRefreshData={reloadData}
              />
            )}

            {currentTab === 'partners' && (
              <PartnersView
                settings={settings}
                products={products}
                onUpdateSettings={handleSaveSettings}
                onRefreshData={reloadData}
              />
            )}

            {currentTab === 'products' && (
              <ProductsView
                products={products}
                settings={settings}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                onUpdateStock={handleUpdateStock}
                isAddModalOpenInitially={quickActionModal === 'add-product'}
                onCloseInitialModal={() => setQuickActionModal(null)}
              />
            )}

            {currentTab === 'purchases' && (
              <PurchasesView
                purchaseInvoices={purchaseInvoices}
                products={products}
                suppliers={suppliers}
                settings={settings}
                onCreatePurchaseInvoice={handleCreatePurchaseInvoice}
                onUpdatePurchaseInvoice={handleUpdatePurchaseInvoice}
                onDeletePurchaseInvoice={handleDeletePurchaseInvoice}
                getSupplierBalance={getSupplierBalance}
                isCreateModalOpenInitially={quickActionModal === 'new-purchase'}
                onCloseInitialModal={() => setQuickActionModal(null)}
              />
            )}

            {currentTab === 'sales' && (
              <SalesView
                invoices={invoices}
                products={products}
                customers={customers}
                settings={settings}
                onCreateInvoice={handleCreateInvoice}
                onUpdateInvoice={handleUpdateInvoice}
                onDeleteInvoice={handleDeleteInvoice}
                isCreateModalOpenInitially={quickActionModal === 'new-invoice'}
                onCloseInitialModal={() => setQuickActionModal(null)}
              />
            )}

            {currentTab === 'customers' && (
              <CustomersView
                customers={customers}
                invoices={invoices}
                payments={customerPayments}
                settings={settings}
                onAddCustomer={handleAddCustomer}
                onUpdateCustomer={handleUpdateCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                onAddPayment={handleAddCustomerPayment}
                onDeletePayment={handleDeleteCustomerPayment}
                getCustomerBalance={getCustomerBalance}
                isAddModalOpenInitially={quickActionModal === 'add-customer'}
                isPaymentModalOpenInitially={quickActionModal === 'customer-payment'}
                onCloseInitialModal={() => setQuickActionModal(null)}
              />
            )}

            {currentTab === 'suppliers' && (
              <SuppliersView
                suppliers={suppliers}
                transactions={supplierTransactions}
                purchaseInvoices={purchaseInvoices}
                settings={settings}
                onAddSupplier={handleAddSupplier}
                onUpdateSupplier={handleUpdateSupplier}
                onDeleteSupplier={handleDeleteSupplier}
                onAddTransaction={handleAddSupplierTransaction}
                onDeleteTransaction={handleDeleteSupplierTransaction}
                getSupplierBalance={getSupplierBalance}
              />
            )}

            {currentTab === 'expenses' && (
              <ExpensesView
                expenses={expenses}
                settings={settings}
                onAddExpense={handleAddExpense}
                onDeleteExpense={handleDeleteExpense}
                isAddModalOpenInitially={quickActionModal === 'add-expense'}
                onCloseInitialModal={() => setQuickActionModal(null)}
              />
            )}
          </motion.div>
        </AnimatePresence>
        </Suspense>
        </ErrorBoundary>
      </main>

      {/* Bottom Navigation for Phone / Mobile UX */}
      <BottomNavigation
        currentTab={currentTab}
        onSelectTab={navigateToTab}
        onOpenNewInvoice={() => {
          navigateToTab('sales');
          setQuickActionModal('new-invoice');
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Settings & Backup Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onDataReload={reloadData}
      />

    </div>
  );
}
