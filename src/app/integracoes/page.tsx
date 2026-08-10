'use client';

import { useState, useEffect } from 'react';
import { Key, Webhook as WebhookIcon, History, Code, Plus, Trash2, Copy, Check, RefreshCw, AlertCircle, Shield, Send, CheckCircle2, XCircle } from 'lucide-react';

interface ApiKeyItem {
  id: string;
  name: string;
  key: string;
  status: string;
  createdAt: string;
  lastUsedAt?: string;
}

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  status: string;
  createdAt: string;
}

interface WebhookLogItem {
  id: string;
  webhookId: string;
  webhookName: string;
  webhookUrl: string;
  event: string;
  payload: string;
  statusCode?: number;
  responseBody?: string;
  status: 'success' | 'failed';
  createdAt: string;
}

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks' | 'logs' | 'docs'>('keys');

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    'whatsapp.message.sent',
    'whatsapp.message.error',
  ]);

  // Logs state
  const [webhookLogs, setWebhookLogs] = useState<WebhookLogItem[]>([]);

  // UI state
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch API Keys
  const fetchApiKeys = async () => {
    try {
      const res = await fetch('/api/v1/api-keys');
      const data = await res.json();
      if (data.success) setApiKeys(data.keys || []);
    } catch {
      // fallback
    }
  };

  // Fetch Webhooks
  const fetchWebhooks = async () => {
    try {
      const res = await fetch('/api/v1/webhooks');
      const data = await res.json();
      if (data.success) setWebhooks(data.webhooks || []);
    } catch {
      // fallback
    }
  };

  // Fetch Logs
  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/v1/webhooks/logs');
      const data = await res.json();
      if (data.success) setWebhookLogs(data.logs || []);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchApiKeys();
    fetchWebhooks();
    fetchLogs();
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setLoading(true);
    setActionError(null);

    try {
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedKeySecret(data.key.key);
        setNewKeyName('');
        setActionSuccess('Chave de API criada com sucesso!');
        fetchApiKeys();
      } else {
        setActionError(data.error || 'Erro ao criar chave');
      }
    } catch (err: any) {
      setActionError(err.message || 'Erro ao comunicar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm('Deseja realmente revogar esta chave de API? Sistemas usando esta chave perderão acesso imediato.')) return;
    try {
      const res = await fetch('/api/v1/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess('Chave de API revogada!');
        fetchApiKeys();
      }
    } catch {}
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim() || !whUrl.trim()) return;
    setLoading(true);
    setActionError(null);

    try {
      const res = await fetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: whName,
          url: whUrl,
          events: selectedEvents,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setWhName('');
        setWhUrl('');
        setActionSuccess('Webhook cadastrado com sucesso!');
        fetchWebhooks();
      } else {
        setActionError(data.error || 'Erro ao cadastrar webhook');
      }
    } catch (err: any) {
      setActionError(err.message || 'Erro de rede');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Deseja excluir este Webhook?')) return;
    try {
      const res = await fetch('/api/v1/webhooks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess('Webhook removido!');
        fetchWebhooks();
      }
    } catch {}
  };

  const handleRetryLog = async (logId: string) => {
    try {
      const res = await fetch('/api/v1/webhooks/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess('Tentativa de reenvio executada!');
        fetchLogs();
      }
    } catch {}
  };

  const toggleEvent = (eventKey: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventKey) ? prev.filter((e) => e !== eventKey) : [...prev, eventKey]
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border border-indigo-900/50 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            <Shield className="w-3.5 h-3.5" /> REST API v1 & Webhooks de Saída
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Integração com CRM & Atendimento
          </h1>
          <p className="text-slate-300 leading-relaxed text-sm max-w-3xl">
            Conecte o AllWhatsPy PRO ao seu sistema externo de CRM, n8n, Make ou plataforma de vendas. Dispare lembretes de follow-up via API e receba relatórios de entrega de mensagens via Webhooks assinados com HMAC-SHA256 em tempo real.
          </p>
        </div>
      </div>

      {/* Alert Messages */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" /> {actionSuccess}
          </span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <XCircle className="w-5 h-5 shrink-0" /> {actionError}
          </span>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('keys')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'keys'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Key className="w-4 h-4" /> Chaves de API ({apiKeys.filter((k) => k.status === 'active').length})
        </button>

        <button
          onClick={() => setActiveTab('webhooks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'webhooks'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <WebhookIcon className="w-4 h-4" /> Webhooks de Saída ({webhooks.length})
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'logs'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History className="w-4 h-4" /> Logs de Webhooks ({webhookLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('docs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === 'docs'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Code className="w-4 h-4" /> Documentação & Playground
        </button>
      </div>

      {/* TAB 1: API KEYS */}
      {activeTab === 'keys' && (
        <div className="space-y-6">
          {/* Create API Key Form */}
          <form onSubmit={handleCreateApiKey} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" /> Gerar Nova Chave de API
            </h2>
            <p className="text-xs text-slate-400">
              Crie chaves de acesso privadas para seu CRM realizar chamadas autenticadas na rota <code className="text-indigo-400 font-mono">/api/v1/whatsapp/send</code>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Ex: Integrador CRM Principal / Servidor N8N"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={loading || !newKeyName.trim()}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" /> Gerar Chave
              </button>
            </div>
          </form>

          {/* Modal/Banner for Newly Created Key */}
          {createdKeySecret && (
            <div className="p-6 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Copie sua Chave de API Agora
                </span>
                <button onClick={() => setCreatedKeySecret(null)} className="text-slate-400 hover:text-white text-xs">Fechar</button>
              </div>
              <p className="text-xs text-slate-300">
                Guarde esta chave em local seguro. Ela não será exibida novamente por completo.
              </p>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-indigo-900 font-mono text-sm text-indigo-300">
                <span className="flex-1 truncate">{createdKeySecret}</span>
                <button
                  onClick={() => handleCopy(createdKeySecret, 'new_key')}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {copiedText === 'new_key' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedText === 'new_key' ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          )}

          {/* API Keys Table */}
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Chaves Ativas e Revogadas</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Nome da Chave</th>
                    <th className="p-3">Prefixo da Chave</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Criada Em</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {apiKeys.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">
                        Nenhuma chave de API gerada até o momento.
                      </td>
                    </tr>
                  ) : (
                    apiKeys.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-slate-100">{item.name}</td>
                        <td className="p-3 font-mono text-indigo-400">
                          {item.key.substring(0, 12)}...{item.key.substring(item.key.length - 4)}
                        </td>
                        <td className="p-3">
                          {item.status === 'active' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                              ATIVA
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-bold text-[10px]">
                              REVOGADA
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-400">{item.createdAt}</td>
                        <td className="p-3 text-right">
                          {item.status === 'active' && (
                            <button
                              onClick={() => handleRevokeApiKey(item.id)}
                              className="px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold text-xs transition-all flex items-center gap-1 ml-auto"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Revogar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WEBHOOKS */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          {/* Create Webhook Form */}
          <form onSubmit={handleCreateWebhook} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" /> Cadastrar Novo Webhook (URL de Callback do CRM)
            </h2>
            <p className="text-xs text-slate-400">
              Sempre que uma mensagem for entregue ou falhar, o AllWhatsPy PRO enviará uma requisição HTTP POST com os detalhes para a URL informada.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nome de Identificação</label>
                <input
                  type="text"
                  placeholder="Ex: Webhook de Produção CRM Leads"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">URL de Destino (Endpoint do CRM)</label>
                <input
                  type="url"
                  placeholder="https://seu-crm.com.br/api/webhooks/whatsapp"
                  value={whUrl}
                  onChange={(e) => setWhUrl(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Event checkboxes */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-slate-300">Eventos para Notificar:</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'whatsapp.message.sent', label: '✅ WhatsApp Entregue' },
                  { key: 'whatsapp.message.error', label: '❌ Erro de WhatsApp' },
                  { key: 'whatsapp.connection.update', label: '📡 Mudança de Conexão' },
                  { key: 'email.sent', label: '✉️ E-mail Entregue' },
                  { key: 'email.error', label: '⚠️ Erro de E-mail' },
                ].map((ev) => (
                  <button
                    type="button"
                    key={ev.key}
                    onClick={() => toggleEvent(ev.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      selectedEvents.includes(ev.key)
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ev.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !whName.trim() || !whUrl.trim()}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <WebhookIcon className="w-4 h-4" /> Salvar Webhook
              </button>
            </div>
          </form>

          {/* Registered Webhooks List */}
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Webhooks Cadastrados</h3>
            <div className="space-y-3">
              {webhooks.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">Nenhum webhook de saída cadastrado.</p>
              ) : (
                webhooks.map((wh) => (
                  <div key={wh.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">{wh.name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                          ATIVO
                        </span>
                      </div>
                      <p className="text-xs font-mono text-indigo-400">{wh.url}</p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {wh.events.map((e) => (
                          <span key={e} className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono">
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleCopy(wh.secret, wh.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:text-white flex items-center gap-1"
                      >
                        {copiedText === wh.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedText === wh.id ? 'Segredo Copiado!' : 'Copiar Segredo HMAC'}
                      </button>
                      <button
                        onClick={() => handleDeleteWebhook(wh.id)}
                        className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs transition-all"
                        title="Excluir Webhook"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LOGS */}
      {activeTab === 'logs' && (
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" /> Histórico de Disparos de Webhook
            </h3>
            <button
              onClick={fetchLogs}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar Logs
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Evento</th>
                  <th className="p-3">Webhook Destino</th>
                  <th className="p-3">HTTP Status</th>
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {webhookLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      Nenhum registro de disparo de webhook até o momento.
                    </td>
                  </tr>
                ) : (
                  webhookLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-mono font-bold text-indigo-400">{log.event}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-200">{log.webhookName}</div>
                        <div className="text-[10px] text-slate-500 font-mono max-w-xs truncate">{log.webhookUrl}</div>
                      </td>
                      <td className="p-3">
                        {log.status === 'success' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                            HTTP {log.statusCode || 200} OK
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-bold text-[10px]">
                            HTTP {log.statusCode || 500} ERRO
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400">{log.createdAt}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleRetryLog(log.id)}
                          className="px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-semibold text-xs transition-all flex items-center gap-1 ml-auto"
                        >
                          <RefreshCw className="w-3 h-3" /> Reenviar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DOCS & PLAYGROUND */}
      {activeTab === 'docs' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Code className="w-5 h-5 text-indigo-400" /> Guia de Integração para CRM (REST API v1)
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Utilize a especificação abaixo para conectar os botões do seu CRM ou fluxos automatizados (Make/n8n/Python/PHP) ao AllWhatsPy PRO.
            </p>

            {/* Example 1: Send WhatsApp Message */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 font-mono">POST /api/v1/whatsapp/send</span>
                <span className="text-[10px] text-slate-400">Header: x-api-key: awp_live_...</span>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 overflow-x-auto">
{`curl -X POST "http://localhost:3000/api/v1/whatsapp/send" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: SUA_CHAVE_API_AQUI" \\
  -d '{
    "phone": "5511999999999",
    "message": "Olá {nome}, seu lembrete de agendamento está confirmado!",
    "variables": { "nome": "João Silva" },
    "instanceName": "instancia_01"
  }'`}
              </pre>
            </div>

            {/* Example 2: Webhook Payload Received by CRM */}
            <div className="space-y-2 pt-4">
              <span className="text-xs font-bold text-indigo-400 font-mono">Payload JSON de Exemplo (Webhook Notificado ao Seu CRM):</span>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-200 overflow-x-auto">
{`{
  "event": "whatsapp.message.sent",
  "timestamp": "2026-08-06T17:45:00.000Z",
  "data": {
    "messageId": "AWP_API_1754500000_a1b2c",
    "phone": "5511999999999",
    "message": "Olá João Silva, seu lembrete de agendamento está confirmado!",
    "instanceName": "instancia_01",
    "sentAt": "06/08/2026 14:45:00"
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
