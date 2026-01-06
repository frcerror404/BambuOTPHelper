import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App';
import LoginPage from './pages/LoginPage';
import ViewerPage from './pages/ViewerPage';
import { AuthProvider, useAuth } from './state/AuthContext';
import './styles.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children as JSX.Element;
}

function Router() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ViewerPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App>
          <Router />
        </App>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
);
