'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { Send, Upload, Plus, Trash2, Play, Pause, AlertTriangle, Sparkles, Clock, CheckCircle, FileText, Info } from 'lucide-react';
import { ContactItem, LogEntry } from '@/lib/types';
import { getStoredConfig, parseSpintax, formatPhoneNumber } from '@/lib/evolution-store';

export default function DisparadorPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [manualPhone, setManualPhone] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');
  const [messageTemplate, setMessageTemplate] = useState<string>('Olá {nome}! Temos uma oferta especial para você hoje. Qualquer dúvida nos chame aqui!');
  const [enableSpintax, setEnableSpintax] = useState<boolean>(true);
  const [minDelay, setMinDelay] = useState<number>(10);
  const [maxDelay, setMaxDelay] = useState<number>(25);

  const [isSending, setIsSending] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

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

  // Add manual contact
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

  // Start Mass Dispatch loop
  const startCampaign = async () => {
    if (contacts.length === 0) {
      alert('Adicione pelo menos um contato para iniciar.');
      return;
    }
    if (!messageTemplate.trim()) {
      alert('Digite uma mensagem.');
      return;
    }

    setIsSending(true);
    setIsPaused(false);
    const config = getStoredConfig();

    for (let i = currentIndex; i < contacts.length; i++) {
      if (isPaused) break;

      const contact = contacts[i];
      setCurrentIndex(i);

      // Update contact state to sending
      setContacts((prev) =>
        prev.map((c, idx) => (idx === i ? { ...c, status: 'sending' } : c))
      );

      // Process message template with variables & spintax
      let personalizedMsg = messageTemplate.replace(/\{nome\}/gi, contact.name || 'Cliente');
      if (enableSpintax) {
        personalizedMsg = parseSpintax(personalizedMsg);
      }

      try {
        const res = await fetch('/api/evolution/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...config,
            phone: contact.phone,
            message: personalizedMsg,
          }),
        });

        const data = await res.json();

        if (data.success) {
          setContacts((prev) =>
            prev.map((c, idx) =>
              idx === i ? { ...c, status: 'sent', sentAt: new Date().toLocaleTimeString() } : c
            )
          );
          setLogs((prev) => [
            {
              id: `log_${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              phone: contact.phone,
              status: 'success',
              message: `Mensagem enviada com sucesso (${personalizedMsg.substring(0, 30)}...)`,
            },
            ...prev,
          ]);
        } else {
          setContacts((prev) =>
            prev.map((c, idx) =>
              idx === i ? { ...c, status: 'error', errorMessage: data.error } : c
            )
          );
          setLogs((prev) => [
            {
              id: `log_${Date.now()}`,
              timestamp: new Date().toLocaleTimeString(),
              phone: contact.phone,
              status: 'error',
              message: `Falha: ${data.error}`,
            },
            ...prev,
          ]);
        }
      } catch (err: any) {
        setContacts((prev) =>
          prev.map((c, idx) =>
            idx === i ? { ...c, status: 'error', errorMessage: err.message } : c
          )
        );
      }

      // Random delay between minDelay and maxDelay seconds (anti-ban protection)
      if (i < contacts.length - 1) {
        const randomSeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        setLogs((prev) => [
          {
            id: `log_delay_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            phone: 'SISTEMA',
            status: 'info',
            message: `Aguardando delay de ${randomSeconds} segundos para o próximo disparo (Anti-ban)...`,
          },
          ...prev,
        ]);
        await new Promise((resolve) => setTimeout(resolve, randomSeconds * 1000));
      }
    }

    setIsSending(false);
  };

  const sentCount = contacts.filter((c) => c.status === 'sent').length;
  const errorCount = contacts.filter((c) => c.status === 'error').length;
  const progressPercent = contacts.length > 0 ? Math.round((sentCount / contacts.length) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Send className="w-7 h-7 text-emerald-400" /> Disparador de Campanhas em Massa
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Envie mensagens para listas de contatos com humanização, variáveis e controle anti-ban.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {!isSending ? (
            <button
              onClick={startCampaign}
              disabled={contacts.length === 0}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-slate-950" /> Iniciar Disparos ({contacts.length})
            </button>
          ) : (
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <Pause className="w-4 h-4" /> {isPaused ? 'Continuar' : 'Pausar'}
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {contacts.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex justify-between text-xs text-slate-300 font-medium">
            <span>Progresso da Campanha ({sentCount} de {contacts.length} enviados)</span>
            <span className="text-emerald-400 font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Grid: Editor + Contacts List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Message Editor & Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Message Template Card */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" /> Editor de Mensagem
              </h2>
              <span className="text-xs text-slate-400 font-mono">Use {'{nome}'} para personalização</span>
            </div>

            <textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={6}
              placeholder="Digite a mensagem aqui..."
              className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/50 resize-none font-sans"
            />

            {/* Anti-Ban & Spin-tax Controls */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSpintax}
                    onChange={(e) => setEnableSpintax(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                  />
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Ativar Spin-tax (ex: {'{Olá|Oi|Tudo bem}'})
                </label>
              </div>

              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-400" /> Intervalo Anti-Ban (Delay aleatório)
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">{minDelay}s - {maxDelay}s</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex-1 space-y-1">
                    <span className="text-slate-500">Mínimo (seg):</span>
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={minDelay}
                      onChange={(e) => setMinDelay(Number(e.target.value))}
                      className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-center font-mono"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <span className="text-slate-500">Máximo (seg):</span>
                    <input
                      type="number"
                      min={10}
                      max={120}
                      value={maxDelay}
                      onChange={(e) => setMaxDelay(Number(e.target.value))}
                      className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-center font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Import Contacts Card */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Upload className="w-5 h-5 text-teal-400" /> Adicionar Contatos
            </h2>

            {/* CSV Upload */}
            <div className="p-4 rounded-xl bg-slate-950 border border-dashed border-slate-800 hover:border-emerald-500/50 text-center transition-colors">
              <input
                type="file"
                accept=".csv"
                id="csv-upload"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="csv-upload" className="cursor-pointer space-y-1 block">
                <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-emerald-400">Importar arquivo CSV / Excel</p>
                <p className="text-[11px] text-slate-500">Formato com colunas: nome, telefone</p>
              </label>
            </div>

            {/* Manual Form */}
            <form onSubmit={handleAddManual} className="flex gap-2">
              <input
                type="text"
                placeholder="Nome (opcional)"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-1/3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500/50"
              />
              <input
                type="text"
                placeholder="Telefone (ex: 5511999998888)"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                className="flex-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500/50 font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Contacts List & Realtime Logs (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Contacts List Card */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-200 text-sm">
                Lista de Envio ({contacts.length})
              </h3>
              {contacts.length > 0 && (
                <button
                  onClick={clearContacts}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar Lista
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {contacts.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Nenhum contato adicionado ainda.
                </div>
              ) : (
                contacts.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-200">{c.name || 'Sem nome'}</p>
                      <p className="font-mono text-slate-400 text-[11px]">{c.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          c.status === 'sent'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : c.status === 'error'
                            ? 'bg-rose-500/20 text-rose-400'
                            : c.status === 'sending'
                            ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                            : 'bg-slate-800 text-slate-400'
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
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Realtime Live Console Logs */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-400" /> Console de Disparo
            </h3>
            <div className="p-3 rounded-xl bg-slate-950 font-mono text-[11px] h-48 overflow-y-auto space-y-1.5 border border-slate-900">
              {logs.length === 0 ? (
                <p className="text-slate-600">Aguardando início do disparo...</p>
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
  );
}
