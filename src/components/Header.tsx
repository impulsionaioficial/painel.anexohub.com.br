'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Wifi, WifiOff, RefreshCw, Server } from 'lucide-react';
import { getStoredConfig } from '@/lib/evolution-store';

export default function Header() {
  const [status, setStatus] = useState<'open' | 'connecting' | 'close' | 'loading'>('loading');
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [instanceName, setInstanceName] = useState<string>('');

  const checkConnection = async () => {
    setStatus('loading');
    const config = getStoredConfig();
    setInstanceName(config.instanceName);

    try {
      const res = await fetch('/api/evolution/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.isDemo) setIsDemo(true);
      if (data.success && data.instance?.state) {
        setStatus(data.instance.state);
      } else {
        setStatus('close');
      }
    } catch {
      setStatus('close');
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <header className="h-16 bg-slate-900/60 border-b border-slate-800/80 px-6 flex items-center justify-between backdrop-blur-md sticky top-0 z-40 select-none">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-slate-300">
          Instância: <span className="font-semibold text-slate-100">{instanceName || 'allwhatspy'}</span>
        </h2>
        {isDemo && (
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
            Modo Demonstrativo
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/80 border border-slate-800 text-xs">
          {status === 'loading' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />
              <span className="text-slate-400">Verificando...</span>
            </>
          ) : status === 'open' ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Conectado ao WhatsApp</span>
            </>
          ) : (
            <>
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-rose-400 font-medium">Desconectado</span>
            </>
          )}
        </div>

        <button
          onClick={checkConnection}
          className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800/40 hover:bg-slate-800 rounded-lg transition-colors"
          title="Atualizar status"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <Link
          href="/configuracoes"
          className="flex items-center gap-1.5 text-xs text-slate-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors font-medium"
        >
          <Server className="w-3.5 h-3.5 text-emerald-400" /> VPS Config
        </Link>
      </div>
    </header>
  );
}
