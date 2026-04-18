
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/login/Login'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/dashboard/Dashboard'
import Users from './pages/users/Users'
import Vendors from './pages/vendors/Vendors'
import Access from './pages/access/Access'
import Company from './pages/company/Company'
import ChartsOfAccounts from './pages/charts/Charts'
import Proforma from './pages/proforma/Proforma'
import ProductService from './pages/products/Products'
import Receipts from './pages/receipts/Receipts'
import Disbursements from './pages/disbursements/Disbursements'
import Sales from './pages/sales/Sales'
import Collections from './pages/collections/Collections'
import Purchase from './pages/purchase/Purchase'
import Payments from './pages/payments/Payments'
import Customer from './pages/customers/Customer'
import Vat from './pages/vat/Vat'
import WithholdingTax from './pages/withholding_tax/WithholdingTax'
import Adjustments from './pages/adjustments/Adjustments'
import TrialBalance from './pages/reports/TrialBalance'
import IncomeStatement from './pages/reports/IncomeStatement'
import GeneralLedger from './pages/reports/GeneralLedger'
import BalanceSheet from './pages/reports/BalanceSheet'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route path="dashboard" element={
            <ProtectedRoute routeName="dashboard">
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="company" element={
            <ProtectedRoute routeName="company">
              <Company />
            </ProtectedRoute>
          } />
          <Route path="charts" element={
            <ProtectedRoute routeName="charts">
              <ChartsOfAccounts />
            </ProtectedRoute>
          } />
          <Route path="vendors" element={
            <ProtectedRoute routeName="vendors">
              <Vendors />
            </ProtectedRoute>
          } />
          <Route path="proforma_entries" element={
            <ProtectedRoute routeName="proforma_entries">
              <Proforma />
            </ProtectedRoute>
          } />
          <Route path="product_service" element={
            <ProtectedRoute routeName="product_service">
              <ProductService />
            </ProtectedRoute>
          } />
          <Route path="receipts" element={
            <ProtectedRoute routeName="receipts">
              <Receipts />
            </ProtectedRoute>
          } />
          <Route path="disbursement" element={
            <ProtectedRoute routeName="disbursement">
              <Disbursements />
            </ProtectedRoute>
          } />
          <Route path="sales" element={
            <ProtectedRoute routeName="sales">
              <Sales />
            </ProtectedRoute>
          } />
          <Route path="collections" element={
            <ProtectedRoute routeName="collections">
              <Collections />
            </ProtectedRoute>
          } />
          <Route path="purchase" element={
            <ProtectedRoute routeName="purchase">
              <Purchase />
            </ProtectedRoute>
          } />
          <Route path="payments" element={
            <ProtectedRoute routeName="payments">
              <Payments />
            </ProtectedRoute>
          } />
          <Route path="customers" element={
            <ProtectedRoute routeName="customers">
              <Customer />
            </ProtectedRoute>
          } />
          <Route path="access" element={
            <ProtectedRoute routeName="access">
              <Access />
            </ProtectedRoute>
          } />
          <Route path="users" element={
            <ProtectedRoute routeName="users">
              <Users />
            </ProtectedRoute>
          } />
          <Route path="vat" element={
            <ProtectedRoute routeName="vat">
              <Vat />
            </ProtectedRoute>
          } />
          <Route path="witholding_tax" element={
            <ProtectedRoute routeName="witholding_tax">
              <WithholdingTax />
            </ProtectedRoute>
          } />
          <Route path="adjustments" element={
            <ProtectedRoute routeName="adjustments">
              <Adjustments />
            </ProtectedRoute>
          } />
          <Route path="trial-balance" element={
            <ProtectedRoute routeName="trial_balance">
              <TrialBalance />
            </ProtectedRoute>
          } />
          <Route path="income-statement" element={
            <ProtectedRoute routeName="income_statement">
              <IncomeStatement />
            </ProtectedRoute>
          } />
          <Route path="general-ledger" element={
            <ProtectedRoute routeName="general_ledger">
              <GeneralLedger />
            </ProtectedRoute>
          } />
          <Route path="balance-sheet" element={
            <ProtectedRoute routeName="balance_sheet">
              <BalanceSheet />
            </ProtectedRoute>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App
