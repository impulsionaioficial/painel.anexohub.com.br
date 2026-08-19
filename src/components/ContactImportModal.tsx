'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  FileSpreadsheet,
  FileText,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { ContactItem } from '@/lib/types';
import { contactPhoneKey, describeContactImport, mergeImportedContacts } from '@/lib/contact-import';
import { formatPhoneNumber } from '@/lib/evolution-store';

interface ContactImportModalProps {
  open: boolean;
  currentContacts: ContactItem[];
  onClose: () => void;
  onImport: (contacts: ContactItem[], summary: string) => void;
}

interface RawImportRow {
  id: string;
  line: number;
  name: string;
  phoneInput: string;
  selected: boolean;
}

type RowState = 'valid' | 'invalid' | 'duplicate' | 'limit';

interface EvaluatedImportRow extends RawImportRow {
  formattedPhone: string;
  state: RowState;
  reason: string;
}

const PHONE_HEADERS = ['telefone', 'phone', 'celular', 'numero', 'número', 'num', 'whatsapp'];
const NAME_HEADERS = ['nome', 'name', 'cliente', 'contato'];

function normalizeHeader(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function looksLikeHeader(cells: string[]): boolean {
  return cells.some((cell) => [...PHONE_HEADERS, ...NAME_HEADERS].map(normalizeHeader).includes(normalizeHeader(cell)));
}

function findPhoneInText(value: string): { phone: string; name: string } {
  const match = value.match(/(?:\+?\d[\d\s().-]{6,}\d)/);
  if (!match) return { phone: value.trim(), name: '' };
  return {
    phone: match[0].trim(),
    name: value.replace(match[0], ' ').replace(/^[\s,;|\t-]+|[\s,;|\t-]+$/g, '').trim(),
  };
}

function parseRows(text: string): RawImportRow[] {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    skipEmptyLines: 'greedy',
  });
  const data = parsed.data.map((row) => row.map((cell) => String(cell ?? '').trim()));
  if (data.length === 0) return [];

  const header = data[0] || [];
  const hasHeader = looksLikeHeader(header);
  const normalizedHeaders = header.map(normalizeHeader);
  const phoneHeaderIndex = normalizedHeaders.findIndex((cell) => PHONE_HEADERS.map(normalizeHeader).includes(cell));
  const nameHeaderIndex = normalizedHeaders.findIndex((cell) => NAME_HEADERS.map(normalizeHeader).includes(cell));
  const rows = hasHeader ? data.slice(1) : data;

  return rows.map((cells, index) => {
    let phoneInput = phoneHeaderIndex >= 0 ? cells[phoneHeaderIndex] || '' : '';
    let name = nameHeaderIndex >= 0 ? cells[nameHeaderIndex] || '' : '';

    if (phoneHeaderIndex < 0) {
      const likelyPhoneIndex = cells.findIndex((cell) => contactPhoneKey(cell).length >= 8);
      if (likelyPhoneIndex >= 0) {
        phoneInput = cells[likelyPhoneIndex];
        name = name || cells.find((_, cellIndex) => cellIndex !== likelyPhoneIndex) || '';
      } else if (cells.length === 1) {
        const extracted = findPhoneInText(cells[0]);
        phoneInput = extracted.phone;
        name = extracted.name;
      } else {
        phoneInput = cells[0] || '';
        name = name || cells[1] || '';
      }
    }

    return {
      id: `import_${Date.now()}_${index}`,
      line: index + (hasHeader ? 2 : 1),
      name: name.trim(),
      phoneInput: phoneInput.trim(),
      selected: true,
    };
  });
}

function rowColor(state: RowState): string {
  if (state === 'valid') return 'bg-emerald-50/80 dark:bg-emerald-500/10';
  if (state === 'duplicate') return 'bg-amber-50/80 dark:bg-amber-500/10';
  return 'bg-rose-50/80 dark:bg-rose-500/10';
}

