import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import Clients from './pages/Clients';
import Bookings from './pages/Bookings';
import BookingDetail from './pages/BookingDetail';
import Financials from './pages/Financials';
import Contracts from './pages/Contracts';
import ContractTemplates from './pages/ContractTemplates';
import SignContract from './pages/SignContract';
import ComingSoon from './pages/ComingSoon';

const qc = new QueryClient();

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/sign/:token" element={<SignContract />} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="properties"          element={<Properties />} />
              <Route path="clients"             element={<Clients />} />
              <Route path="bookings"            element={<Bookings />} />
              <Route path="bookings/:id"        element={<BookingDetail />} />
              <Route path="financials"          element={<Financials />} />
              <Route path="contracts"           element={<Contracts />} />
              <Route path="contracts/templates" element={<ContractTemplates />} />
              <Route path="police"              element={<ComingSoon title="Partes SES" />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
