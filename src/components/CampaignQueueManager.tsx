'use client';

import { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import {
  ListOrdered,
  Plus,
  Play,
  Pause,
  StopCircle,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  FileText,
  Paperclip,
  Sparkles,
  Clock,
  Upload,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Image as ImageIcon,
  FileCheck,
  Zap,
  Repeat,
} from 'lucide-react';
import { ContactItem, QueueCampaignItem, QueueExecutionMode, QueueCampaignAttachment, DetailedReportItem } from '@/lib/types';
import {
  getStoredQueueCampaigns,
  saveStoredQueueCampaigns,
  addStoredQueueCampaign,
  updateStoredQueueCampaign,
  deleteStoredQueueCampaign,
  moveQueueCampaign,
} from '@/lib/queue-store';
import { getStoredConfig, parseSpintax, formatPhoneNumber } from '@/lib/evolution-store';
import { addStoredReportItem, addStoredReportItems } from '@/lib/schedule-store';

interface CampaignQueueManagerProps {
  onViewReport: (campaign: QueueCampaignItem) => void;
}

export default function CampaignQueueManager({ onViewReport }: CampaignQueueManagerProps) {
  const [queue, setQueue] = useState<QueueCampaignItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [availableInstances, setAvailableInstances] = useState<{ name: string; status: string }[]>([]);
  const [loadingInstances, setLoadingInstances] = useState<boolean>(false);

  // Form State
  const [title, setTitle] = useState<string>('');
  const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [manualPhone, setManualPhone] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');
  const [messageTemplate, setMessageTemplate] = useState<string>('Olá {nome}! Temos uma novidade imperdível para você.');
  const [attachment, setAttachment] = useState<QueueCampaignAttachment | null>(null);
  const [executionMode, setExecutionMode] = useState<QueueExecutionMode>('sequential');
  const [enableSpintax, setEnableSpintax] = useState<boolean>(true);
  const [minDelay, setMinDelay] = useState<number>(10);
  const [maxDelay, setMaxDelay] = useState<number>(25);

  // Active running runners map
  const activeRunnersRef = useRef<Set<string>>(new Set());
  const queueIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load instances and queue
  const fetchInstances = async () => {
    setLoadingInstances(true);
    const config = getStoredConfig();
    try {
      const res = await fetch('/api/evolution/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: config.baseUrl, apiKey: config.apiKey }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.instances)) {
        setAvailableInstances(data.instances);
        if (selectedInstances.length === 0 && data.instances[0]?.name) {
          setSelectedInstances([data.instances[0].name]);
        }
      }
    } catch {} finally {
      setLoadingInstances(false);
    }
  };

  const loadQueue = () => {
    setQueue(getStoredQueueCampaigns());
  };

  useEffect(() => {
    loadQueue();
    fetchInstances();
  }, []);

  // Queue Processing Worker (Runs sequentially or in parallel)
  const processQueue = async () => {
    const currentQueue = getStoredQueueCampaigns();
    if (currentQueue.length === 0) return;

    // Check if any sequential campaign is already running
    const hasRunningSequential = currentQueue.some(
      (c) => c.status === 'running' && c.executionMode === 'sequential'
    );

    // 1. Process Parallel Campaigns that are set to 'running'
    const parallelRunning = currentQueue.filter(
      (c) => c.status === 'running' && c.executionMode === 'parallel' && !activeRunnersRef.current.has(c.id)
    );
    parallelRunning.forEach((camp) => {
      runCampaignWorker(camp.id);
    });

    // 2. If no sequential campaign is running, start the first 'queued' sequential campaign
    if (!hasRunningSequential) {
      const nextSequential = currentQueue.find(
        (c) => c.status === 'queued' && c.executionMode === 'sequential'
      );
      if (nextSequential) {
        updateStoredQueueCampaign(nextSequential.id, {
          status: 'running',
          startedAt: nextSequential.startedAt || new Date().toLocaleString('pt-BR'),
        });
        setQueue(getStoredQueueCampaigns());
        runCampaignWorker(nextSequential.id);
      }
    }
  };

  // Campaign Execution Loop
  const runCampaignWorker = async (campaignId: string) => {
    if (activeRunnersRef.current.has(campaignId)) return;
    activeRunnersRef.current.add(campaignId);

    const config = getStoredConfig();

    while (true) {
      const currentList = getStoredQueueCampaigns();
      const camp = currentList.find((c) => c.id === campaignId);

      if (!camp || camp.status !== 'running') {
        activeRunnersRef.current.delete(campaignId);
        break;
      }

      // Find first pending contact
      const pendingIndex = camp.contacts.findIndex((c) => c.status === 'pending');
      if (pendingIndex === -1) {
        // All contacts processed -> Completed
        const completed = updateStoredQueueCampaign(campaignId, {
          status: 'completed',
          completedAt: new Date().toLocaleString('pt-BR'),
        });
        setQueue(completed);
        activeRunnersRef.current.delete(campaignId);
        break;
      }

      const contact = camp.contacts[pendingIndex];
      const targetInstance =
        camp.selectedInstances[pendingIndex % (camp.selectedInstances.length || 1)] ||
        config.instanceName ||
        'allwhatspy_instancia';

      // Format Message
      let personalizedMsg = camp.messageTemplate.replace(/\{nome\}/gi, contact.name || 'Cliente');
      if (camp.enableSpintax) {
        personalizedMsg = parseSpintax(personalizedMsg);
      }

      // Mark contact as sending
      camp.contacts[pendingIndex].status = 'sending';
      updateStoredQueueCampaign(campaignId, { contacts: camp.contacts });
      setQueue(getStoredQueueCampaigns());

      const sentTimeStr = new Date().toLocaleString('pt-BR');

      try {
        const res = await fetch('/api/evolution/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...config,
            instanceName: targetInstance,
            phone: contact.phone,
            message: personalizedMsg,
            attachment: camp.attachment ? camp.attachment : undefined,
          }),
        });

        const data = await res.json();
        const updatedContacts = [...camp.contacts];

        if (data.success) {
          updatedContacts[pendingIndex] = {
            ...contact,
            status: 'sent',
            sentAt: sentTimeStr,
          };

          // Record in detailed reports store
          addStoredReportItem({
            id: `rep_queue_${campaignId}_${pendingIndex}`,
            contactName: contact.name || 'Contato',
            phone: contact.phone,
            messageSent: personalizedMsg + (camp.attachment ? ` [Anexo: ${camp.attachment.name}]` : ''),
            status: 'success',
            sentAt: sentTimeStr,
            instanceName: targetInstance,
          });

          const nextSentCount = (camp.sentCount || 0) + 1;
          const updated = updateStoredQueueCampaign(campaignId, {
            contacts: updatedContacts,
            sentCount: nextSentCount,
          });
          setQueue(updated);
        } else {
          updatedContacts[pendingIndex] = {
            ...contact,
            status: 'error',
            errorMessage: data.error,
            sentAt: sentTimeStr,
          };

          // Record error report
          addStoredReportItem({
            id: `rep_queue_err_${campaignId}_${pendingIndex}`,
            contactName: contact.name || 'Contato',
            phone: contact.phone,
            messageSent: personalizedMsg + (camp.attachment ? ` [Anexo: ${camp.attachment.name}]` : ''),
            status: 'error',
            errorCategory: data.errorCategory || 'UNKNOWN',
            errorMessage: data.error || 'Falha no envio',
            sentAt: sentTimeStr,
            instanceName: targetInstance,
          });

          const nextErrCount = (camp.errorCount || 0) + 1;
          const updated = updateStoredQueueCampaign(campaignId, {
            contacts: updatedContacts,
            errorCount: nextErrCount,
          });
          setQueue(updated);
        }
      } catch (err: any) {
        const updatedContacts = [...camp.contacts];
        updatedContacts[pendingIndex] = {
          ...contact,
          status: 'error',
          errorMessage: err.message,
          sentAt: sentTimeStr,
        };
        const updated = updateStoredQueueCampaign(campaignId, {
          contacts: updatedContacts,
          errorCount: (camp.errorCount || 0) + 1,
        });
        setQueue(updated);
      }

      // Delay between messages
      const delaySec = Math.floor(Math.random() * (camp.maxDelay - camp.minDelay + 1)) + camp.minDelay;
      await new Promise((r) => setTimeout(r, delaySec * 1000));
    }
  };

  useEffect(() => {
    queueIntervalRef.current = setInterval(processQueue, 3000);
    return () => {
      if (queueIntervalRef.current) clearInterval(queueIntervalRef.current);
    };
  }, []);

  // Controls
  const handleStartCampaign = (id: string) => {
    const updated = updateStoredQueueCampaign(id, {
      status: 'running',
      startedAt: new Date().toLocaleString('pt-BR'),
    });
    setQueue(updated);
    runCampaignWorker(id);
  };

  const handlePauseCampaign = (id: string) => {
    const updated = updateStoredQueueCampaign(id, { status: 'paused' });
    setQueue(updated);
    activeRunnersRef.current.delete(id);
  };

  const handleStopCampaign = (id: string) => {
    const updated = updateStoredQueueCampaign(id, {
      status: 'stopped',
      completedAt: new Date().toLocaleString('pt-BR'),
    });
    setQueue(updated);
    activeRunnersRef.current.delete(id);
  };

  const handleDeleteCampaign = (id: string) => {
    if (confirm('Deseja excluir esta campanha da fila?')) {
      activeRunnersRef.current.delete(id);
      const updated = deleteStoredQueueCampaign(id);
      setQueue(updated);
    }
  };

  const handleMoveOrder = (id: string, direction: 'up' | 'down') => {
    const updated = moveQueueCampaign(id, direction);
    setQueue(updated);
  };

  // Create Campaign in Queue
  const handleCreateQueueCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Digite o título da campanha.');
      return;
    }
    if (contacts.length === 0) {
      alert('Adicione pelo menos 1 contato para o disparo.');
      return;
    }
    if (selectedInstances.length === 0) {
      alert('Selecione pelo menos 1 instância para o disparo.');
      return;
    }
    if (!messageTemplate.trim() && !attachment) {
      alert('Digite uma mensagem ou anexe um arquivo.');
      return;
    }

    const newCamp: QueueCampaignItem = {
      id: `queue_${Date.now()}`,
      title: title.trim(),
      contacts,
      messageTemplate,
      attachment: attachment ? attachment : undefined,
      selectedInstances,
      enableSpintax,
      minDelay,
      maxDelay,
      executionMode,
      order: queue.length + 1,
      status: executionMode === 'parallel' ? 'running' : 'queued',
      sentCount: 0,
      errorCount: 0,
      createdAt: new Date().toLocaleString('pt-BR'),
    };

    const updated = addStoredQueueCampaign(newCamp);
    setQueue(updated);
    setShowCreateModal(false);

    // Reset Form
    setTitle('');
    setContacts([]);
    setAttachment(null);

    if (newCamp.status === 'running') {
      runCampaignWorker(newCamp.id);
    }
  };

  // Attachment Handler
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo 20MB.');
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

  // CSV Import
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
              id: `q_csv_${idx}_${Date.now()}`,
              phone: formatPhoneNumber(String(rawPhone)),
              name: String(rawName).trim(),
              status: 'pending',
            });
          }
        });
        if (imported.length > 0) {
          setContacts((prev) => [...prev, ...imported]);
          alert(`${imported.length} contatos adicionados à campanha!`);
        }
      },
    });
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone) return;
    setContacts((prev) => [
      ...prev,
      {
        id: `q_man_${Date.now()}`,
        phone: formatPhoneNumber(manualPhone),
        name: manualName || 'Cliente',
        status: 'pending',
      },
    ]);
    setManualPhone('');
    setManualName('');
  };

  const toggleInstanceSelection = (instName: string) => {
    setSelectedInstances((prev) =>
      prev.includes(instName)
        ? prev.length === 1
          ? prev
          : prev.filter((i) => i !== instName)
        : [...prev, instName]
    );
  };

  // Metrics
  const totalCampaigns = queue.length;
  const runningCount = queue.filter((c) => c.status === 'running').length;
  const queuedCount = queue.filter((c) => c.status === 'queued').length;
  const completedCount = queue.filter((c) => c.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Total na Fila</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{totalCampaigns}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
            <ListOrdered className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Em Andamento</p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{runningCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
            <Play className="w-6 h-6 text-emerald-600 dark:text-emerald-400 fill-emerald-600/20" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Aguardando Fila</p>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{queuedCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Concluídas</p>
            <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">{completedCount}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </div>

      {/* Header Bar */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <ListOrdered className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> Gerenciador de Filas & Múltiplos Disparos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Organize campanhas em ordem de execução sequencial ou dispare múltiplas simultaneamente com revezamento de instâncias.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Criar Novo Disparo na Fila
        </button>
      </div>

      {/* Queue List */}
      <div className="space-y-4">
        {queue.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-3 shadow-sm">
            <ListOrdered className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Nenhum disparo na fila ainda</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Clique em "Criar Novo Disparo na Fila" para agendar envios sequenciais ou simultâneos com múltiplas instâncias.
            </p>
          </div>
        ) : (
          queue.map((camp, index) => {
            const totalContacts = camp.contacts.length;
            const sent = camp.sentCount || 0;
            const progress = totalContacts > 0 ? Math.round((sent / totalContacts) * 100) : 0;

            return (
              <div
                key={camp.id}
                className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-sm space-y-4 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Title & Info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-mono font-extrabold text-xs flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30">
                        #{camp.order}
                      </span>

                      <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{camp.title}</h3>

                      {/* Status Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          camp.status === 'running'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-pulse'
                            : camp.status === 'queued'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            : camp.status === 'paused'
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            : camp.status === 'completed'
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {camp.status === 'running'
                          ? '🟢 Em Andamento'
                          : camp.status === 'queued'
                          ? '⏳ Na Fila (Aguardando)'
                          : camp.status === 'paused'
                          ? '⏸️ Pausado'
                          : camp.status === 'completed'
                          ? '🎉 Concluído'
                          : '⏹️ Parado'}
                      </span>

                      {/* Mode Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                          camp.executionMode === 'sequential'
                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20'
                            : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20'
                        }`}
                      >
                        {camp.executionMode === 'sequential' ? (
                          <>
                            <Repeat className="w-3 h-3" /> Sequencial
                          </>
                        ) : (
                          <>
                            <Zap className="w-3 h-3" /> Simultâneo (Paralelo)
                          </>
                        )}
                      </span>
                    </div>

                    {/* Instances & Meta */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium flex-wrap">
                      <span>Criado em: {camp.createdAt}</span>
                      <span>&bull;</span>
                      <span>{totalContacts} contatos</span>
                      <span>&bull;</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>Instâncias:</span>
                        {camp.selectedInstances.map((inst) => (
                          <span
                            key={inst}
                            className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold"
                          >
                            📱 {inst}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Order Reorder */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <button
                        onClick={() => handleMoveOrder(camp.id, 'up')}
                        disabled={index === 0}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-30"
                        title="Subir ordem na fila"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveOrder(camp.id, 'down')}
                        disabled={index === queue.length - 1}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-30"
                        title="Descer ordem na fila"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Play/Pause Controls */}
                    {camp.status !== 'running' && camp.status !== 'completed' && (
                      <button
                        onClick={() => handleStartCampaign(camp.id)}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" /> Iniciar
                      </button>
                    )}

                    {camp.status === 'running' && (
                      <button
                        onClick={() => handlePauseCampaign(camp.id)}
                        className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                      >
                        <Pause className="w-3.5 h-3.5" /> Pausar
                      </button>
                    )}

                    {camp.status === 'running' && (
                      <button
                        onClick={() => handleStopCampaign(camp.id)}
                        className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                      >
                        <StopCircle className="w-3.5 h-3.5" /> Parar
                      </button>
                    )}

                    {/* View Report Button */}
                    <button
                      onClick={() => onViewReport(camp)}
                      className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                      title="Ver todos os disparos desta campanha no relatório detalhado"
                    >
                      <BarChart3 className="w-3.5 h-3.5" /> Ver Relatório deste Disparo
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteCampaign(camp.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      title="Remover da fila"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-600 dark:text-slate-400">
                      Progresso: {sent} de {totalContacts} enviados ({camp.errorCount || 0} falhas)
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono font-extrabold">{progress}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-950 overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal to Create Campaign in Queue */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
                  Adicionar Novo Disparo na Fila
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQueueCampaign} className="space-y-4">
              {/* Campaign Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Título do Disparo / Campanha:</label>
                <input
                  type="text"
                  placeholder="Ex: Campanha Promoção - Base 1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 shadow-sm font-bold"
                />
              </div>

              {/* Execution Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Modo de Execução da Fila:</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    onClick={() => setExecutionMode('sequential')}
                    className={`cursor-pointer p-3.5 rounded-2xl border text-xs font-bold transition-all flex items-start gap-2.5 ${
                      executionMode === 'sequential'
                        ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500 text-indigo-900 dark:text-indigo-300 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exec_mode"
                      checked={executionMode === 'sequential'}
                      onChange={() => setExecutionMode('sequential')}
                      className="mt-0.5 text-indigo-600 focus:ring-0"
                    />
                    <div>
                      <p className="flex items-center gap-1 text-xs">
                        <Repeat className="w-3.5 h-3.5 text-indigo-500" /> 🔄 Sequencial (Fila)
                      </p>
                      <p className="text-[10px] font-normal text-slate-400 mt-0.5">
                        Inicia automaticamente assim que a campanha anterior terminar.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setExecutionMode('parallel')}
                    className={`cursor-pointer p-3.5 rounded-2xl border text-xs font-bold transition-all flex items-start gap-2.5 ${
                      executionMode === 'parallel'
                        ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500 text-indigo-900 dark:text-indigo-300 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exec_mode"
                      checked={executionMode === 'parallel'}
                      onChange={() => setExecutionMode('parallel')}
                      className="mt-0.5 text-indigo-600 focus:ring-0"
                    />
                    <div>
                      <p className="flex items-center gap-1 text-xs">
                        <Zap className="w-3.5 h-3.5 text-amber-500" /> ⚡ Simultâneo (Paralelo)
                      </p>
                      <p className="text-[10px] font-normal text-slate-400 mt-0.5">
                        Executa agora mesmo ao mesmo tempo com outros disparos.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Instances Multi-Selection */}
              <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-500" /> Instâncias Utilizadas no Disparo ({selectedInstances.length})
                  </span>
                  <button
                    type="button"
                    onClick={fetchInstances}
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-bold"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingInstances ? 'animate-spin' : ''}`} /> Atualizar
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {availableInstances.map((inst) => {
                    const isSelected = selectedInstances.includes(inst.name);
                    return (
                      <label
                        key={inst.name}
                        onClick={() => toggleInstanceSelection(inst.name)}
                        className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="hidden"
                        />
                        <span className="font-mono">📱 {inst.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Message Editor */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Mensagem / Legenda:</span>
                  <span className="text-[10px] text-slate-400 font-mono">Use {'{nome}'} e {'{Olá|Oi}'}</span>
                </label>
                <textarea
                  rows={4}
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  placeholder="Digite o texto do disparo..."
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 shadow-sm resize-none"
                />
              </div>

              {/* Attachment */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-indigo-500" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {attachment ? attachment.name : 'Anexo de Arquivo (Opcional)'}
                  </span>
                </div>
                <input
                  type="file"
                  id="queue-file-input"
                  onChange={handleAttachmentChange}
                  className="hidden"
                />
                {attachment ? (
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="text-rose-500 hover:underline font-bold"
                  >
                    Remover
                  </button>
                ) : (
                  <label
                    htmlFor="queue-file-input"
                    className="cursor-pointer px-3 py-1 rounded-full bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 text-[11px] font-bold shadow-sm"
                  >
                    Escolher Arquivo
                  </label>
                )}
              </div>

              {/* Delay & Spintax */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSpintax}
                    onChange={(e) => setEnableSpintax(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-0"
                  />
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Ativar Spintax
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">Delay aleatório:</span>
                  <input
                    type="number"
                    min={5}
                    value={minDelay}
                    onChange={(e) => setMinDelay(Number(e.target.value))}
                    className="w-16 p-1.5 rounded-lg bg-white dark:bg-slate-900 border text-center font-bold"
                  />
                  <span className="text-slate-400">até</span>
                  <input
                    type="number"
                    max={120}
                    value={maxDelay}
                    onChange={(e) => setMaxDelay(Number(e.target.value))}
                    className="w-16 p-1.5 rounded-lg bg-white dark:bg-slate-900 border text-center font-bold"
                  />
                  <span className="text-slate-400">segundos</span>
                </div>
              </div>

              {/* Contacts Selection */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-300">Contatos ({contacts.length})</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".csv"
                      id="queue-csv-upload"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="queue-csv-upload"
                      className="cursor-pointer text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3" /> Importar CSV
                    </label>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nome"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-1/3 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Telefone (5511999998888)"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="flex-1 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddManual}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-500/25 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Adicionar à Fila
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
