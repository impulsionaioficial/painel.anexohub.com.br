'use client';

import { useState, useEffect, useRef } from 'react';
import { ScrollText, RefreshCw, Clock, ShieldCheck, Pause, Play, Trash2, Search, Server } from 'lucide-react';
import { getStoredConfig } from '@/lib/evolution-store';
import { LogItem, getStoredLogsHistory, saveStoredLogsHistory } from '@/lib/log-store';

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [refreshInterval, setRefreshInterval] = useState<number>(300); // Default 5 minutes (300s)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isAutoPaused, setIsAutoPaused] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('Carregando...');
  const [searchFilter, setSearchFilter] = useState<string>('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load persistent history on mount
  useEffect(() => {
    const history = getStoredLogsHistory();
    setLogs(history);
    if (history.length > 0) {
      setLastUpdated(history[0].timestamp || new Date().toLocaleTimeString('pt-BR'));
    }
  }, []);

  const fetchLogs = async () => {
    setIsRefreshing(true);
    const config = getStoredConfig();

    try {
      const res = await fetch('/api/evolution/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (data.success && data.logs) {
        setLogs((prev) => {
          const combined = [...data.logs, ...prev];
          const uniqueMap = new Map();
          combined.forEach((item) => uniqueMap.set(item.id, item));
          const updated = Array.from(uniqueMap.values()).slice(0, 200) as LogItem[];

          // Persist in localStorage
          saveStoredLogsHistory(updated);

          return updated;
        });
        setLastUpdated(data.fetchedAt || new Date().toLocaleTimeString('pt-BR'));
      }
    } catch {
      // Ignore network hiccup
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (refreshInterval > 0 && !isAutoPaused) {
      timerRef.current = setInterval(() => {
        fetchLogs();
      }, refreshInterval * 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshInterval, isAutoPaused]);

  const clearConsole = () => {
    if (confirm('Deseja limpar todo o histórico de logs salvos?')) {
      setLogs([]);
      saveStoredLogsHistory([]);
    }
  };

  const filteredLogs = logs.filter(
    (l) =>
      l.message.toLowerCase().includes(searchFilter.toLowerCase()) ||
      l.category.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <ScrollText className="w-7 h-7 text-indigo-600 dark:text-indigo-400" /> Logs & Histórico de Disparos WhatsApp
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
            Monitoramento em tempo real com retenção persistente dos últimos 200 registros.
          </p>
        </div>

        {/* Auto Refresh Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs shadow-sm">
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-slate-700 dark:text-slate-300 font-bold">Atualizar a cada:</span>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 font-bold focus:outline-none shadow-sm"
            >
              <option value={0}>Desativado</option>
              <option value={30}>30 Segundos</option>
              <option value={60}>1 Minuto</option>
              <option value={300}>5 Minutos (Recomendado)</option>
              <option value={600}>10 Minutos</option>
            </select>
          </div>

          <button
            onClick={() => setIsAutoPaused(!isAutoPaused)}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold border transition-colors flex items-center gap-1.5 shadow-sm ${
              isAutoPaused
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {isAutoPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isAutoPaused ? 'Retomar Auto-Refresh' : 'Pausar Auto-Refresh'}
          </button>

          <button
            onClick={fetchLogs}
            disabled={isRefreshing}
            className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Atualizar Agora
          </button>
        </div>
      </div>

      {/* Info Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-1 shadow-sm transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Última Atualização</p>
          <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100 font-mono">{lastUpdated}</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-1 shadow-sm transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Registros Guardados</p>
          <p className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">{logs.length} / 200 Logs Salvos</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-1 shadow-sm transition-colors">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Armazenamento Persistente</p>
          <p className="text-lg font-extrabold text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5" /> Ativo (Navegador)
          </p>
        </div>
      </div>

      {/* Console Terminal Card */}
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Console de Histórico da Evolution API
            </h2>
            <span className="text-xs text-slate-400 font-mono">Salvo automaticamente</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                placeholder="Filtrar logs..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
              />
            </div>
            {logs.length > 0 && (
              <button
                onClick={clearConsole}
                className="px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" /> Limpar Histórico
              </button>
            )}
          </div>
        </div>

        {/* Realtime Terminal Container */}
        <div className="p-4 rounded-2xl bg-slate-950 font-mono text-xs h-96 overflow-y-auto space-y-2 border border-slate-900">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-16 text-slate-600 font-medium">
              Nenhum log registrado até o momento.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`p-2.5 rounded-xl border flex items-start justify-between gap-3 ${
                  log.type === 'success'
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                    : log.type === 'error'
                    ? 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                    : log.type === 'warning'
                    ? 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                    : 'bg-slate-900/40 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-slate-500 text-[11px] shrink-0 mt-0.5">[{log.timestamp}]</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300 shrink-0">
                    {log.category}
                  </span>
                  <span className="break-all">{log.message}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
