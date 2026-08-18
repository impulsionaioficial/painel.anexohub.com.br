'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Mail, Upload, Plus, Trash2, Play, Pause, Sparkles, Clock, FileText, Server, ScrollText, Calendar, Repeat, Search, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { EmailContactItem, SMTPAccount, LogEntry } from '@/lib/types';
import { getStoredSMTPAccounts, getStoredScrapedLeads } from '@/lib/email-store';
import { parseSpintax } from '@/lib/evolution-store';
import { getActiveUser, hasPermission } from '@/lib/auth-store';

interface EmailScheduledTask {
  id: string;
  title: string;
  recipients: EmailContactItem[];
  subject: string;
  bodyHtml: string;
  scheduleType: 'once' | 'recurring';
  executeAt?: string;
  recurrenceUnit?: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  recurrenceInterval?: number;
  status: 'active' | 'paused';
  createdDate: string;
}

const STORAGE_EMAIL_TASKS_KEY = 'awp_email_scheduled_tasks';
const STORAGE_EMAIL_LOGS_KEY = 'awp_email_logs_history';

function getStoredEmailTasks(): EmailScheduledTask[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = sessionStorage.getItem(STORAGE_EMAIL_TASKS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveStoredEmailTasks(tasks: EmailScheduledTask[]): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_EMAIL_TASKS_KEY, JSON.stringify(tasks));
}

function getStoredEmailLogs(): LogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = sessionStorage.getItem(STORAGE_EMAIL_LOGS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveStoredEmailLogs(logs: LogEntry[]): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_EMAIL_LOGS_KEY, JSON.stringify(logs.slice(0, 200)));
}

