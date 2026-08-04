'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Mail, Download, Send, Sparkles, RefreshCw, Globe, ArrowRight, AlertCircle } from 'lucide-react';
import { ScrapedLead } from '@/lib/types';
import { saveStoredScrapedLeads } from '@/lib/email-store';

export default function ExtratorEmailPage() {
  const router = useRouter();
  const [keywords, setKeywords] = useState<string>('Advogados São Paulo');
  const [platform, setPlatform] = useState<string>('linkedin');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [leads, setLeads] = useState<ScrapedLead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState<boolean>(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keywords.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch('/api/email/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, platform, domainFilter }),
      });

      const data = await res.json();
      if (data.success && data.leads) {
        setLeads(data.leads);
        setSelectedLeadIds(new Set(data.leads.map((l: ScrapedLead) => l.id)));
      } else {
        setLeads([]);
        setSelectedLeadIds(new Set());
      }
    } catch {
      alert('Erro na requisição do extrator de e-mails');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.size === leads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(leads.map((l) => l.id)));
    }
  };

  const toggleSelectLead = (id: string) => {
    const next = new Set(selectedLeadIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeadIds(next);
  };

  // Export to CSV file
  const exportToCSV = () => {
    const selectedLeads = leads.filter((l) => selectedLeadIds.has(l.id));
    if (selectedLeads.length === 0) {
      alert('Selecione pelo menos um lead para exportar.');
      return;
    }

    const headers = 'Nome,Email,Plataforma,Data\n';
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      headers +
      selectedLeads.map((l) => `"${l.name || ''}","${l.email}","${l.platform}","${l.dateFound}"`).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leads_extraidos_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Send selected leads to Mass Email Sender
  const sendToEmailCampaign = () => {
    const selectedLeads = leads.filter((l) => selectedLeadIds.has(l.id));
    if (selectedLeads.length === 0) {
      alert('Selecione pelo menos um lead.');
      return;
    }

    saveStoredScrapedLeads(selectedLeads);
    router.push('/disparador-email');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
          <Search className="w-7 h-7 text-emerald-400" /> Extrator de E-mails & Leads Reais
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Varredura e extração de e-mails públicos indexados na web por palavras-chave e redes sociais.
        </p>
      </div>

      {/* Search & Filter Form */}
      <form onSubmit={handleSearch} className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Keyword input */}
          <div className="md:col-span-6 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Search className="w-4 h-4 text-emerald-400" /> Palavras-chave / Nicho
            </label>
            <input
              type="text"
              placeholder="ex: Imobiliárias São Paulo, Médicos Rio de Janeiro..."
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
              required
            />
          </div>

          {/* Social Platform Filter */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-teal-400" /> Rede Social / Fonte
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
            >
              <option value="linkedin">LinkedIn</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="twitter">X (Twitter)</option>
              <option value="google">Busca Geral Web</option>
              <option value="all">Todas as fontes</option>
            </select>
          </div>

          {/* Domain Filter */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-amber-400" /> Provedor de E-mail
            </label>
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50"
            >
              <option value="all">Todos os provedores</option>
              <option value="@gmail.com">@gmail.com</option>
              <option value="@hotmail.com">@hotmail.com</option>
              <option value="@outlook.com">@outlook.com</option>
              <option value="@yahoo.com">@yahoo.com</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Extrair E-mails Reais Agora
          </button>
        </div>
      </form>

      {/* Results Section */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-200">
              Leads Extraídos ({leads.length})
            </h2>
            {leads.length > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold">
                {selectedLeadIds.size} selecionados
              </span>
            )}
          </div>

          {leads.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                {selectedLeadIds.size === leads.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
              <button
                onClick={exportToCSV}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-teal-400" /> Exportar CSV
              </button>
              <button
                onClick={sendToEmailCampaign}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/10 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Enviar para Disparador <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto">
          {leads.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700 text-slate-500 flex items-center justify-center mx-auto">
                {searched ? <AlertCircle className="w-6 h-6 text-amber-400" /> : <Mail className="w-6 h-6" />}
              </div>
              <p className="text-slate-300 text-sm font-semibold">
                {searched ? 'Nenhum e-mail público real encontrado na web para esta busca.' : 'Nenhum e-mail extraído ainda.'}
              </p>
              <p className="text-slate-500 text-xs max-w-md mx-auto">
                {searched
                  ? 'Dica: Tente buscar termos comerciais reais, como "Advogados São Paulo", "Corretor de Imóveis RJ" ou "Clínica Odontológica".'
                  : 'Digite um nicho ou palavra-chave acima e clique em "Extrair E-mails Reais Agora" para buscar leads.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3 w-10 text-center">Select</th>
                  <th className="p-3">Nome / Lead</th>
                  <th className="p-3">E-mail Extraído</th>
                  <th className="p-3">Fonte / Plataforma</th>
                  <th className="p-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.has(lead.id)}
                        onChange={() => toggleSelectLead(lead.id)}
                        className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 font-semibold text-slate-200">{lead.name || 'Contato Extraído'}</td>
                    <td className="p-3 font-mono text-emerald-400">{lead.email}</td>
                    <td className="p-3 capitalize">
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                        {lead.platform}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{lead.dateFound}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
