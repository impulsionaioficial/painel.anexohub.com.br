'use client';

import { ScrollText, CheckCircle2, XCircle, Info, ShieldCheck } from 'lucide-react';

export default function LogsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
          <ScrollText className="w-7 h-7 text-emerald-400" /> Logs & Relatórios de Disparo
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Acompanhe os logs detalhados de requisições enviadas para a Evolution API.
        </p>
      </div>

      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-200">Histórico Recente</h2>
          <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Mapeamento LID Ativo
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-slate-200">Disparos no modo web funcionando</p>
              <p className="text-slate-400">Os logs da sessão são mantidos em memória durante a execução do disparo. As mensagens enviadas são validadas e enviadas via servidor VPS.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
            <Info className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-slate-200">Tratamento de identificadores WhatsApp LID</p>
              <p className="text-slate-400">A API faz a sanitização de números para DDI + DDD e consulta perfis automaticamente caso a Evolution API retorne um remetente codificado como LID.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
