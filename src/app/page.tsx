'use client';

import Link from 'next/link';
import { Send, QrCode, ScrollText, CheckCircle2, ShieldCheck, Zap, ArrowRight, Play } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero Welcome Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" /> AllWhatsPy Web & Evolution API
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 sm:text-4xl">
            Automação de WhatsApp na Web
          </h1>
          <p className="text-slate-400 leading-relaxed text-sm sm:text-base">
            Envie mensagens em massa com suporte a variáveis personalizadas, delay anti-ban, variação de texto (spin-tax) e leitura de QR Code direta nesta tela.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href="/conexao"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20"
            >
              <QrCode className="w-4 h-4" /> Conectar WhatsApp <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/disparador"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-all"
            >
              <Send className="w-4 h-4 text-emerald-400" /> Abrir Disparador
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Status Conexão</span>
            <QrCode className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            Pronto para Conectar
          </p>
          <p className="text-xs text-slate-500">QR Code gerado 100% no site</p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Proteção Anti-Ban</span>
            <ShieldCheck className="w-5 h-5 text-teal-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">Delay + Spin-tax</p>
          <p className="text-xs text-slate-500">Humanização do envio ativada</p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Motor na VPS</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">Evolution API</p>
          <p className="text-xs text-slate-500">Baileys com suporte a LID</p>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <QrCode className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-200">1. Escanear QR Code no Próprio Site</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Não é necessário acessar o painel do Evolution API. O QR Code é gerado diretamente nesta aplicação web. Basta abrir a câmera do seu WhatsApp e apontar para o código.
          </p>
          <Link href="/conexao" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300">
            Ir para tela de conexão <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Send className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-200">2. Disparo em Massa Personalizado</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Importe listas CSV ou digite contatos manualmente. Utilize marcações como <code className="text-emerald-400 font-mono text-xs">{'{nome}'}</code> e variações de saudações <code className="text-emerald-400 font-mono text-xs">{'{Olá|Oi|Bom dia}'}</code>.
          </p>
          <Link href="/disparador" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-400 hover:text-teal-300">
            Iniciar um disparo <Play className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
