import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatApiErrorDetail } from '@/lib/api';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success('¡Bienvenido!');
      navigate(from, { replace: true });
    } catch (err) {
      const msg = formatApiErrorDetail(err.response?.data?.detail) || err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Ingresá tus credenciales para acceder a tus OTs"
      footer={
        <>
          ¿No tenés cuenta?{' '}
          <Link to="/register" className="text-[#0F62FE] font-semibold hover:underline" data-testid="link-to-register">
            Registrate
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
        <div>
          <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
            Email
          </Label>
          <Input
            data-testid="login-email-input"
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 rounded-md border-slate-300 focus:ring-2 focus:ring-[#0F62FE]/20 focus:border-[#0F62FE]"
            placeholder="tu@email.com"
          />
        </div>

        <div>
          <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
            Contraseña
          </Label>
          <div className="relative">
            <Input
              data-testid="login-password-input"
              id="password"
              type={showPwd ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 pr-10 rounded-md border-slate-300 focus:ring-2 focus:ring-[#0F62FE]/20 focus:border-[#0F62FE]"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              data-testid="toggle-password-visibility"
              tabIndex={-1}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="text-right">
          <Link
            to="/forgot-password"
            className="text-xs text-[#0F62FE] hover:underline font-medium"
            data-testid="link-to-forgot"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        {error && (
          <div
            className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-md p-3"
            data-testid="login-error"
          >
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          data-testid="login-submit-button"
          className="w-full bg-gradient-to-r from-[#0F62FE] to-[#0043CE] hover:from-[#0043CE] hover:to-[#002D9C] text-white h-11 rounded-md font-medium shadow-md shadow-blue-500/20"
        >
          {loading ? 'Ingresando...' : 'Iniciar sesión'}
        </Button>
      </form>
    </AuthLayout>
  );
}
