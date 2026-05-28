import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, UserCircle2, KeyRound, Shield, ListChecks } from 'lucide-react';
import api, { formatApiErrorDetail } from '@/lib/api';

const SECURITY_QUESTIONS = [
  '¿Cuál es el nombre de tu primera mascota?',
  '¿Cuál es tu ciudad de nacimiento?',
  '¿Cuál es el nombre de soltera de tu madre?',
  '¿Cuál fue tu primera escuela?',
  '¿Cuál es tu comida favorita?',
  '__custom__',
];

function Section({ icon: Icon, title, subtitle, children, dataTestId }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6" data-testid={dataTestId}>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
          <Icon className="h-5 w-5 text-[#0F62FE]" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900" style={{ fontFamily: 'Chivo, sans-serif' }}>
            {title}
          </h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function Profile() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  // --- Profile (name) ---
  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  // --- Change password ---
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdError, setPwdError] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  // --- Change security question ---
  const [sqCurrentPwd, setSqCurrentPwd] = useState('');
  const [sqChoice, setSqChoice] = useState(SECURITY_QUESTIONS[0]);
  const [sqCustom, setSqCustom] = useState('');
  const [sqAnswer, setSqAnswer] = useState('');
  const [sqError, setSqError] = useState('');
  const [savingSq, setSavingSq] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    setSavingName(true);
    try {
      await api.put('/auth/profile', { name: name.trim() });
      await refresh();
      toast.success('Perfil actualizado');
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || 'Error');
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwdError('');
    if (pwd.next.length < 6) { setPwdError('Mínimo 6 caracteres.'); return; }
    if (pwd.next !== pwd.confirm) { setPwdError('Las contraseñas no coinciden.'); return; }
    setSavingPwd(true);
    try {
      await api.post('/auth/change-password', { current_password: pwd.current, new_password: pwd.next });
      toast.success('Contraseña cambiada');
      setPwd({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwdError(formatApiErrorDetail(err.response?.data?.detail) || 'Error');
    } finally {
      setSavingPwd(false);
    }
  };

  const saveSecurityQuestion = async (e) => {
    e.preventDefault();
    setSqError('');
    const question = sqChoice === '__custom__' ? sqCustom.trim() : sqChoice;
    if (!question) { setSqError('Tenés que elegir o escribir una pregunta.'); return; }
    if (!sqAnswer.trim()) { setSqError('Tenés que escribir la respuesta.'); return; }
    setSavingSq(true);
    try {
      await api.put('/auth/security-question', {
        current_password: sqCurrentPwd, question, answer: sqAnswer.trim(),
      });
      toast.success('Pregunta de seguridad actualizada');
      setSqCurrentPwd('');
      setSqAnswer('');
      await refresh();
    } catch (err) {
      setSqError(formatApiErrorDetail(err.response?.data?.detail) || 'Error');
    } finally {
      setSavingSq(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="px-6 py-4 max-w-3xl mx-auto w-full flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-[#0F62FE]" data-testid="back-to-dashboard">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Volver al panel</span>
          </Link>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
            title="Inicio"
          >
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#0F62FE] to-[#0043CE] flex items-center justify-center">
              <ListChecks className="h-5 w-5 text-white" strokeWidth={2.4} />
            </div>
          </button>
        </div>
      </header>

      <main className="px-6 py-8 max-w-3xl mx-auto w-full space-y-5">
        <div>
          <h1
            className="text-3xl font-black tracking-tight text-slate-900"
            style={{ fontFamily: 'Chivo, sans-serif' }}
            data-testid="profile-title"
          >
            Mi Perfil
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {user?.email} {user?.role === 'admin' && (
              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                ADMIN
              </span>
            )}
          </p>
        </div>

        {/* Name */}
        <Section icon={UserCircle2} title="Información personal" subtitle="Actualizá tu nombre visible" dataTestId="profile-section-info">
          <form onSubmit={saveName} className="space-y-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Nombre</Label>
              <Input
                data-testid="profile-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-10 rounded-md border-slate-300"
              />
            </div>
            <Button type="submit" disabled={savingName} data-testid="profile-save-name-button" className="bg-gradient-to-r from-[#0F62FE] to-[#0043CE] text-white h-10 rounded-md">
              {savingName ? 'Guardando...' : 'Guardar'}
            </Button>
          </form>
        </Section>

        {/* Password */}
        <Section icon={KeyRound} title="Cambiar contraseña" subtitle="Necesitás tu contraseña actual" dataTestId="profile-section-password">
          <form onSubmit={savePassword} className="space-y-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Contraseña actual</Label>
              <Input data-testid="profile-current-password-input" type="password" required value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} className="h-10 rounded-md border-slate-300" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Nueva</Label>
                <Input data-testid="profile-new-password-input" type="password" required minLength={6} value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} className="h-10 rounded-md border-slate-300" />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Confirmar</Label>
                <Input data-testid="profile-confirm-password-input" type="password" required value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} className="h-10 rounded-md border-slate-300" />
              </div>
            </div>
            {pwdError && <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-md p-2.5" data-testid="profile-password-error">{pwdError}</p>}
            <Button type="submit" disabled={savingPwd} data-testid="profile-save-password-button" className="bg-gradient-to-r from-[#0F62FE] to-[#0043CE] text-white h-10 rounded-md">
              {savingPwd ? 'Cambiando...' : 'Cambiar contraseña'}
            </Button>
          </form>
        </Section>

        {/* Security Question */}
        <Section icon={Shield} title="Pregunta de seguridad" subtitle="Usada para recuperar tu contraseña" dataTestId="profile-section-security">
          <form onSubmit={saveSecurityQuestion} className="space-y-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Contraseña actual</Label>
              <Input data-testid="profile-sq-current-password-input" type="password" required value={sqCurrentPwd} onChange={(e) => setSqCurrentPwd(e.target.value)} className="h-10 rounded-md border-slate-300" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Pregunta</Label>
              <Select value={sqChoice} onValueChange={setSqChoice}>
                <SelectTrigger className="h-10 rounded-md border-slate-300" data-testid="profile-sq-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECURITY_QUESTIONS.slice(0, -1).map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                  <SelectItem value="__custom__">Otra (escribir mi propia pregunta)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {sqChoice === '__custom__' && (
              <Input data-testid="profile-sq-custom-input" value={sqCustom} onChange={(e) => setSqCustom(e.target.value)} placeholder="Pregunta personalizada" className="h-10 rounded-md border-slate-300" />
            )}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 block">Respuesta</Label>
              <Input data-testid="profile-sq-answer-input" value={sqAnswer} onChange={(e) => setSqAnswer(e.target.value)} required className="h-10 rounded-md border-slate-300" />
            </div>
            {sqError && <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-md p-2.5" data-testid="profile-sq-error">{sqError}</p>}
            <Button type="submit" disabled={savingSq} data-testid="profile-save-sq-button" className="bg-gradient-to-r from-[#0F62FE] to-[#0043CE] text-white h-10 rounded-md">
              {savingSq ? 'Guardando...' : 'Actualizar pregunta'}
            </Button>
          </form>
        </Section>
      </main>
    </div>
  );
}
