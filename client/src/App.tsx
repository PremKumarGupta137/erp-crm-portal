import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { useAuth } from './context/AuthContext';
import ChallanDetailPage from './pages/ChallanDetail';
import ChallanNewPage from './pages/ChallanNew';
import ChallansPage from './pages/Challans';
import CustomerDetailPage from './pages/CustomerDetail';
import CustomersPage from './pages/Customers';
import DashboardPage from './pages/Dashboard';
import LoginPage from './pages/Login';
import ProductDetailPage from './pages/ProductDetail';
import ProductsPage from './pages/Products';
import StockMovementsPage from './pages/StockMovements';
import UsersPage from './pages/Users';

/** Blocks the whole app shell until a session is confirmed. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Restoring session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can()) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/stock" element={<StockMovementsPage />} />
        <Route path="/challans" element={<ChallansPage />} />
        <Route path="/challans/new" element={<ChallanNewPage />} />
        <Route path="/challans/:id" element={<ChallanDetailPage />} />
        <Route
          path="/users"
          element={
            <RequireAdmin>
              <UsersPage />
            </RequireAdmin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
