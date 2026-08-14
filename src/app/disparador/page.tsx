'use client';

import { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { Send, Upload, Plus, Trash2, Play, Pause, Sparkles, Clock, FileText, Info, Calendar, BarChart3, Paperclip, X, Image as ImageIcon, FileCheck, Layers, StopCircle, RefreshCw, MessageSquare, ListOrdered } from 'lucide-react';
import { ContactItem, LogEntry, DetailedReportItem, QueueCampaignItem } from '@/lib/types';
import { getStoredConfig, parseSpintax, formatPhoneNumber } from '@/lib/evolution-store';
import { addStoredReportItem, addStoredReportItems } from '@/lib/schedule-store';
import ReportTable from '@/components/ReportTable';
import CampaignQueueManager from '@/components/CampaignQueueManager';
import ScheduleManager from '@/components/ScheduleManager';
import ChatViewer from '@/components/ChatViewer';
import { getActiveUser, hasPermission } from '@/lib/auth-store';

interface AttachmentFile {
  name: string;
  base64: string;
  mimetype: string;
  sizeKb: number;
}

interface InstanceOption {
  name: string;
  status: string;
}

export default function DisparadorPage() {
  const [activeTab, setActiveTab] = useState<'mass' | 'queue' | 'reports' | 'schedule' | 'chats'>('mass');
  const [reportFilterInstances, setReportFilterInstances] = useState<string[]>([]);

  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [manualPhone, setManualPhone] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');
  const [messageTemplate, setMessageTemplate] = useState<string>('Olá {nome}! Temos uma oferta especial para você hoje. Qualquer dúvida nos chame aqui!');
  const [attachment, setAttachment] = useState<AttachmentFile | null>(null);

  // Multi-Instance Rotation State
  const [availableInstances, setAvailableInstances] = useState<InstanceOption[]>([]);
  const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
  const [loadingInstances, setLoadingInstances] = useState<boolean>(false);

  const [enableSpintax, setEnableSpintax] = useState<boolean>(true);
  const [minDelay, setMinDelay] = useState<number>(10);
  const [maxDelay, setMaxDelay] = useState<number>(25);

  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<'running' | 'paused' | 'completed' | 'stopped' | 'idle'>('idle');
  const [sentCount, setSentCount] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleViewQueueCampaignReport = (camp: QueueCampaignItem) => {
    setReportFilterInstances(camp.selectedInstances);
    setActiveTab('reports');
  };

  // Fetch all instances from VPS for multi-instance selection
  const fetchInstancesFromVps = async () => {
    setLoadingInstances(true);
    const config = getStoredConfig();

    try {
      const res = await fetch('/api/evolution/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
        }),
      });

      const data = await res.json();
      if (data.success && data.instances) {
        setAvailableInstances(data.instances);
        if (selectedInstances.length === 0) {
          const activeName = config.instanceName || data.instances[0]?.name;
          if (activeName) setSelectedInstances([activeName]);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoadingInstances(false);
    }
  };

  useEffect(() => {
    fetchInstancesFromVps();

    // Check if there are contacts imported from Extractor
    if (typeof window !== 'undefined') {
      const imported = localStorage.getItem('awp_imported_contacts');
      if (imported) {
        try {
          const parsed = JSON.parse(imported);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setContacts(parsed);
          }
        } catch {}
        localStorage.removeItem('awp_imported_contacts');
      }
    }
  }, []);

  // Poll server for active background campaign progress & sync reports
  const checkServerCampaignStatus = async () => {
    try {
      const res = await fetch('/api/evolution/campaign/status');
      const data = await res.json();

      if (data.success && data.campaign) {
        const camp = data.campaign;
        setActiveCampaignId(camp.id);
        setCampaignStatus(camp.status);

        if (camp.contacts && camp.contacts.length > 0) {
          setContacts(camp.contacts);
          const done = camp.contacts.filter((c: any) => c.status === 'sent').length;
          setSentCount(done);
        }

        if (camp.logs) {
          setLogs(
            camp.logs.map((l: any, idx: number) => ({
              id: `serv_log_${idx}_${l.timestamp}`,
              timestamp: l.timestamp,
              phone: l.phone,
              status: l.status,
              message: l.message,
            }))
          );
        }

        if (camp.reports && Array.isArray(camp.reports) && camp.reports.length > 0) {
          addStoredReportItems(camp.reports);
        }
      }
    } catch {
      // Ignore network hiccup
    }
  };

  useEffect(() => {
    checkServerCampaignStatus();
    pollIntervalRef.current = setInterval(checkServerCampaignStatus, 2000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const toggleInstanceSelection = (name: string) => {
    if (selectedInstances.includes(name)) {
      if (selectedInstances.length === 1) {
        alert('Selecione pelo menos 1 instância para disparo.');
        return;
      }
      setSelectedInstances(selectedInstances.filter((i) => i !== name));
    } else {
      setSelectedInstances([...selectedInstances, name]);
    }
  };

  // File Attachment handler
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('O arquivo anexo é muito grande. O limite máximo é de 20MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        base64: reader.result as string,
        mimetype: file.type || 'application/octet-stream',
        sizeKb: Math.round(file.size / 1024),
      });
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setAttachment(null);
  };

  // CSV Import handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const imported: ContactItem[] = [];
        results.data.forEach((row: any, idx) => {
          const rawPhone = row.telefone || row.phone || row.celular || row.num || Object.values(row)[0];
          const rawName = row.nome || row.name || row.cliente || '';
          if (rawPhone) {
            imported.push({
              id: `csv_${idx}_${Date.now()}`,
              phone: formatPhoneNumber(String(rawPhone)),
              name: String(rawName).trim(),
              status: 'pending',
            });
          }
        });

        if (imported.length > 0) {
          setContacts((prev) => [...prev, ...imported]);
          alert(`${imported.length} contatos importados com sucesso!`);
        } else {
          alert('Nenhum número de telefone válido encontrado no arquivo CSV.');
        }
      },
      error: () => alert('Erro ao ler arquivo CSV'),
    });
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone) return;

    const formatted = formatPhoneNumber(manualPhone);
    const newContact: ContactItem = {
      id: `manual_${Date.now()}`,
      phone: formatted,
      name: manualName || 'Cliente',
      status: 'pending',
    };

    setContacts((prev) => [...prev, newContact]);
    setManualPhone('');
    setManualName('');
  };

  const removeContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const clearContacts = () => {
    if (confirm('Deseja limpar todos os contatos da lista?')) {
      setContacts([]);
    }
  };

  // Start Multi-Instance Server-Side Background Campaign
  const startCampaign = async () => {
    const currentUser = getActiveUser();
    if (!hasPermission(currentUser, 'can_start_campaign')) {
      alert('🔒 Sua conta não possui permissão para iniciar campanhas de disparo.');
      return;
    }

    if (contacts.length === 0) {
      alert('Adicione pelo menos um contato para iniciar.');
      return;
    }
    if (!messageTemplate.trim() && !attachment) {
      alert('Digite uma mensagem ou anexe um arquivo.');
      return;
    }
    if (selectedInstances.length === 0) {
      alert('Selecione pelo menos uma instância do WhatsApp para disparo.');
      return;
    }

    const config = getStoredConfig();

    try {
      const res = await fetch('/api/evolution/campaign/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts,
          messageTemplate,
          minDelay,
          maxDelay,
          enableSpintax,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          selectedInstances,
          attachment: attachment ? attachment : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActiveCampaignId(data.campaignId);
        setCampaignStatus('running');
        alert(`🟢 Campanha iniciada no Servidor com rotação entre ${selectedInstances.length} instâncias!\n\nVocê pode fechar esta aba ou o navegador a qualquer momento.`);
      } else {
        alert(`Erro ao iniciar no servidor: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Falha ao conectar com o servidor: ${err.message}`);
    }
  };

  const handleControlCampaign = async (action: 'pause' | 'resume' | 'stop') => {
    if (!activeCampaignId) return;

    try {
      await fetch('/api/evolution/campaign/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: activeCampaignId, action }),
      });
      checkServerCampaignStatus();
    } catch {
      alert('Erro ao alterar estado da campanha');
    }
  };

  const progressPercent = contacts.length > 0 ? Math.round((sentCount / contacts.length) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Horizontal Straight Tabs Bar (Coursue Style) */}
      <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex items-center gap-2 shadow-sm transition-colors overflow-x-auto scroll-smooth">
        <button
          onClick={() => setActiveTab('mass')}
          className={`shrink-0 md:flex-1 py-3 px-4 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'mass'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Send className="w-4 h-4" /> Disparo Instantâneo
        </button>

        <button
          onClick={() => setActiveTab('queue')}
          className={`shrink-0 md:flex-1 py-3 px-4 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'queue'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <ListOrdered className="w-4 h-4" /> Fila de Disparos
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`shrink-0 md:flex-1 py-3 px-4 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'reports'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Relatório Detalhado
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`shrink-0 md:flex-1 py-3 px-4 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'schedule'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Calendar className="w-4 h-4" /> Agendamento & Recorrência
        </button>

        <button
          onClick={() => setActiveTab('chats')}
          className={`shrink-0 md:flex-1 py-3 px-4 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'chats'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Conversas & Chats
        </button>
      </div>

      {/* Server Background Runner Info Banner */}
      {campaignStatus === 'running' && (
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-900 dark:text-indigo-300 text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600"></span>
            </span>
            <div>
              <p className="font-bold text-indigo-950 dark:text-indigo-200">Disparo Multi-Instância Ativo no Servidor ({selectedInstances.length} números revezando)</p>
              <p className="text-indigo-700 dark:text-indigo-300/80 font-medium">Você pode fechar esta aba ou desligar o computador. Os disparos continuarão na VPS!</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleControlCampaign('pause')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm"
            >
              <Pause className="w-3.5 h-3.5" /> Pausar
            </button>
            <button
              onClick={() => handleControlCampaign('stop')}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm"
            >
              <StopCircle className="w-3.5 h-3.5" /> Parar
            </button>
          </div>
        </div>
      )}

      {/* Tab Content Render */}
      {activeTab === 'queue' && (
        <CampaignQueueManager onViewReport={handleViewQueueCampaignReport} />
      )}

      {activeTab === 'reports' && (
        <ReportTable initialInstances={reportFilterInstances} />
      )}

      {activeTab === 'schedule' && <ScheduleManager />}

      {activeTab === 'chats' && <ChatViewer />}

      {activeTab === 'mass' && (
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
                <Send className="w-7 h-7 text-indigo-600 dark:text-indigo-400" /> Disparador de Campanhas em Massa
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
                Envie mensagens e arquivos para listas de contatos com rotação de instâncias e controle anti-ban.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {campaignStatus !== 'running' ? (
                <button
                  onClick={startCampaign}
                  disabled={contacts.length === 0}
                  className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-md shadow-indigo-500/25 disabled:opacity-50 flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" /> Iniciar Disparos ({selectedInstances.length} Instâncias)
                </button>
              ) : (
                <button
                  onClick={() => handleControlCampaign('pause')}
                  className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shadow-md shadow-amber-500/20 flex items-center gap-2"
                >
                  <Pause className="w-4 h-4" /> Pausar Disparos
                </button>
              )}
            </div>
          </div>

          {/* Multi-Instance Selection Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-3 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Seleção de Instâncias para Rotação (Anti-Ban)
              </h2>
              <button
                onClick={fetchInstancesFromVps}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold"
              >
                <RefreshCw className={`w-3 h-3 ${loadingInstances ? 'animate-spin' : ''}`} /> Atualizar Instâncias
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Marque as instâncias que deseja utilizar. O sistema revezará automaticamente cada disparo entre os números selecionados.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {availableInstances.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Carregando instâncias da VPS...</span>
              ) : (
                availableInstances.map((inst) => {
                  const isChecked = selectedInstances.includes(inst.name);
                  return (
                    <label
                      key={inst.name}
                      onClick={() => toggleInstanceSelection(inst.name)}
                      className={`cursor-pointer px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all flex items-center gap-2 ${
                        isChecked
                          ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500/40 text-indigo-900 dark:text-indigo-300 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded-md border-slate-300 text-indigo-600 focus:ring-0"
                      />
                      <span className="font-mono">{inst.name}</span>
                      <span className={`text-[10px] font-bold ${inst.status === 'open' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        ({inst.status === 'open' ? 'Conectado' : 'Desconectado'})
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {contacts.length > 0 && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-2 shadow-sm">
              <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 font-bold">
                <span>Progresso no Servidor ({sentCount} de {contacts.length} enviados)</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{progressPercent}%</span>
              </div>
              <div className="w-full h-3.5 rounded-full bg-slate-100 dark:bg-slate-950 overflow-hidden border border-slate-200 dark:border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Grid: Editor + Contacts List */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Message Editor & Attachment (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Message Template Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-sm transition-colors">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Editor de Mensagem & Legenda
                  </h2>
                  <span className="text-xs text-slate-400 font-mono">Use {'{nome}'} para personalização</span>
                </div>

                <textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={5}
                  placeholder="Digite a mensagem ou legenda do anexo aqui..."
                  className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500 resize-none font-sans shadow-sm"
                />

                {/* Attachment Section */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Anexo de Arquivo (Imagem, PDF, Documento, Vídeo)
                    </span>
                    <input
                      type="file"
                      id="attachment-input"
                      onChange={handleAttachmentChange}
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,video/*,audio/*"
                      className="hidden"
                    />
                    <label
                      htmlFor="attachment-input"
                      className="cursor-pointer px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Paperclip className="w-3.5 h-3.5" /> Anexar Arquivo
                    </label>
                  </div>

                  {attachment ? (
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30 text-xs shadow-sm">
                      <div className="flex items-center gap-2.5">
                        {attachment.mimetype.startsWith('image/') ? (
                          <ImageIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        ) : (
                          <FileCheck className="w-5 h-5 text-teal-500 shrink-0" />
                        )}
                        <div className="truncate max-w-xs">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{attachment.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{attachment.sizeKb} KB &bull; {attachment.mimetype}</p>
                        </div>
                      </div>
                      <button
                        onClick={removeAttachment}
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                        title="Remover anexo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Nenhum arquivo anexado (máximo 20MB).</p>
                  )}
                </div>

                {/* Anti-Ban & Spin-tax Controls */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableSpintax}
                        onChange={(e) => setEnableSpintax(e.target.checked)}
                        className="rounded-md border-slate-300 text-indigo-600 focus:ring-0"
                      />
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      Ativar Spin-tax (ex: {'{Olá|Oi|Tudo bem}'})
                    </label>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-500" /> Intervalo Anti-Ban (Delay aleatório)
                      </span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{minDelay}s - {maxDelay}s</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex-1 space-y-1">
                        <span className="text-slate-500 font-medium">Mínimo (seg):</span>
                        <input
                          type="number"
                          min={5}
                          max={60}
                          value={minDelay}
                          onChange={(e) => setMinDelay(Number(e.target.value))}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-center font-mono font-bold shadow-sm"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <span className="text-slate-500 font-medium">Máximo (seg):</span>
                        <input
                          type="number"
                          min={10}
                          max={120}
                          value={maxDelay}
                          onChange={(e) => setMaxDelay(Number(e.target.value))}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-center font-mono font-bold shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Import Contacts Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-sm transition-colors">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Adicionar Contatos
                </h2>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-800 hover:border-indigo-500 text-center transition-colors">
                  <input
                    type="file"
                    accept=".csv"
                    id="csv-upload"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer space-y-1 block">
                    <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Importar arquivo CSV / Excel</p>
                    <p className="text-[11px] text-slate-400">Formato com colunas: nome, telefone</p>
                  </label>
                </div>

                <form onSubmit={handleAddManual} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome (opcional)"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-1/3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                  <input
                    type="text"
                    placeholder="Telefone (ex: 5511999998888)"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="flex-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-mono shadow-sm"
                  />
                  <button
                    type="submit"
                    className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 text-xs font-extrabold transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Contacts List & Realtime Logs (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-sm transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    Lista de Envio ({contacts.length})
                  </h3>
                  {contacts.length > 0 && (
                    <button
                      onClick={clearContacts}
                      className="text-xs text-rose-500 hover:text-rose-600 font-bold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Limpar Lista
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {contacts.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs font-medium">
                      Nenhum contato adicionado ainda.
                    </div>
                  ) : (
                    contacts.map((c) => (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs shadow-sm"
                      >
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{c.name || 'Sem nome'}</p>
                          <p className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{c.phone}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              c.status === 'sent'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : c.status === 'error'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : c.status === 'sending'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {c.status === 'sent'
                              ? 'Enviado'
                              : c.status === 'error'
                              ? 'Erro'
                              : c.status === 'sending'
                              ? 'Enviando...'
                              : 'Pendente'}
                          </span>
                          <button
                            onClick={() => removeContact(c.id)}
                            className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Console Logs */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-3 shadow-sm transition-colors">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Console Multi-Instância (Servidor Node)
                </h3>
                <div className="p-3.5 rounded-2xl bg-slate-950 font-mono text-[11px] h-48 overflow-y-auto space-y-1.5 border border-slate-900">
                  {logs.length === 0 ? (
                    <p className="text-slate-600">Aguardando início da campanha no servidor...</p>
                  ) : (
                    logs.map((log) => (
                      <div
                        key={log.id}
                        className={`leading-tight ${
                          log.status === 'success'
                            ? 'text-emerald-400'
                            : log.status === 'error'
                            ? 'text-rose-400'
                            : 'text-amber-300/80'
                        }`}
                      >
                        <span className="text-slate-500">[{log.timestamp}]</span> {log.phone}: {log.message}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
