'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Calendar, Clock, Plus, Trash2, Play, Pause, RefreshCw, Upload, CheckCircle2, AlertCircle, Repeat, Sparkles, Paperclip, X, Image as ImageIcon, FileCheck } from 'lucide-react';
import { ScheduledTask, ContactItem, ScheduledTaskAttachment } from '@/lib/types';
import { getStoredScheduledTasks, saveStoredScheduledTasks, calculateNextRun } from '@/lib/schedule-store';
import { formatPhoneNumber } from '@/lib/evolution-store';

export default function ScheduleManager() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);

  // Form State
  const [title, setTitle] = useState<string>('Disparo Recorrente de Cobrança');
  const [messageTemplate, setMessageTemplate] = useState<string>('Olá {nome}, lembrete da sua fatura mensal!');
  const [attachment, setAttachment] = useState<ScheduledTaskAttachment | null>(null);

  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [manualPhone, setManualPhone] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');

  const [scheduleType, setScheduleType] = useState<'once' | 'recurring'>('recurring');
  const [executeAt, setExecuteAt] = useState<string>('');
  const [recurrenceUnit, setRecurrenceUnit] = useState<'minutes' | 'hours' | 'days' | 'weeks' | 'months'>('hours');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(24);
  const [enableSpintax, setEnableSpintax] = useState<boolean>(true);

  useEffect(() => {
    setTasks(getStoredScheduledTasks());
  }, []);

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
              id: `sched_csv_${idx}_${Date.now()}`,
              phone: formatPhoneNumber(String(rawPhone)),
              name: String(rawName).trim(),
              status: 'pending',
            });
          }
        });

        if (imported.length > 0) {
          setContacts((prev) => [...prev, ...imported]);
          alert(`${imported.length} contatos adicionados ao agendamento!`);
        }
      },
    });
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPhone) return;

    const newContact: ContactItem = {
      id: `sched_man_${Date.now()}`,
      phone: formatPhoneNumber(manualPhone),
      name: manualName || 'Cliente',
      status: 'pending',
    };

    setContacts((prev) => [...prev, newContact]);
    setManualPhone('');
    setManualName('');
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (contacts.length === 0) {
      alert('Adicione pelo menos um contato para o agendamento.');
      return;
    }
    if (!messageTemplate.trim() && !attachment) {
      alert('Digite uma mensagem ou anexe um arquivo.');
      return;
    }

    const newTask: ScheduledTask = {
      id: `task_${Date.now()}`,
      title: title || 'Agendamento WhatsApp',
      contacts,
      messageTemplate,
      attachment: attachment ? attachment : undefined,
      enableSpintax,
      minDelay: 10,
      maxDelay: 25,
      scheduleType,
      executeAt: scheduleType === 'once' ? executeAt : undefined,
      recurrenceUnit: scheduleType === 'recurring' ? recurrenceUnit : undefined,
      recurrenceInterval: scheduleType === 'recurring' ? Number(recurrenceInterval) : undefined,
      status: 'active',
      createdDate: new Date().toLocaleDateString('pt-BR'),
    };

    newTask.nextRun = calculateNextRun(newTask);

    const updated = [newTask, ...tasks];
    setTasks(updated);
    saveStoredScheduledTasks(updated);

    // Reset Form
    setTitle('');
    setContacts([]);
    setAttachment(null);
    alert('Agendamento criado com sucesso!');
  };

  const toggleTaskStatus = (id: string) => {
    const updated = tasks.map((t) => {
      if (t.id === id) {
        const nextStatus = t.status === 'active' ? 'paused' : 'active';
        return { ...t, status: nextStatus as any };
      }
      return t;
    });
    setTasks(updated);
    saveStoredScheduledTasks(updated);
  };

  const removeTask = (id: string) => {
    if (confirm('Deseja excluir este agendamento?')) {
      const updated = tasks.filter((t) => t.id !== id);
      setTasks(updated);
      saveStoredScheduledTasks(updated);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Create Scheduled Task Form */}
      <form onSubmit={handleCreateTask} className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-6 shadow-sm transition-colors">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Criar Novo Agendamento ou Disparo Recorrente
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-8 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Título do Agendamento</label>
            <input
              type="text"
              placeholder="ex: Lembrete de Cobrança / Boas-vindas"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
              required
            />
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Modo de Programação</label>
            <select
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value as any)}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
            >
              <option value="recurring">🔄 Disparo Recorrente Programado</option>
              <option value="once">🕒 Data & Hora Única</option>
            </select>
          </div>
        </div>

        {/* Schedule Mode Parameters */}
        {scheduleType === 'once' ? (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Data e Horário Específicos para Execução
            </label>
            <input
              type="datetime-local"
              value={executeAt}
              onChange={(e) => setExecuteAt(e.target.value)}
              className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono shadow-sm"
              required
            />
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Repeat className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Frequência da Recorrência Programada
            </label>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-slate-500 font-medium">Repetir a cada:</span>
              <input
                type="number"
                min={1}
                max={365}
                value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
                className="w-20 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold text-center shadow-sm"
                required
              />
              <select
                value={recurrenceUnit}
                onChange={(e) => setRecurrenceUnit(e.target.value as any)}
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

        {/* Message & Variables */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Mensagem da Automação (Suporta {'{nome}'} e Spin-tax)</label>
          <textarea
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
            rows={4}
            placeholder="Sua mensagem..."
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none shadow-sm"
          />
        </div>

        {/* Attachment Section inside Schedule Form */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Anexo de Arquivo para o Agendamento (Imagem, PDF, Documento)
            </span>
            <input
              type="file"
              id="sched-attachment-input"
              onChange={handleAttachmentChange}
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,video/*,audio/*"
              className="hidden"
            />
            <label
              htmlFor="sched-attachment-input"
              className="cursor-pointer px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Paperclip className="w-3.5 h-3.5" /> Anexar Arquivo
            </label>
          </div>

          {attachment ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30 text-xs shadow-sm">
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
                type="button"
                onClick={removeAttachment}
                className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                title="Remover anexo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Nenhum arquivo anexado a esta tarefa agendada (máximo 20MB).</p>
          )}
        </div>

        {/* Contacts Import */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">Contatos Agendados ({contacts.length})</span>
            <div className="flex items-center gap-2">
              <input type="file" accept=".csv" id="sched-csv" onChange={handleFileUpload} className="hidden" />
              <label htmlFor="sched-csv" className="cursor-pointer text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" /> Importar CSV
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nome"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className="w-1/3 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs shadow-sm"
            />
            <input
              type="text"
              placeholder="Telefone (5511999998888)"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              className="flex-1 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs font-mono shadow-sm"
            />
            <button type="button" onClick={handleAddManual} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-extrabold shadow-sm">
              + Add
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-md shadow-indigo-500/25 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Salvar Agendamento
          </button>
        </div>
      </form>

      {/* Active Scheduled Tasks List */}
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-sm transition-colors">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Tarefas Agendadas ({tasks.length})
        </h2>

        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs font-medium">
              Nenhuma tarefa de agendamento criada ainda.
            </div>
          ) : (
            tasks.map((task) => (
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
                    {task.attachment && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                        <Paperclip className="w-3 h-3" /> {task.attachment.name}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Modo:{' '}
                    <strong className="text-slate-900 dark:text-slate-200">
                      {task.scheduleType === 'once'
                        ? `Execução Única em ${task.executeAt || 'Sem data'}`
                        : `Recorrente a cada ${task.recurrenceInterval} ${task.recurrenceUnit}`}
                    </strong>
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    Próxima Execução estimada: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{task.nextRun || 'Agendado'}</span> &bull; {task.contacts.length} contatos
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTaskStatus(task.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-sm"
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
  );
}
