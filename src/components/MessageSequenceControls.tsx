'use client';

import { Clock3, Keyboard, MessageSquareText } from 'lucide-react';
import { TypingSimulationConfig } from '@/lib/types';
import { MAX_MESSAGE_PARTS, normalizeTypingSimulation, splitMessageSequence } from '@/lib/message-sequence';

interface MessageSequenceControlsProps {
  message: string;
  value: TypingSimulationConfig;
  onChange: (value: TypingSimulationConfig) => void;
}

export default function MessageSequenceControls({ message, value, onChange }: MessageSequenceControlsProps) {
  const typing = normalizeTypingSimulation(value);
  const parts = splitMessageSequence(message);
  const messageCount = Math.max(1, parts.length);
  const aboveLimit = parts.length > MAX_MESSAGE_PARTS;

  const updateSeconds = (field: 'minDelayMs' | 'maxDelayMs', seconds: number) => {
    const nextValue = Math.max(0.5, Math.min(20, Number(seconds) || 0.5)) * 1_000;
    const next = { ...typing, [field]: nextValue };
    if (field === 'minDelayMs' && next.minDelayMs > next.maxDelayMs) next.maxDelayMs = next.minDelayMs;
    if (field === 'maxDelayMs' && next.maxDelayMs < next.minDelayMs) next.minDelayMs = next.maxDelayMs;
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <div>
            <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Sequência de mensagens</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
              Digite <code className="rounded bg-white px-1 py-0.5 font-mono font-bold text-indigo-700 dark:bg-slate-900 dark:text-indigo-300">/n</code> para criar outro balão no WhatsApp. Enter normal continua sendo uma quebra de linha no mesmo balão.
            </p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${aboveLimit ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'}`}>
          {messageCount} mensagem{messageCount === 1 ? '' : 's'}
        </span>
      </div>

      {aboveLimit && (
        <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400">O limite é de {MAX_MESSAGE_PARTS} mensagens por contato.</p>
      )}

      {parts.length > 1 && (
        <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-950">
          {parts.slice(0, MAX_MESSAGE_PARTS).map((part, index) => (
            <div key={`${index}-${part.slice(0, 20)}`} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[8px] font-black text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{index + 1}</span>
              <p className="line-clamp-2 whitespace-pre-line text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">{part}</p>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-indigo-200/70 pt-3 dark:border-indigo-500/15">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="flex items-start gap-2">
            <Keyboard className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">Simular “digitando...”</span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400">Mostra a presença de digitação antes de cada mensagem da sequência.</span>
            </span>
          </span>
          <input
            type="checkbox"
            checked={typing.enabled}
            onChange={(event) => onChange({ ...typing, enabled: event.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
          />
        </label>

        {typing.enabled && (
          <div className="mt-3 grid grid-cols-2 gap-2 pl-6">
            <label className="space-y-1 text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> Mínimo (seg.)</span>
              <input
                type="number"
                min="0.5"
                max="20"
                step="0.5"
                value={typing.minDelayMs / 1_000}
                onChange={(event) => updateSeconds('minDelayMs', Number(event.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 font-mono text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <label className="space-y-1 text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> Máximo (seg.)</span>
              <input
                type="number"
                min="0.5"
                max="20"
                step="0.5"
                value={typing.maxDelayMs / 1_000}
                onChange={(event) => updateSeconds('maxDelayMs', Number(event.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 font-mono text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
