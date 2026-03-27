
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/login/Login'
import Layout from './components/layout/Layout'
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="company" element={<Company />} />
          <Route path="charts" element={<ChartsOfAccounts />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="proforma" element={<Proforma />} />
          <Route path="products" element={<ProductService />} />
          <Route path="receipts" element={<Receipts />} />
          <Route path="disbursements" element={<Disbursements />} />
          <Route path="sales" element={<Sales />} />
          <Route path="collections" element={<Collections />} />
          <Route path="purchase" element={<Purchase />} />
          <Route path="payments" element={<Payments />} />
          <Route path="customer" element={<Customer />} />
          <Route path="access" element={<Access />} />
          <Route path="users" element={<Users />} />
          
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App
