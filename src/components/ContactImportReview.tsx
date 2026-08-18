'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleOff,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { ContactItem } from '@/lib/types';

type ReviewFilter = 'all' | 'selected' | 'excluded';

interface ContactImportReviewProps {
  contacts: ContactItem[];
  onChange: (contacts: ContactItem[]) => void;
  importSummary?: string;
  onDismissSummary?: () => void;
  onRetryContact?: (contactId: string) => void;
  disabled?: boolean;
  emptyMessage?: string;
  maxHeightClassName?: string;
}

const STATUS_LABEL: Record<ContactItem['status'], string> = {
  pending: 'Pendente',
  sending: 'Enviando',
  sent: 'Enviado',
  error: 'Falha',
};

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function ContactImportReview({
  contacts,
  onChange,
  importSummary,
  onDismissSummary,
  onRetryContact,
  disabled = false,
  emptyMessage = 'Importe um CSV ou adicione um contato para começar.',
  maxHeightClassName = 'max-h-80',
}: ContactImportReviewProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ReviewFilter>('all');

  const selectedCount = contacts.filter((contact) => contact.selectedForSending !== false).length;
  const excludedCount = contacts.length - selectedCount;
  const normalizedQuery = normalizeSearch(search);

  const visibleContacts = useMemo(() => contacts.filter((contact) => {
    const selected = contact.selectedForSending !== false;
    if (filter === 'selected' && !selected) return false;
    if (filter === 'excluded' && selected) return false;
    if (!normalizedQuery) return true;

    const haystack = normalizeSearch(`${contact.name || ''} ${contact.phone}`);
    const queryDigits = normalizedQuery.replace(/\D/g, '');
    return haystack.includes(normalizedQuery) || (queryDigits.length > 0 && contact.phone.replace(/\D/g, '').includes(queryDigits));
  }), [contacts, filter, normalizedQuery]);

  const visibleIds = useMemo(() => new Set(visibleContacts.map((contact) => contact.id)), [visibleContacts]);

  const setVisibleSelection = (selectedForSending: boolean) => {
    if (disabled || visibleIds.size === 0) return;
    onChange(contacts.map((contact) => visibleIds.has(contact.id)
      ? { ...contact, selectedForSending }
      : contact));
  };

  const toggleContact = (contactId: string) => {
    if (disabled) return;
    onChange(contacts.map((contact) => contact.id === contactId
      ? { ...contact, selectedForSending: contact.selectedForSending === false }
      : contact));
  };

  const removeContact = (contactId: string) => {
    if (disabled) return;
    onChange(contacts.filter((contact) => contact.id !== contactId));
  };

  const removeExcluded = () => {
    if (disabled || excludedCount === 0) return;
    if (window.confirm(`Remover definitivamente ${excludedCount} contato${excludedCount === 1 ? '' : 's'} desmarcado${excludedCount === 1 ? '' : 's'}?`)) {
      onChange(contacts.filter((contact) => contact.selectedForSending !== false));
      setFilter('all');
    }
  };

  return (
    <div className="space-y-3">
      {importSummary && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-extrabold">Importação concluída</p>
              <p className="mt-0.5 text-[11px] opacity-90">{importSummary}</p>
            </div>
          </div>
          {onDismissSummary && (
            <button type="button" onClick={onDismissSummary} className="rounded-lg p-1 hover:bg-emerald-500/10" aria-label="Fechar resumo da importação">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"><Users className="h-3.5 w-3.5" /> Importados</div>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{contacts.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"><UserCheck className="h-3.5 w-3.5" /> Enviar</div>
          <p className="mt-1 text-lg font-black text-emerald-700 dark:text-emerald-300">{selectedCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"><CircleOff className="h-3.5 w-3.5" /> Não enviar</div>
          <p className="mt-1 text-lg font-black text-slate-500">{excludedCount}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar por nome ou número..."
          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Limpar pesquisa">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-[10px] font-bold dark:border-slate-800 dark:bg-slate-950">
          {([
            ['all', `Todos (${contacts.length})`],
            ['selected', `Marcados (${selectedCount})`],
            ['excluded', `Desmarcados (${excludedCount})`],
          ] as [ReviewFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-lg px-2.5 py-1.5 transition-colors ${filter === value ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-[10px] font-medium text-slate-500">{visibleContacts.length} resultado{visibleContacts.length === 1 ? '' : 's'}</span>
      </div>

      {contacts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold">
          <button type="button" disabled={disabled || visibleContacts.length === 0} onClick={() => setVisibleSelection(true)} className="text-indigo-600 hover:underline disabled:opacity-40 dark:text-indigo-400">Marcar resultados</button>
          <button type="button" disabled={disabled || visibleContacts.length === 0} onClick={() => setVisibleSelection(false)} className="text-slate-500 hover:underline disabled:opacity-40">Desmarcar resultados</button>
          {excludedCount > 0 && (
            <button type="button" disabled={disabled} onClick={removeExcluded} className="text-rose-600 hover:underline disabled:opacity-40 dark:text-rose-400">Excluir desmarcados</button>
          )}
        </div>
      )}

      <div className={`${maxHeightClassName} space-y-1.5 overflow-y-auto pr-1`}>
        {contacts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-xs font-medium text-slate-400 dark:border-slate-800">
            {emptyMessage}
          </div>
        ) : visibleContacts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-8 text-center text-xs font-medium text-slate-400 dark:border-slate-800">
            Nenhum contato encontrado com os filtros atuais.
          </div>
        ) : visibleContacts.map((contact) => {
          const selected = contact.selectedForSending !== false;
          return (
            <div key={contact.id} className={`flex items-center gap-2.5 rounded-xl border p-2.5 transition-colors ${selected ? 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/20 dark:bg-indigo-500/5' : 'border-slate-200 bg-white opacity-60 dark:border-slate-800 dark:bg-slate-900'}`}>
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => toggleContact(contact.id)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                aria-label={`${selected ? 'Não enviar para' : 'Enviar para'} ${contact.name || contact.phone}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-200">{contact.name || 'Sem nome'}</p>
                <p className="truncate font-mono text-[10px] text-slate-500">{contact.phone}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${contact.status === 'sent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : contact.status === 'error' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : contact.status === 'sending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                {STATUS_LABEL[contact.status]}
              </span>
              {onRetryContact && (contact.status === 'error' || contact.status === 'sent') && (
                <button type="button" disabled={disabled} onClick={() => onRetryContact(contact.id)} className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-100 disabled:opacity-40 dark:text-amber-400 dark:hover:bg-amber-500/10" title="Marcar para reenviar">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button type="button" disabled={disabled} onClick={() => removeContact(contact.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 disabled:opacity-40 dark:hover:bg-rose-500/10" title="Remover contato">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
