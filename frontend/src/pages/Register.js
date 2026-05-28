import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatApiErrorDetail } from '@/lib/api';
import { Shield } from 'lucide-react';

const SECURITY_QUESTIONS = [
  '¿Cuál es el nombre de tu primera mascota?',
  '¿Cuál es tu ciudad de nacimiento?',
  '¿Cuál es el nombre de soltera de tu madre?',
  '¿Cuál fue tu primera escuela?',
  '¿Cuál es tu comida favorita?',
  '__custom__',
];

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [questionChoice, setQuestionChoice] = useState(SECURITY_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    const question = questionChoice === '__custom__' ? customQuestion.trim() : questionChoice;
    if (!question) {
      setError('Tenés que definir una pregunta de seguridad.');
      return;
    }
    if (!answer.trim()) {
      setError('Tenés que escribir la respuesta a la pregunta de seguridad.');
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        security_question: { question, answer: answer.trim() },
      });
      toast.success('¡Cuenta creada!');
      navigate('/', { replace: true });
    } catch (err) {
      const msg = formatApiErrorDetail(err.response?.data?.detail) || err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Cada usuario gestiona sus propias OTs, totalmente aislado."
      footer={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-[#0F62FE] font-semibold hover:underline" data-testid="link-to-login">
            Iniciá sesión
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" data-testid="register-form">
        <div>
          <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
            Nombre
          </Label>
          <Input
            data-testid="register-name-input"
            id="name"
            required
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            className="h-10 rounded-md border-slate-300 focus:ring-2 focus:ring-[#0F62FE]/20 focus:border-[#0F62FE]"
            placeholder="Tu nombre"
          />
        </div>

        <div>
          <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
            Email
          </Label>
          <Input
            data-testid="register-email-input"
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            className="h-10 rounded-md border-slate-300 focus:ring-2 focus:ring-[#0F62FE]/20 focus:border-[#0F62FE]"
            placeholder="tu@email.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
              Contraseña
            </Label>
            <Input
              data-testid="register-password-input"
              id="password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setField('password', e.target.value)}
              className="h-10 rounded-md border-slate-300 focus:ring-2 focus:ring-[#0F62FE]/20 focus:border-[#0F62FE]"
            />
          </div>
          <div>
            <Label htmlFor="confirm" className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">
              Confirmar
            </Label>
            <Input
              data-testid="register-confirm-input"
              id="confirm"
              type="password"
              required
              value={form.confirm}
              onChange={(e) => setField('confirm', e.target.value)}
              className="h-10 rounded-md border-slate-300 focus:ring-2 focus:ring-[#0F62FE]/20 focus:border-[#0F62FE]"
            />
          </div>
        </div>

        <div className="rounded-md bg-blue-50/60 border border-blue-100 p-3 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
            <Shield className="h-3.5 w-3.5" />
            Pregunta de seguridad
            <span className="text-blue-700 font-normal text-[11px]">(para recuperar tu contraseña)</span>
          </div>

          <div>
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1 block">
              Pregunta
            </Label>
            <Select value={questionChoice} onValueChange={setQuestionChoice}>
              <SelectTrigger className="h-10 rounded-md border-slate-300 bg-white" data-testid="security-question-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECURITY_QUESTIONS.slice(0, -1).map((q) => (
                  <SelectItem key={q} value={q}>{q}</SelectItem>
                ))}
                <SelectItem value="__custom__">Otra (escribir mi propia pregunta)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {questionChoice === '__custom__' && (
            <Input
              data-testid="custom-question-input"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder="Escribí tu pregunta personalizada"
              className="h-10 rounded-md border-slate-300 bg-white"
            />
          )}

          <div>
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1 block">
              Respuesta
            </Label>
            <Input
              data-testid="security-answer-input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Respuesta (no distingue mayúsculas)"
              className="h-10 rounded-md border-slate-300 bg-white"
            />
          </div>
        </div>

        {error && (
          <div
            className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-md p-3"
            data-testid="register-error"
          >
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          data-testid="register-submit-button"
          className="w-full bg-gradient-to-r from-[#0F62FE] to-[#0043CE] hover:from-[#0043CE] hover:to-[#002D9C] text-white h-11 rounded-md font-medium shadow-md shadow-blue-500/20"
        >
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </Button>
      </form>
    </AuthLayout>
  );
}
