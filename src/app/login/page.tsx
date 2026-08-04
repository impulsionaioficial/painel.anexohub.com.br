'use client';

import { useState } from 'react';
import { Sparkles, Key, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { getStoredUsers, setActiveUser } from '@/lib/auth-store';

export default function LoginPage() {
  const [email, setEmail] = useState<string>('admin@allwhatspy.com');
  const [password, setPassword] = useState<string>('admin123');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const users = getStoredUsers();
      const userMatch = users.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase()
      );

      if (!userMatch) {
        setErrorMsg('E-mail ou senha incorretos.');
        setLoading(false);
        return;
      }

      // Successful Auth
      setActiveUser(userMatch);
      window.location.href = '/disparador';
    } catch {
      setErrorMsg('Erro ao autenticar. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-indigo-500/30 selection:text-indigo-300">
      <div className="w-full max-w-md space-y-8">
        {/* Brand Logo & Title */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/25">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
              AllWhatsPy <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-mono">PRO</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-1">Automação Multi-Canal WhatsApp & E-mail</p>
          </div>
        </div>

        {/* Login Box */}
        <form onSubmit={handleLogin} className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" /> Acesso ao Painel
            </h2>
            <p className="text-xs text-slate-400 font-medium">Digite suas credenciais abaixo para continuar.</p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold text-center">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-medium shadow-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-400" /> Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-medium shadow-sm"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Autenticando...' : 'Entrar no Sistema'} <ArrowRight className="w-4 h-4" />
          </button>

          <div className="pt-2 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Ambiente Seguro com Controle de Acesso (RBAC)
          </div>
        </form>
      </div>
    </div>
  );
}
