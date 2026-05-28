import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ListChecks } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  const navState = useMemo(() => ({ from: location }), [location]);

  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        <div className="flex flex-col items-center gap-4" data-testid="auth-loading">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#0F62FE] to-[#0043CE] flex items-center justify-center shadow-lg shadow-blue-500/20 animate-pulse">
            <ListChecks className="h-6 w-6 text-white" strokeWidth={2.4} />
          </div>
          <p className="text-sm text-slate-500">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (user === false) {
    return <Navigate to="/login" state={navState} replace />;
  }

  return children;
}
