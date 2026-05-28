import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api, { formatApiErrorDetail } from '@/lib/api';
import { ArrowLeft, ShieldCheck, KeyRound } from 'lucide-react';

export default function ForgotPassword() {
  const navigate = useNavigate();

  // Step 1: enter email -> server returns question
  // Step 2: answer question + new password -> server resets
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchQuestion = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setQuestion(data.question);
      setStep(2);
    } catch (err) {
      const msg = formatApiErrorDetail(err.response?.data?.detail) || err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        security_answer: answer,
        new_password: newPassword,
      });
      toast.success('Contraseña restablecida. Iniciá sesión con la nueva.');
      navigate('/login', { replace: true });
    } catch (err) {
      const msg = formatApiErrorDetail(err.response?.data?.detail) || err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Recuperar contraseña"
      subtitle={
        step === 1
          ? 'Ingresá tu email y vamos a mostrarte tu pregunta de seguridad.'
          : 'Respondé tu pregunta de seguridad para definir una nueva contraseña.'
      }
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-[#0F62FE]"
          data-testid="back-to-login"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a iniciar sesión
        </Link>
      }
    >
      {step === 1 ? (
        <form onSubmit={fetchQuestion} className="space-y-4" data-testid="forgot-email-form">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
              Email
            </Label>
            <Input
              data-testid="forgot-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-md border-slate-300 focus:ring-2 focus:ring-[#0F62FE]/20 focus:border-[#0F62FE]"
              placeholder="tu@email.com"
            />
          </div>
          {error && (
            <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-md p-3" data-testid="forgot-error">
              {error}
            </div>
          )}
          <Button
            type="submit"
            disabled={loading}
            data-testid="forgot-fetch-question-button"
            className="w-full bg-gradient-to-r from-[#0F62FE] to-[#0043CE] text-white h-11 rounded-md font-medium"
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            {loading ? 'Buscando...' : 'Continuar'}
          </Button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="space-y-4" data-testid="forgot-reset-form">
          <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
            <p className="text-xs text-slate-600 font-medium mb-1">Tu pregunta de seguridad:</p>
            <p className="text-sm font-semibold text-slate-900" data-testid="forgot-question-text">
              {question}
            </p>
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
              Respuesta
            </Label>
            <Input
              data-testid="forgot-answer-input"
              required
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="h-10 rounded-md border-slate-300"
              placeholder="Escribí tu respuesta"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
              Nueva contraseña
            </Label>
            <Input
              data-testid="forgot-newpass-input"
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 rounded-md border-slate-300"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
              Confirmar contraseña
            </Label>
            <Input
              data-testid="forgot-confirm-input"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-10 rounded-md border-slate-300"
            />
          </div>
          {error && (
            <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-md p-3" data-testid="forgot-error">
              {error}
            </div>
          )}
          <Button
            type="submit"
            disabled={loading}
            data-testid="forgot-reset-button"
            className="w-full bg-gradient-to-r from-[#0F62FE] to-[#0043CE] text-white h-11 rounded-md font-medium"
          >
            <KeyRound className="h-4 w-4 mr-2" />
            {loading ? 'Restableciendo...' : 'Restablecer contraseña'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