export default function ContactImportModal({ open, currentContacts, onClose, onImport }: ContactImportModalProps) {
  const [rows, setRows] = useState<RawImportRow[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeModal = useCallback(() => {
    setRows([]);
    setPasteText('');
    setSourceName('');
    setSearch('');
    setError('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeModal, open]);

  const evaluatedRows = useMemo<EvaluatedImportRow[]>(() => {
    const known = new Set(currentContacts.map((contact) => contactPhoneKey(contact.phone)).filter(Boolean));
    const initialKnownCount = known.size;
    const availableSlots = Math.max(0, 1_000 - currentContacts.length);

    return rows.map((row) => {
      const rawDigits = contactPhoneKey(row.phoneInput);
      const formattedPhone = formatPhoneNumber(row.phoneInput);
      const key = contactPhoneKey(formattedPhone);
      const containsInvalidCharacters = /[^\d\s()+.\-/]/.test(row.phoneInput);
      let state: RowState = 'valid';
      let reason = 'Pronto para importar';

      if (!row.phoneInput || rawDigits.length < 8 || key.length > 15 || containsInvalidCharacters) {
        state = 'invalid';
        reason = !row.phoneInput ? 'Número não informado' : 'Número inválido (use de 8 a 15 dígitos)';
      } else if (known.has(key)) {
        state = 'duplicate';
        reason = 'Número duplicado ou já presente na lista';
      } else if (known.size - initialKnownCount >= availableSlots) {
        state = 'limit';
        reason = 'Acima do limite de 1.000 contatos';
      } else {
        known.add(key);
      }

      return { ...row, formattedPhone, state, reason };
    });
  }, [currentContacts, rows]);

  const query = search.trim().toLowerCase();
  const visibleRows = evaluatedRows.filter((row) => !query
    || row.name.toLowerCase().includes(query)
    || row.phoneInput.toLowerCase().includes(query)
    || row.formattedPhone.includes(query.replace(/\D/g, '')));
  const validCount = evaluatedRows.filter((row) => row.state === 'valid').length;
  const invalidCount = evaluatedRows.filter((row) => row.state === 'invalid' || row.state === 'limit').length;
  const duplicateCount = evaluatedRows.filter((row) => row.state === 'duplicate').length;
  const selectedValidCount = evaluatedRows.filter((row) => row.state === 'valid' && row.selected).length;

  const loadText = (text: string, label: string) => {
    const parsedRows = parseRows(text);
    setRows(parsedRows);
    setSourceName(label);
    setError(parsedRows.length ? '' : 'Nenhuma linha foi encontrada. Confira o conteúdo e tente novamente.');
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError('Formato não aceito. Envie um arquivo CSV ou TXT.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('O arquivo é maior que 5 MB. Divida a lista antes de importar.');
      return;
    }
    try {
      loadText(await file.text(), file.name);
    } catch {
      setError('Não foi possível ler esse arquivo.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateRow = (id: string, changes: Partial<RawImportRow>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...changes } : row));
  };

  const setAllVisible = (selected: boolean) => {
    const ids = new Set(visibleRows.filter((row) => row.state === 'valid').map((row) => row.id));
    setRows((current) => current.map((row) => ids.has(row.id) ? { ...row, selected } : row));
  };

  const confirmImport = () => {
    const imported: ContactItem[] = evaluatedRows
      .filter((row) => row.state === 'valid' && row.selected)
      .map((row) => ({
        id: `imported_${row.line}_${Date.now()}_${row.id}`,
        name: row.name || 'Sem nome',
        phone: row.formattedPhone,
        status: 'pending',
        selectedForSending: true,
      }));
    const result = mergeImportedContacts(currentContacts, imported);
    onImport(result.contacts, `${sourceName || 'Texto colado'} • ${describeContactImport(result)} • ${invalidCount} inválido${invalidCount === 1 ? '' : 's'} na origem${duplicateCount ? ` • ${duplicateCount} duplicado${duplicateCount === 1 ? '' : 's'}` : ''}`);
    closeModal();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="contact-import-title">
      <div className="flex h-[min(92vh,900px)] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-indigo-100 p-2.5 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"><FileSpreadsheet className="h-5 w-5" /></div>
            <div>
              <h2 id="contact-import-title" className="text-base font-black text-slate-900 dark:text-white">Importar e revisar contatos</h2>
              <p className="mt-0.5 text-xs text-slate-500">Confira a planilha, corrija números inválidos e escolha exatamente quem será adicionado.</p>
            </div>
          </div>
          <button type="button" onClick={closeModal} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Fechar importação"><X className="h-5 w-5" /></button>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-b border-slate-200 p-5 dark:border-slate-800 lg:border-b-0 lg:border-r">
            <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-xs font-bold dark:bg-slate-950">
              <button type="button" onClick={() => setMode('file')} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 ${mode === 'file' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-300' : 'text-slate-500'}`}><Upload className="h-3.5 w-3.5" /> Arquivo</button>
              <button type="button" onClick={() => setMode('paste')} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 ${mode === 'paste' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-300' : 'text-slate-500'}`}><ClipboardPaste className="h-3.5 w-3.5" /> Colar</button>
            </div>

            {mode === 'file' ? (
              <div className="mt-4">
                <input ref={fileInputRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" id="contact-import-file" onChange={(event) => handleFile(event.target.files?.[0])} />
                <label htmlFor="contact-import-file" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files?.[0]); }} className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 px-4 py-8 text-center transition-colors hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-slate-700 dark:hover:bg-indigo-500/5">
                  <Upload className="h-7 w-7 text-indigo-500" />
                  <span className="mt-2 text-xs font-extrabold text-slate-800 dark:text-slate-200">Escolher CSV ou TXT</span>
                  <span className="mt-1 text-[10px] text-slate-500">ou arraste o arquivo até aqui</span>
                </label>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} rows={10} placeholder={'Cole um contato por linha:\nJoão; 5511999999999\nMaria; 5511888888888'} className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200" />
                <button type="button" onClick={() => loadText(pasteText, 'Texto colado')} disabled={!pasteText.trim()} className="w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">Visualizar texto</button>
              </div>
            )}

            <div className="mt-5 space-y-2 text-[11px] text-slate-500">
              <p className="font-bold text-slate-700 dark:text-slate-300">Formatos aceitos</p>
              <p>• CSV com colunas nome e telefone</p>
              <p>• TXT separado por vírgula, ponto e vírgula ou tabulação</p>
              <p>• Um número por linha também funciona</p>
            </div>
            {error && <div className="mt-4 flex gap-2 rounded-xl bg-rose-50 p-3 text-[11px] font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
          </aside>

          <main className="flex min-h-0 flex-col p-4 sm:p-5">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10"><p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Válidos</p><p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{validCount}</p></div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/20 dark:bg-rose-500/10"><p className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-300">Inválidos</p><p className="text-xl font-black text-rose-700 dark:text-rose-300">{invalidCount}</p></div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10"><p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">Duplicados</p><p className="text-xl font-black text-amber-700 dark:text-amber-300">{duplicateCount}</p></div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar nome ou número..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950" /></div>
              <button type="button" onClick={() => setAllVisible(true)} className="rounded-lg px-2 py-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10">Marcar válidos</button>
              <button type="button" onClick={() => setAllVisible(false)} className="rounded-lg px-2 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Desmarcar válidos</button>
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              {rows.length === 0 ? (
                <div className="flex h-full min-h-72 flex-col items-center justify-center p-8 text-center"><FileText className="h-10 w-10 text-slate-300 dark:text-slate-700" /><p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">A planilha aparecerá aqui</p><p className="mt-1 text-xs text-slate-400">Envie um CSV/TXT ou cole sua lista ao lado.</p></div>
              ) : (
                <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                    <tr><th className="w-12 px-3 py-3">Enviar</th><th className="w-14 px-3 py-3">Linha</th><th className="px-3 py-3">Nome</th><th className="px-3 py-3">Número original</th><th className="px-3 py-3">Número formatado</th><th className="w-52 px-3 py-3">Validação</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {visibleRows.map((row) => (
                      <tr key={row.id} className={rowColor(row.state)}>
                        <td className="px-3 py-2"><input type="checkbox" checked={row.state === 'valid' && row.selected} disabled={row.state !== 'valid'} onChange={(event) => updateRow(row.id, { selected: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-indigo-600" /></td>
                        <td className="px-3 py-2 font-mono text-slate-500">{row.line}</td>
                        <td className="px-3 py-2"><input value={row.name} onChange={(event) => updateRow(row.id, { name: event.target.value })} placeholder="Sem nome" className="w-full min-w-32 rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-medium outline-none hover:border-slate-300 focus:border-indigo-500 dark:hover:border-slate-600" /></td>
                        <td className="px-3 py-2"><input value={row.phoneInput} onChange={(event) => updateRow(row.id, { phoneInput: event.target.value, selected: true })} className="w-full min-w-40 rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-mono outline-none hover:border-slate-300 focus:border-indigo-500 dark:hover:border-slate-600" /></td>
                        <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">{row.formattedPhone || '—'}</td>
                        <td className="px-3 py-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold ${row.state === 'valid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : row.state === 'duplicate' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'}`}>{row.state === 'valid' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}{row.reason}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </main>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-7">
          <p className="text-xs text-slate-500"><strong className="text-slate-800 dark:text-slate-200">{selectedValidCount}</strong> contato{selectedValidCount === 1 ? '' : 's'} válido{selectedValidCount === 1 ? '' : 's'} selecionado{selectedValidCount === 1 ? '' : 's'}</p>
          <div className="flex gap-2"><button type="button" onClick={closeModal} className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">Cancelar</button><button type="button" onClick={confirmImport} disabled={selectedValidCount === 0} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">Adicionar {selectedValidCount} à lista</button></div>
        </footer>
      </div>
    </div>
  );
}