export default function DisparadorEmailPage() {
  const [activeTab, setActiveTab] = useState<'mass' | 'logs' | 'schedule'>('mass');

  const [smtpAccounts, setSmtpAccounts] = useState<SMTPAccount[]>([]);
  const [selectedSmtpIds, setSelectedSmtpIds] = useState<Set<string>>(new Set());

  const [contacts, setContacts] = useState<EmailContactItem[]>([]);
  const [manualEmail, setManualEmail] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');

  const [subject, setSubject] = useState<string>('{Olá|Prezado(a)} {nome}, proposta comercial exclusiva');
  const [bodyHtml, setBodyHtml] = useState<string>(
    `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
  <h2>{Olá|Oi|Tudo bem} {nome},</h2>
  <p>Gostaria de apresentar nossa solução para otimizar seus processos de atendimento e marketing.</p>
  <p>Qual seria o melhor horário para conversarmos esta semana?</p>
  <br/>
  <p>Atenciosamente,</p>
  <p><strong>Equipe de Atendimento</strong></p>
</div>`
  );

  const [enableSpintax, setEnableSpintax] = useState<boolean>(true);
  const [minDelay, setMinDelay] = useState<number>(5);
  const [maxDelay, setMaxDelay] = useState<number>(15);

  const [isSending, setIsSending] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<string>('');

  // Email Scheduling State
  const [scheduledTasks, setScheduledTasks] = useState<EmailScheduledTask[]>([]);
  const [schedTitle, setSchedTitle] = useState<string>('Disparo Recorrente de E-mail');
  const [schedSubject, setSchedSubject] = useState<string>('Lembrete de Cobrança / Notificação');
  const [schedBody, setSchedBody] = useState<string>('<p>Olá {nome}, este é um e-mail agendado automaticamente.</p>');
  const [schedRecipients, setSchedRecipients] = useState<EmailContactItem[]>([]);
  const [schedManualEmail, setSchedManualEmail] = useState<string>('');
  const [schedType, setSchedType] = useState<'once' | 'recurring'>('recurring');
  const [schedExecuteAt, setSchedExecuteAt] = useState<string>('');
  const [schedRecurrenceUnit, setSchedRecurrenceUnit] = useState<'minutes' | 'hours' | 'days' | 'weeks' | 'months'>('hours');
  const [schedRecurrenceInterval, setSchedRecurrenceInterval] = useState<number>(24);

  useEffect(() => {
    const accs = getStoredSMTPAccounts();
    setSmtpAccounts(accs);
    if (accs.length > 0) {
      setSelectedSmtpIds(new Set([accs[0].id]));
    }

    setLogs(getStoredEmailLogs());
    setScheduledTasks(getStoredEmailTasks());

    // Check if there are leads passed from the Extrator
    const scraped = getStoredScrapedLeads();
    if (scraped.length > 0) {
      const imported: EmailContactItem[] = scraped.map((s, idx) => ({
        id: `scraped_${idx}_${Date.now()}`,
        email: s.email,
        name: s.name || 'Cliente',
        status: 'pending',
      }));
      setContacts((prev) => [...prev, ...imported]);
    }
  }, []);

  const addLogItem = (entry: LogEntry) => {
    setLogs((prev) => {
      const updated = [entry, ...prev].slice(0, 200);
      saveStoredEmailLogs(updated);
      return updated;
    });
  };

  const toggleSmtpSelection = (id: string) => {
    const next = new Set(selectedSmtpIds);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedSmtpIds(next);
  };

  // CSV Import handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const imported: EmailContactItem[] = [];
        results.data.forEach((row: any, idx) => {
          const rawEmail = row.email || row.e_mail || row.mail || Object.values(row)[0];
          const rawName = row.nome || row.name || row.cliente || '';

          if (rawEmail && String(rawEmail).includes('@')) {
            imported.push({
              id: `csv_email_${idx}_${Date.now()}`,
              email: String(rawEmail).trim().toLowerCase(),
              name: String(rawName).trim(),
              status: 'pending',
            });
          }
        });

        if (imported.length > 0) {
          setContacts((prev) => [...prev, ...imported]);
          alert(`${imported.length} e-mails importados com sucesso!`);
        } else {
          alert('Nenhum e-mail válido encontrado no arquivo CSV.');
        }
      },
      error: () => alert('Erro ao ler arquivo CSV'),
    });
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail || !manualEmail.includes('@')) return;

    const newContact: EmailContactItem = {
      id: `manual_email_${Date.now()}`,
      email: manualEmail.trim().toLowerCase(),
      name: manualName || 'Cliente',
      status: 'pending',
    };

    setContacts((prev) => [...prev, newContact]);
    setManualEmail('');
    setManualName('');
  };

  const removeContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const clearContacts = () => {
    if (confirm('Deseja limpar a lista de e-mails?')) {
      setContacts([]);
    }
  };

  // Start Mass Email Dispatch Loop with SMTP Rotation
  const startCampaign = async () => {
    const currentUser = getActiveUser();
    if (!hasPermission(currentUser, 'can_start_campaign')) {
      alert('🔒 Sua conta não possui permissão para iniciar disparos de e-mail.');
      return;
    }

    if (contacts.length === 0) {
      alert('Adicione pelo menos um e-mail para iniciar.');
      return;
    }
    if (selectedSmtpIds.size === 0) {
      alert('Selecione pelo menos uma conta SMTP para envio.');
      return;
    }

    setIsSending(true);
    setIsPaused(false);

    const selectedAccounts = smtpAccounts.filter((a) => selectedSmtpIds.has(a.id));

    for (let i = currentIndex; i < contacts.length; i++) {
      if (isPaused) break;

      const contact = contacts[i];
      setCurrentIndex(i);

      // Rotate SMTP accounts sequentially
      const currentSmtp = selectedAccounts[i % selectedAccounts.length];

      setContacts((prev) =>
        prev.map((c, idx) => (idx === i ? { ...c, status: 'sending' } : c))
      );

      // Process Subject & Body templates (Variables + Spin-tax)
      let parsedSubject = subject.replace(/\{nome\}/gi, contact.name || 'Cliente').replace(/\{email\}/gi, contact.email);
      let parsedBody = bodyHtml.replace(/\{nome\}/gi, contact.name || 'Cliente').replace(/\{email\}/gi, contact.email);

      if (enableSpintax) {
        parsedSubject = parseSpintax(parsedSubject);
        parsedBody = parseSpintax(parsedBody);
      }

      try {
        const res = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            smtpAccount: currentSmtp,
            recipient: contact,
            subject: parsedSubject,
            bodyHtml: parsedBody,
          }),
        });

        const data = await res.json();

        if (data.success) {
          setContacts((prev) =>
            prev.map((c, idx) =>
              idx === i ? { ...c, status: 'sent', sentAt: new Date().toLocaleTimeString() } : c
            )
          );
          addLogItem({
            id: `log_email_${Date.now()}_${i}`,
            timestamp: new Date().toLocaleTimeString('pt-BR'),
            phone: contact.email,
            status: 'success',
            message: `E-mail enviado via SMTP [${currentSmtp.name}] para ${contact.email} - Assunto: "${parsedSubject}"`,
          });
        } else {
          setContacts((prev) =>
            prev.map((c, idx) =>
              idx === i ? { ...c, status: 'error', errorMessage: data.error } : c
            )
          );
          addLogItem({
            id: `log_email_${Date.now()}_${i}`,
            timestamp: new Date().toLocaleTimeString('pt-BR'),
            phone: contact.email,
            status: 'error',
            message: `Erro via SMTP [${currentSmtp.name}]: ${data.error}`,
          });
        }
      } catch (err: any) {
        setContacts((prev) =>
          prev.map((c, idx) => (idx === i ? { ...c, status: 'error', errorMessage: err.message } : c))
        );
      }

      // Delay between email dispatches
      if (i < contacts.length - 1) {
        const randomSeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        addLogItem({
          id: `log_delay_${Date.now()}_${i}`,
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          phone: 'SMTP SYSTEM',
          status: 'info',
          message: `Aguardando delay de ${randomSeconds}s antes do próximo e-mail...`,
        });
        await new Promise((resolve) => setTimeout(resolve, randomSeconds * 1000));
      }
    }

    setIsSending(false);
  };

  // Schedule Tab Handlers
  const handleAddSchedRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedManualEmail || !schedManualEmail.includes('@')) return;

    setSchedRecipients((prev) => [
      ...prev,
      { id: `sched_rec_${Date.now()}`, email: schedManualEmail.trim().toLowerCase(), status: 'pending' },
    ]);
    setSchedManualEmail('');
  };

  const handleCreateEmailSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (schedRecipients.length === 0) {
      alert('Adicione pelo menos um destinatário para o agendamento de e-mail.');
      return;
    }

    const newTask: EmailScheduledTask = {
      id: `email_task_${Date.now()}`,
      title: schedTitle || 'Agendamento de E-mail',
      recipients: schedRecipients,
      subject: schedSubject,
      bodyHtml: schedBody,
      scheduleType: schedType,
      executeAt: schedType === 'once' ? schedExecuteAt : undefined,
      recurrenceUnit: schedType === 'recurring' ? schedRecurrenceUnit : undefined,
      recurrenceInterval: schedType === 'recurring' ? Number(schedRecurrenceInterval) : undefined,
      status: 'active',
      createdDate: new Date().toLocaleDateString('pt-BR'),
    };

    const updated = [newTask, ...scheduledTasks];
    setScheduledTasks(updated);
    saveStoredEmailTasks(updated);

    setSchedTitle('');
    setSchedRecipients([]);
    alert('Agendamento de e-mail salvo com sucesso!');
  };

  const toggleTaskStatus = (id: string) => {
    const updated = scheduledTasks.map((t) => {
      if (t.id === id) {
        return { ...t, status: (t.status === 'active' ? 'paused' : 'active') as any };
      }
      return t;
    });
    setScheduledTasks(updated);
    saveStoredEmailTasks(updated);
  };

  const removeTask = (id: string) => {
    if (confirm('Deseja excluir este agendamento de e-mail?')) {
      const updated = scheduledTasks.filter((t) => t.id !== id);
      setScheduledTasks(updated);
      saveStoredEmailTasks(updated);
    }
  };

  const sentCount = contacts.filter((c) => c.status === 'sent').length;
  const progressPercent = contacts.length > 0 ? Math.round((sentCount / contacts.length) * 100) : 0;

  const filteredLogs = logs.filter(
    (l) => l.message.toLowerCase().includes(logFilter.toLowerCase()) || l.phone.toLowerCase().includes(logFilter.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Horizontal Straight Tabs Bar */}
      <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex items-center gap-2 shadow-sm transition-colors overflow-x-auto scroll-smooth">
        <button
          onClick={() => setActiveTab('mass')}
          className={`shrink-0 md:flex-1 py-3 px-4 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'mass'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Mail className="w-4 h-4" /> Disparo em Massa
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`shrink-0 md:flex-1 py-3 px-4 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${
            activeTab === 'logs'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <ScrollText className="w-4 h-4" /> Logs & Histórico de E-mails
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
      </div>

      {/* TAB 2: LOGS & HISTÓRICO */}
      {activeTab === 'logs' && (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-6 shadow-sm transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Console de Histórico & Logs SMTP
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">
                Registros persistentes dos envios e respostas dos servidores SMTP.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filtrar logs por e-mail ou assunto..."
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500 w-64 shadow-sm"
                />
              </div>

              {logs.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Deseja limpar todos os logs de e-mail?')) {
                      setLogs([]);
                      saveStoredEmailLogs([]);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1 shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar Logs
                </button>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 font-mono text-xs h-96 overflow-y-auto space-y-2 border border-slate-900">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-16 text-slate-600 font-medium">Nenhum log de e-mail registrado até o momento.</div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2.5 rounded-xl border flex items-start justify-between gap-3 ${
                    log.status === 'success'
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                      : log.status === 'error'
                      ? 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                      : 'bg-slate-900/40 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-slate-500 text-[11px] shrink-0 mt-0.5">[{log.timestamp}]</span>
                    <span className="break-all">{log.message}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AGENDAMENTO & RECORRÊNCIA */}
      {activeTab === 'schedule' && (
        <div className="space-y-8">
          {/* Create Email Schedule Form */}
          <form onSubmit={handleCreateEmailSchedule} className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-6 shadow-sm transition-colors">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Criar Novo Agendamento de E-mail
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Título do Agendamento</label>
                <input
                  type="text"
                  placeholder="ex: Envio Semanal de Relatório / Proposta"
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
                  required
                />
              </div>

              <div className="md:col-span-4 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Modo de Programação</label>
                <select
                  value={schedType}
                  onChange={(e) => setSchedType(e.target.value as any)}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
                >
                  <option value="recurring">🔄 Disparo Recorrente Programado</option>
                  <option value="once">🕒 Data & Hora Única</option>
                </select>
              </div>
            </div>

            {/* Schedule Mode Parameters */}
            {schedType === 'once' ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Data e Horário para Disparo
                </label>
                <input
                  type="datetime-local"
                  value={schedExecuteAt}
                  onChange={(e) => setSchedExecuteAt(e.target.value)}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono shadow-sm"
                  required
                />
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Repeat className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Frequência da Recorrência
                </label>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-slate-500 font-medium">Repetir a cada:</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={schedRecurrenceInterval}
                    onChange={(e) => setSchedRecurrenceInterval(Number(e.target.value))}
                    className="w-20 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold text-center shadow-sm"
                    required
                  />
                  <select
                    value={schedRecurrenceUnit}
                    onChange={(e) => setSchedRecurrenceUnit(e.target.value as any)}
                    className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-bold shadow-sm"
                  >
                    <option value="minutes">Minuto(s)</option>
                    <option value="hours">Hora(s)</option>
                    <option value="days">Dia(s)</option>
                    <option value="weeks">Semana(s)</option>
                    <option value="months">Mês / Meses</option>
                  </select>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Assunto do E-mail</label>
                <input
                  type="text"
                  value={schedSubject}
                  onChange={(e) => setSchedSubject(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Conteúdo (HTML / Texto)</label>
                <textarea
                  value={schedBody}
                  onChange={(e) => setSchedBody(e.target.value)}
                  rows={4}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500 resize-none shadow-sm"
                  required
                />
              </div>
            </div>

            {/* Recipients Form */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Destinatários Agendados ({schedRecipients.length})
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="cliente@email.com"
                  value={schedManualEmail}
                  onChange={(e) => setSchedManualEmail(e.target.value)}
                  className="flex-1 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs shadow-sm"
                />
                <button type="button" onClick={handleAddSchedRecipient} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-2xl text-xs font-extrabold border border-slate-200 dark:border-slate-700 shadow-sm">
                  + Adicionar
                </button>
              </div>
              {schedRecipients.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {schedRecipients.map((r, idx) => (
                    <span key={r.id} className="px-3 py-1 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-300 font-mono text-[11px] border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 shadow-sm">
                      {r.email}
                      <button
                        type="button"
                        onClick={() => setSchedRecipients(schedRecipients.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-md shadow-indigo-500/25 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Salvar Agendamento de E-mail
              </button>
            </div>
          </form>

          {/* Active Email Tasks List */}
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-sm transition-colors">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Tarefas Agendadas de E-mail ({scheduledTasks.length})
            </h2>

            <div className="space-y-3">
              {scheduledTasks.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs font-medium">Nenhum agendamento de e-mail ativo.</div>
              ) : (
                scheduledTasks.map((task) => (
                  <div key={task.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{task.title}</h3>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            task.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {task.status === 'active' ? '🟢 Ativo' : '⏸️ Pausado'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">Assunto: "{task.subject}"</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                        {task.recipients.length} destinatários &bull; Criado em {task.createdDate}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleTaskStatus(task.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-sm"
                      >
                        {task.status === 'active' ? <Pause className="w-3.5 h-3.5 text-amber-500" /> : <Play className="w-3.5 h-3.5 text-indigo-500" />}
                        {task.status === 'active' ? 'Pausar' : 'Ativar'}
                      </button>
                      <button onClick={() => removeTask(task.id)} className="p-1.5 text-slate-400 hover:text-rose-500">
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

      {/* TAB 1: DISPARO EM MASSA */}
      {activeTab === 'mass' && (
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
                <Mail className="w-7 h-7 text-indigo-600 dark:text-indigo-400" /> Disparador de E-mails em Massa (SMTP)
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
                Envie campanhas por e-mail com rotação de servidores SMTP, suporte a templates HTML e controle anti-spam.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {!isSending ? (
                <button
                  onClick={startCampaign}
                  disabled={contacts.length === 0 || selectedSmtpIds.size === 0}
                  className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-md shadow-indigo-500/25 disabled:opacity-50 flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" /> Iniciar Envios ({contacts.length})
                </button>
              ) : (
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shadow-md flex items-center gap-2"
                >
                  <Pause className="w-4 h-4" /> {isPaused ? 'Continuar' : 'Pausar'}
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {contacts.length > 0 && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-2 shadow-sm">
              <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 font-bold">
                <span>Progresso da Campanha de E-mail ({sentCount} de {contacts.length} enviados)</span>
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

          {/* Grid: Config & Editor / Contacts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: SMTP Selector & Email Template Editor (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* SMTP Account Rotation Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-3 shadow-sm transition-colors">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Rotação de Contas SMTP Remetentes
                </h2>
                <div className="space-y-2">
                  {smtpAccounts.map((acc) => (
                    <label
                      key={acc.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer text-xs transition-colors shadow-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={selectedSmtpIds.has(acc.id)}
                          onChange={() => toggleSmtpSelection(acc.id)}
                          className="rounded-md border-slate-300 text-indigo-600 focus:ring-0"
                        />
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{acc.name}</p>
                          <p className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">{acc.user} ({acc.host})</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                        Ativa
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Email Content Editor */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-sm transition-colors">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Assunto & Corpo do E-mail (HTML)
                </h2>

                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-500 font-medium">Assunto da Mensagem:</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Assunto do e-mail..."
                    className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-500 font-medium">Corpo do E-mail (HTML / Texto):</label>
                  <textarea
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    rows={8}
                    placeholder="Código HTML ou texto do e-mail..."
                    className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:border-indigo-500 resize-none font-mono shadow-sm"
                  />
                </div>

                {/* Spin-tax & Delay Settings */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-3 text-xs">
                  <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableSpintax}
                      onChange={(e) => setEnableSpintax(e.target.checked)}
                      className="rounded-md border-slate-300 text-indigo-600 focus:ring-0"
                    />
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    Ativar Spin-tax (ex: {'{Prezado|Olá|Oi}'})
                  </label>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-4">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-500" /> Delay entre e-mails:
                    </span>
                    <input
                      type="number"
                      min={2}
                      max={60}
                      value={minDelay}
                      onChange={(e) => setMinDelay(Number(e.target.value))}
                      className="w-16 p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center font-mono font-bold text-slate-900 dark:text-slate-100 shadow-sm"
                    />
                    <span className="text-slate-400">até</span>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      value={maxDelay}
                      onChange={(e) => setMaxDelay(Number(e.target.value))}
                      className="w-16 p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center font-mono font-bold text-slate-900 dark:text-slate-100 shadow-sm"
                    />
                    <span className="text-slate-400">segundos</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Contacts & Realtime Logs (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Contacts Upload */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-sm transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    Lista de E-mails ({contacts.length})
                  </h3>
                  {contacts.length > 0 && (
                    <button onClick={clearContacts} className="text-xs text-rose-500 hover:text-rose-600 font-bold">
                      Limpar
                    </button>
                  )}
                </div>

                {/* CSV Import */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-800 hover:border-indigo-500 text-center transition-colors">
                  <input type="file" accept=".csv" id="email-csv" onChange={handleFileUpload} className="hidden" />
                  <label htmlFor="email-csv" className="cursor-pointer text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center gap-1.5">
                    <Upload className="w-4 h-4" /> Importar Lista CSV de E-mails
                  </label>
                </div>

                {/* Manual Form */}
                <form onSubmit={handleAddManual} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="email@cliente.com"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    className="flex-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
                  />
                  <button type="submit" className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 text-xs font-extrabold shadow-sm">
                    + Adicionar
                  </button>
                </form>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {contacts.map((c) => (
                    <div key={c.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs shadow-sm">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{c.name || 'Sem nome'}</p>
                        <p className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{c.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === 'sent' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {c.status === 'sent' ? 'Enviado' : 'Pendente'}
                        </span>
                        <button onClick={() => removeContact(c.id)} className="text-slate-400 hover:text-rose-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Realtime Console */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-3 shadow-sm transition-colors">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Console de Envio SMTP</h3>
                <div className="p-3.5 rounded-2xl bg-slate-950 font-mono text-[11px] h-48 overflow-y-auto space-y-1.5 border border-slate-900">
                  {logs.length === 0 ? (
                    <p className="text-slate-600">Aguardando disparo de e-mails...</p>
                  ) : (
                    logs.map((log) => (
                      <div
                        key={log.id}
                        className={log.status === 'success' ? 'text-emerald-400' : log.status === 'error' ? 'text-rose-400' : 'text-amber-300/80'}
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
