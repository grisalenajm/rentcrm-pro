import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import PropertyDetail from './pages/PropertyDetail';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Bookings from './pages/Bookings';
import BookingDetail from './pages/BookingDetail';
import Financials from './pages/Financials';
import Contracts from './pages/Contracts';
import ContractTemplates from './pages/ContractTemplates';
import SignContract from './pages/SignContract';
import CheckinPage from './pages/CheckinPage';
import ComingSoon from './pages/ComingSoon';
import Police from './pages/Police';
import OccupancyCalendar from './pages/OccupancyCalendar';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import PropertyFinancialDetail from './pages/PropertyFinancialDetail';
import { UserPreferencesProvider } from './context/UserPreferencesContext';

const qc = new QueryClient();

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <UserPreferencesProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/contracts/sign/:token" element={<SignContract />} />
            <Route path="/checkin/:token" element={<CheckinPage />} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="properties"                       element={<Properties />} />
              <Route path="properties/:id"               element={<PropertyDetail />} />
              <Route path="properties/:id/financials"     element={<PropertyFinancialDetail />} />
              <Route path="clients"             element={<Clients />} />
              <Route path="clients/:id"         element={<ClientDetail />} />
              <Route path="bookings"            element={<Bookings />} />
              <Route path="bookings/:id"        element={<BookingDetail />} />
              <Route path="financials"          element={<Financials />} />
              <Route path="contracts"           element={<Contracts />} />
              <Route path="contracts/templates" element={<ContractTemplates />} />
              <Route path="police"              element={<Police />} />
              <Route path="calendar"           element={<OccupancyCalendar />} />
              <Route path="users"               element={<UserManagement />} />
              <Route path="settings"             element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </UserPreferencesProvider>
    </QueryClientProvider>
  );
}
