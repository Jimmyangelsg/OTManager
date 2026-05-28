import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';

export function AuthLayout({ children, title, subtitle, footer }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#0F62FE] to-[#0043CE] flex items-center justify-center shadow-md shadow-blue-500/20">
            <ListChecks className="h-6 w-6 text-white" strokeWidth={2.4} />
          </div>
          <div>
            <Link
              to="/"
              className="text-xl font-black tracking-tight text-slate-900 hover:text-[#0F62FE] transition-colors"
              style={{ fontFamily: 'Chivo, sans-serif' }}
            >
              OTs · IBM Maximo
            </Link>
            <p className="text-xs text-slate-500 -mt-0.5">Gestión Personal</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-7">
          <h1
            className="text-2xl font-bold tracking-tight text-slate-900 mb-1.5"
            style={{ fontFamily: 'Chivo, sans-serif' }}
          >
            {title}
          </h1>
          {subtitle && <p className="text-sm text-slate-500 mb-6">{subtitle}</p>}
          {children}
        </div>

        {footer && <div className="mt-5 text-center text-sm text-slate-600">{footer}</div>}
      </div>
    </div>
  );
}
