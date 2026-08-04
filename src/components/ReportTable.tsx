'use client';

import { useState, useEffect } from 'react';
import { Download, RefreshCw, Search, Trash2, CheckCircle2, XCircle, Clock, Send, AlertCircle, FileText } from 'lucide-react';
import { DetailedReportItem } from '@/lib/types';
import { getStoredReports, clearStoredReports } from '@/lib/schedule-store';
import { getStoredConfig } from '@/lib/evolution-store';

export default function ReportTable() {
  const [reports, setReports] = useState<DetailedReportItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [resendingId, setResendingId] = useState<string | null>(null);

  const loadReports = () => {
    setReports(getStoredReports());
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleClear = () => {
    if (confirm('Deseja limpar todo o histórico de relatórios detalhados?')) {
      clearStoredReports();
      setReports([]);
    }
  };

  const handleResend = async (item: DetailedReportItem) => {
    setResendingId(item.id);
    const config = getStoredConfig();

    try {
      const res = await fetch('/api/evolution/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          phone: item.phone,
          message: item.messageSent,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(`Mensagem reenviada com sucesso para ${item.phone}!`);
        loadReports();
      } else {
        alert(`Erro ao reenviar: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Falha no reenvio: ${err.message}`);
    } finally {
      setResendingId(null);
    }
  };

  const exportCSV = () => {
    if (reports.length === 0) return;

    const headers = 'Data/Hora,Contato,Telefone,Mensagem,Status,Erro\n';
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      headers +
      filteredReports
        .map(
          (r) =>
            `"${r.sentAt}","${r.contactName || ''}","${r.phone}","${r.messageSent.replace(/"/g, '""')}","${r.status}","${r.errorMessage || ''}"`
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_disparos_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredReports = reports.filter((item) => {
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesQuery =
      item.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.phone.includes(searchQuery) ||
      item.messageSent.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const successCount = reports.filter((r) => r.status === 'success').length;
  const errorCount = reports.filter((r) => r.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Metrics Row (Coursue Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Total de Registros</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{reports.length}</p>
          </div>
          <FileText className="w-8 h-8 text-indigo-500/80" />
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Disparos de Sucesso</p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{successCount}</p>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-500/80" />
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Falhas de Envio</p>
            <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">{errorCount}</p>
          </div>
          <XCircle className="w-8 h-8 text-rose-500/80" />
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm transition-colors">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar contato ou mensagem..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500 w-64 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs shadow-sm">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3.5 py-1.5 rounded-xl transition-all font-bold ${
                filterStatus === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Todos ({reports.length})
            </button>
            <button
              onClick={() => setFilterStatus('success')}
              className={`px-3.5 py-1.5 rounded-xl transition-all font-bold ${
                filterStatus === 'success' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Sucessos ({successCount})
            </button>
            <button
              onClick={() => setFilterStatus('error')}
              className={`px-3.5 py-1.5 rounded-xl transition-all font-bold ${
                filterStatus === 'error' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Falhas ({errorCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={reports.length === 0}
            className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Exportar CSV
          </button>
          {reports.length > 0 && (
            <button
              onClick={handleClear}
              className="px-3.5 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpar Histórico
            </button>
          )}
        </div>
      </div>

      {/* Detailed Reports Table */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 overflow-x-auto shadow-sm transition-colors">
        {filteredReports.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Clock className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-slate-700 dark:text-slate-300 text-sm font-bold">Nenhum registro encontrado no relatório.</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Os disparos efetuados na aba "Disparo em Massa" aparecerão listados aqui automaticamente.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3.5">Data / Hora</th>
                <th className="p-3.5">Contato / Telefone</th>
                <th className="p-3.5">Mensagem Enviada</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-sans">
              {filteredReports.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">{item.sentAt}</td>
                  <td className="p-3.5 whitespace-nowrap">
                    <p className="font-bold text-slate-900 dark:text-slate-200">{item.contactName || 'Contato'}</p>
                    <p className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{item.phone}</p>
                  </td>
                  <td className="p-3.5 max-w-xs truncate text-slate-800 dark:text-slate-300" title={item.messageSent}>
                    {item.messageSent}
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    {item.status === 'success' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" /> Enviado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30" title={item.errorMessage}>
                        <XCircle className="w-3 h-3" /> Falha ({item.errorMessage || 'Erro'})
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleResend(item)}
                      disabled={resendingId === item.id}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold transition-colors inline-flex items-center gap-1 shadow-sm"
                    >
                      {resendingId === item.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Reenviar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
