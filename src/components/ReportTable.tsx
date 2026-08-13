'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Download,
  RefreshCw,
  Search,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  AlertCircle,
  FileText,
  Filter,
  Calendar,
  Layers,
  Phone,
  Copy,
  Check,
  Eye,
  X,
  FileSpreadsheet,
  RotateCcw,
  CheckSquare,
  Square,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { DetailedReportItem, ErrorCategoryType } from '@/lib/types';
import {
  getStoredReports,
  saveStoredReports,
  addStoredReportItem,
  addStoredReportItems,
  deleteStoredReportItem,
  deleteStoredReportItems,
  clearStoredReports,
} from '@/lib/schedule-store';
import { getStoredConfig, formatPhoneNumber } from '@/lib/evolution-store';

type PeriodFilterType = 'all' | 'today' | 'yesterday' | 'last7' | 'last30' | 'this_month' | 'custom';

// Helper to parse dates in PT-BR ("DD/MM/YYYY, HH:mm:ss" or "DD/MM/YYYY HH:mm:ss") or ISO
function parseReportDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  // Try ISO or standard constructor first if contains dash
  if (trimmed.includes('-')) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  // Match Brazilian format: DD/MM/YYYY [optional time]
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const hour = match[4] ? parseInt(match[4], 10) : 0;
    const min = match[5] ? parseInt(match[5], 10) : 0;
    const sec = match[6] ? parseInt(match[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d;
  }

  const dFallback = new Date(trimmed);
  return isNaN(dFallback.getTime()) ? null : dFallback;
}

export default function ReportTable() {
  const [reports, setReports] = useState<DetailedReportItem[]>([]);
  const [instancesList, setInstancesList] = useState<string[]>([]);
  const [loadingSync, setLoadingSync] = useState<boolean>(false);

  // Filters State
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error' | 'pending'>('all');
  const [selectedFilterInstances, setSelectedFilterInstances] = useState<string[]>([]);
  const [instanceDropdownOpen, setInstanceDropdownOpen] = useState<boolean>(false);
  const [instanceSearch, setInstanceSearch] = useState<string>('');
  const instanceDropdownRef = useRef<HTMLDivElement>(null);

  const [filterPeriod, setFilterPeriod] = useState<PeriodFilterType>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (instanceDropdownRef.current && !instanceDropdownRef.current.contains(event.target as Node)) {
        setInstanceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Selected Row Checkboxes
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Action States
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [bulkResending, setBulkResending] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [selectedReportModal, setSelectedReportModal] = useState<DetailedReportItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load and deduplicate reports from localStorage and server
  const loadReports = async () => {
    setLoadingSync(true);
    try {
      const local = getStoredReports();

      // Fetch server background campaign reports if any
      try {
        const res = await fetch('/api/evolution/campaign/reports');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.reports) && data.reports.length > 0) {
            addStoredReportItems(data.reports);
          }
        }
      } catch {}

      // Fetch instances list from VPS to populate instance dropdown
      try {
        const config = getStoredConfig();
        if (config.baseUrl && config.apiKey) {
          const instRes = await fetch('/api/evolution/instances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ baseUrl: config.baseUrl, apiKey: config.apiKey }),
          });
          if (instRes.ok) {
            const instData = await instRes.json();
            if (instData.success && Array.isArray(instData.instances)) {
              setInstancesList(instData.instances.map((i: any) => i.name));
            }
          }
        }
      } catch {}

      const updated = getStoredReports();
      setReports(updated);
    } finally {
      setLoadingSync(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  // Collect all unique instances across existing reports + fetched VPS instances
  const allAvailableInstances = useMemo(() => {
    const set = new Set<string>(instancesList);
    reports.forEach((r) => {
      if (r.instanceName) set.add(r.instanceName);
    });
    return Array.from(set).filter(Boolean);
  }, [reports, instancesList]);

  // Handle single message resend
  const handleResend = async (item: DetailedReportItem) => {
    setResendingId(item.id);
    const config = getStoredConfig();
    const targetInstance = item.instanceName || config.instanceName;

    try {
      const res = await fetch('/api/evolution/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          instanceName: targetInstance,
          phone: item.phone,
          message: item.messageSent,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`✅ Mensagem reenviada com sucesso para ${item.phone}!`);
        // Update item in local report store
        const updatedItem: DetailedReportItem = {
          ...item,
          status: 'success',
          errorMessage: undefined,
          errorCategory: undefined,
          sentAt: new Date().toLocaleString('pt-BR'),
        };
        addStoredReportItem(updatedItem);
        setReports(getStoredReports());
      } else {
        showToast(`❌ Falha ao reenviar: ${data.error || 'Erro desconhecido'}`);
      }
    } catch (err: any) {
      showToast(`⚠️ Falha no reenvio: ${err.message}`);
    } finally {
      setResendingId(null);
    }
  };

  // Handle bulk resend for filtered error items or selected items
  const handleBulkResendErrors = async (itemsToResend: DetailedReportItem[]) => {
    if (itemsToResend.length === 0) {
      showToast('⚠️ Nenhum disparo selecionado para reenvio.');
      return;
    }

    if (!confirm(`Deseja reenviar ${itemsToResend.length} mensagem(ns) agora?`)) return;

    setBulkResending(true);
    setBulkProgress({ current: 0, total: itemsToResend.length });
    const config = getStoredConfig();

    let successCount = 0;
    for (let i = 0; i < itemsToResend.length; i++) {
      const item = itemsToResend[i];
      setBulkProgress({ current: i + 1, total: itemsToResend.length });

      try {
        const res = await fetch('/api/evolution/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...config,
            instanceName: item.instanceName || config.instanceName,
            phone: item.phone,
            message: item.messageSent,
          }),
        });

        const data = await res.json();
        if (data.success) {
          successCount++;
          const updatedItem: DetailedReportItem = {
            ...item,
            status: 'success',
            errorMessage: undefined,
            errorCategory: undefined,
            sentAt: new Date().toLocaleString('pt-BR'),
          };
          addStoredReportItem(updatedItem);
        }
      } catch {}

      // Short delay between resends
      await new Promise((r) => setTimeout(r, 600));
    }

    setReports(getStoredReports());
    setBulkResending(false);
    setBulkProgress(null);
    showToast(`🎉 Reenvio finalizado! ${successCount} de ${itemsToResend.length} mensagens enviadas com sucesso.`);
  };

  // Delete single report item
  const handleDeleteItem = (id: string) => {
    deleteStoredReportItem(id);
    setReports(getStoredReports());
    setSelectedIds((prev) => prev.filter((i) => i !== id));
    showToast('🗑️ Registro removido do histórico.');
  };

  // Delete selected report items
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Deseja excluir os ${selectedIds.length} registros selecionados?`)) {
      deleteStoredReportItems(selectedIds);
      setReports(getStoredReports());
      setSelectedIds([]);
      showToast('🗑️ Registros selecionados excluídos com sucesso.');
    }
  };

  // Clear all history
  const handleClearAll = () => {
    if (confirm('Deseja limpar todo o histórico de relatórios detalhados? Esta ação não pode ser desfeita.')) {
      clearStoredReports();
      setReports([]);
      setSelectedIds([]);
      showToast('🧹 Histórico limpo com sucesso.');
    }
  };

  // Remove duplicates and optimize storage
  const handleDeduplicate = () => {
    const current = getStoredReports();
    saveStoredReports(current);
    setReports(current);
    showToast(`✨ Histórico otimizado! ${current.length} registros únicos mantidos.`);
  };

  // Copy text to clipboard
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('📋 Copiado para a área de transferência!');
  };

  // Calculate dispatch count per instance for dropdown badges
  const instanceCounts = useMemo(() => {
    const map: Record<string, number> = {};
    reports.forEach((r) => {
      const inst = r.instanceName || 'Padrão';
      map[inst] = (map[inst] || 0) + 1;
    });
    return map;
  }, [reports]);

  // Toggle single instance filter
  const toggleInstanceFilter = (instName: string) => {
    setSelectedFilterInstances((prev) =>
      prev.includes(instName) ? prev.filter((i) => i !== instName) : [...prev, instName]
    );
  };

  // Select / Deselect All instances filter
  const handleSelectAllInstances = () => {
    if (selectedFilterInstances.length === allAvailableInstances.length) {
      setSelectedFilterInstances([]);
    } else {
      setSelectedFilterInstances([...allAvailableInstances]);
    }
  };

  // Filter Reports based on ALL criteria
  const filteredReports = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const last7Start = new Date(todayStart);
    last7Start.setDate(last7Start.getDate() - 7);

    const last30Start = new Date(todayStart);
    last30Start.setDate(last30Start.getDate() - 30);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    let customStart: Date | null = null;
    let customEnd: Date | null = null;
    if (startDate) {
      const [y, m, d] = startDate.split('-').map(Number);
      customStart = new Date(y, m - 1, d, 0, 0, 0);
    }
    if (endDate) {
      const [y, m, d] = endDate.split('-').map(Number);
      customEnd = new Date(y, m - 1, d, 23, 59, 59);
    }

    return reports.filter((item) => {
      // 1. Status Filter
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;

      // 2. Multi-Instance Filter (if selected instances > 0, match any of selected)
      if (selectedFilterInstances.length > 0) {
        const itemInst = item.instanceName || 'Padrão';
        if (!selectedFilterInstances.includes(itemInst)) return false;
      }

      // 3. Category Filter
      if (filterCategory !== 'all') {
        if (filterCategory === 'UNKNOWN' && item.errorCategory && item.errorCategory !== 'UNKNOWN') return false;
        if (filterCategory !== 'UNKNOWN' && item.errorCategory !== filterCategory) return false;
      }

      // 4. Period Filter
      if (filterPeriod !== 'all') {
        const itemDate = parseReportDate(item.sentAt);
        if (!itemDate) return true; // Keep if date cannot be parsed

        if (filterPeriod === 'today' && (itemDate < todayStart || itemDate > todayEnd)) return false;
        if (filterPeriod === 'yesterday' && (itemDate < yesterdayStart || itemDate > yesterdayEnd)) return false;
        if (filterPeriod === 'last7' && itemDate < last7Start) return false;
        if (filterPeriod === 'last30' && itemDate < last30Start) return false;
        if (filterPeriod === 'this_month' && itemDate < monthStart) return false;
        if (filterPeriod === 'custom') {
          if (customStart && itemDate < customStart) return false;
          if (customEnd && itemDate > customEnd) return false;
        }
      }

      // 5. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.contactName?.toLowerCase().includes(q);
        const matchesPhone = item.phone?.replace(/\D/g, '').includes(q.replace(/\D/g, '')) || item.phone?.includes(q);
        const matchesMessage = item.messageSent?.toLowerCase().includes(q);
        const matchesError = item.errorMessage?.toLowerCase().includes(q);
        const matchesInstance = item.instanceName?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesMessage && !matchesError && !matchesInstance) return false;
      }

      return true;
    });
  }, [reports, filterStatus, selectedFilterInstances, filterPeriod, filterCategory, searchQuery, startDate, endDate]);

  // Toggle selection for all filtered rows
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredReports.length && filteredReports.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredReports.map((r) => r.id));
    }
  };

  // Toggle selection for single row
  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // ==========================================
  // PERFECT CSV EXPORT (Excel BR Format)
  // - Delimiter: ';' (semicolon for Excel BR)
  // - Encoding: UTF-8 with BOM (\uFEFF)
  // - Escaped double quotes
  // - Preserves accents, emojis and prevents split multiline row breakage
  // ==========================================
  const exportCSV = () => {
    const dataToExport = filteredReports.length > 0 ? filteredReports : reports;
    if (dataToExport.length === 0) {
      showToast('⚠️ Não há dados para exportar.');
      return;
    }

    const headers = [
      'Data e Hora',
      'Instância',
      'Contato / Nome',
      'Telefone WhatsApp',
      'Mensagem Enviada',
      'Status',
      'Categoria do Erro',
      'Detalhes do Erro',
    ];

    const rows = dataToExport.map((r) => {
      const sentAt = r.sentAt || '';
      const instance = r.instanceName || 'Padrão';
      const contact = r.contactName || 'Contato';
      const phone = formatPhoneNumber(r.phone);
      // Clean up newlines to prevent messy row breaking in basic CSV readers while keeping text readable
      const cleanMessage = (r.messageSent || '').replace(/\r\n|\r|\n/g, '  |  ').replace(/"/g, '""');
      const status = r.status === 'success' ? 'Enviado (Sucesso)' : r.status === 'error' ? 'Falha / Erro' : 'Pendente';
      const category = r.errorCategory || (r.status === 'error' ? 'Erro da API' : '');
      const errorMsg = (r.errorMessage || '').replace(/\r\n|\r|\n/g, ' ').replace(/"/g, '""');

      return [
        `"${sentAt}"`,
        `"${instance}"`,
        `"${contact.replace(/"/g, '""')}"`,
        `"'+${phone.replace(/\D/g, '')}"`, // Formatted as string with leading quote to preserve phone digits
        `"${cleanMessage}"`,
        `"${status}"`,
        `"${category}"`,
        `"${errorMsg}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_disparos_excel_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`✅ ${dataToExport.length} disparos exportados com sucesso em formato Excel CSV!`);
  };

  // ==========================================
  // EXPORT NATIVE EXCEL (.xls HTML TABLE)
  // ==========================================
  const exportExcel = () => {
    const dataToExport = filteredReports.length > 0 ? filteredReports : reports;
    if (dataToExport.length === 0) {
      showToast('⚠️ Não há dados para exportar.');
      return;
    }

    const tableRows = dataToExport
      .map((r) => {
        const statusBadge =
          r.status === 'success'
            ? '<span style="color: #059669; font-weight: bold;">Enviado</span>'
            : '<span style="color: #e11d48; font-weight: bold;">Falha</span>';

        return `<tr>
          <td style="padding: 8px; border: 1px solid #e2e8f0;">${r.sentAt || ''}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">${r.instanceName || 'Padrão'}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0;">${r.contactName || 'Contato'}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; mso-number-format:'\\@'; font-family: monospace;">+${r.phone.replace(/\D/g, '')}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap;">${(r.messageSent || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0;">${statusBadge}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0;">${r.errorCategory || ''}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; color: #dc2626;">${(r.errorMessage || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        </tr>`;
      })
      .join('');

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="content-type" content="text/html; charset=UTF-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Relatório de Disparos</x:Name>
                  <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
        </head>
        <body style="font-family: Arial, sans-serif;">
          <h2 style="color: #4f46e5;">Relatório Detalhado de Disparos WhatsApp - AllWhatsPy</h2>
          <p style="color: #64748b; font-size: 12px;">Gerado em: ${new Date().toLocaleString('pt-BR')} | Total: ${dataToExport.length} registros</p>
          <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
            <thead>
              <tr style="background-color: #4f46e5; color: #ffffff; text-align: left; font-weight: bold;">
                <th style="padding: 10px; border: 1px solid #3730a3;">Data/Hora</th>
                <th style="padding: 10px; border: 1px solid #3730a3;">Instância</th>
                <th style="padding: 10px; border: 1px solid #3730a3;">Contato</th>
                <th style="padding: 10px; border: 1px solid #3730a3;">Telefone</th>
                <th style="padding: 10px; border: 1px solid #3730a3;">Mensagem</th>
                <th style="padding: 10px; border: 1px solid #3730a3;">Status</th>
                <th style="padding: 10px; border: 1px solid #3730a3;">Categoria Erro</th>
                <th style="padding: 10px; border: 1px solid #3730a3;">Detalhes do Erro</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_disparos_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`✅ ${dataToExport.length} disparos exportados em planilha Excel!`);
  };

  // Metrics for Top Cards
  const totalCount = reports.length;
  const filteredCount = filteredReports.length;
  const successCount = filteredReports.filter((r) => r.status === 'success').length;
  const errorCount = filteredReports.filter((r) => r.status === 'error').length;
  const successRate = filteredCount > 0 ? Math.round((successCount / filteredCount) * 100) : 0;
  const errorRate = filteredCount > 0 ? Math.round((errorCount / filteredCount) * 100) : 0;

  const filteredErrorsList = filteredReports.filter((r) => r.status === 'error');

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-slate-900 text-white font-bold text-xs shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-bounce">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Card */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Total no Filtro</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {filteredCount} <span className="text-xs font-normal text-slate-400">/ {totalCount} total</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        {/* Success Card */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Disparos de Sucesso</p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {successCount} <span className="text-xs font-bold text-emerald-500">({successRate}%)</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        {/* Error Card */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Falhas de Envio</p>
            <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
              {errorCount} <span className="text-xs font-bold text-rose-500">({errorRate}%)</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
            <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>
        </div>

        {/* Instances Involved Card */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-sm transition-colors">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Instâncias Ativas</p>
            <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
              {allAvailableInstances.length} <span className="text-xs font-normal text-slate-400">conectadas</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
            <Layers className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </div>

      {/* Bulk Resending Progress Banner */}
      {bulkResending && bulkProgress && (
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 space-y-2 shadow-sm">
          <div className="flex justify-between items-center text-xs font-bold text-indigo-900 dark:text-indigo-200">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> Reenviando mensagens com falha... ({bulkProgress.current} de {bulkProgress.total})
            </span>
            <span>{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
              style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Comprehensive Filter Panel */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">
              Filtros Avançados de Disparos
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
              {filteredCount} encontrados
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadReports}
              disabled={loadingSync}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              title="Sincronizar com a VPS e servidor"
            >
              <RefreshCw className={`w-3 h-3 ${loadingSync ? 'animate-spin text-indigo-500' : ''}`} /> Sincronizar
            </button>

            <button
              onClick={handleDeduplicate}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-500/20 shadow-sm"
              title="Garante que não há nenhum registro duplicado no histórico"
            >
              <RotateCcw className="w-3 h-3" /> Otimizar & Limpar Duplicatas
            </button>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Search Box */}
          <div className="space-y-1">
            <label className="text-slate-500 dark:text-slate-400 font-bold text-[11px]">Busca Textual:</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Contato, número ou mensagem..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
              />
            </div>
          </div>

          {/* Multi-Select Instance Filter */}
          <div className="space-y-1 relative" ref={instanceDropdownRef}>
            <label className="text-slate-500 dark:text-slate-400 font-bold text-[11px] flex items-center justify-between">
              <span>Filtrar por Instância:</span>
              {selectedFilterInstances.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedFilterInstances([])}
                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                >
                  Limpar ({selectedFilterInstances.length})
                </button>
              )}
            </label>

            <button
              type="button"
              onClick={() => setInstanceDropdownOpen((prev) => !prev)}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs font-bold focus:outline-none focus:border-indigo-500 shadow-sm flex items-center justify-between gap-1.5"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate">
                  {selectedFilterInstances.length === 0
                    ? `Todas as Instâncias (${allAvailableInstances.length})`
                    : selectedFilterInstances.length === 1
                    ? `📱 ${selectedFilterInstances[0]}`
                    : `${selectedFilterInstances.length} Instâncias Selecionadas`}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${
                  instanceDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {instanceDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2.5 space-y-1.5 min-w-[250px] max-h-72 overflow-y-auto animate-in fade-in">
                {/* Search input if > 4 instances */}
                {allAvailableInstances.length > 4 && (
                  <div className="relative pb-1">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Buscar instância..."
                      value={instanceSearch}
                      onChange={(e) => setInstanceSearch(e.target.value)}
                      className="w-full pl-7 pr-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-[11px] focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {/* Select / Deselect All Action */}
                <button
                  type="button"
                  onClick={handleSelectAllInstances}
                  className="w-full p-2 rounded-xl text-left text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors flex items-center justify-between"
                >
                  <span>
                    {selectedFilterInstances.length === allAvailableInstances.length
                      ? '✕ Desmarcar Todas'
                      : '✓ Selecionar Todas as Instâncias'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">({allAvailableInstances.length})</span>
                </button>

                <div className="border-t border-slate-100 dark:border-slate-800/80 my-1" />

                {/* Instance List */}
                <div className="space-y-0.5 max-h-48 overflow-y-auto pr-0.5">
                  {allAvailableInstances
                    .filter((inst) => inst.toLowerCase().includes(instanceSearch.toLowerCase()))
                    .map((inst) => {
                      const isChecked = selectedFilterInstances.includes(inst);
                      const count = instanceCounts[inst] || 0;
                      return (
                        <label
                          key={inst}
                          className={`cursor-pointer p-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 select-none ${
                            isChecked
                              ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-900 dark:text-indigo-300'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleInstanceFilter(inst)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                            />
                            <span className="truncate font-mono">📱 {inst}</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold shrink-0">
                            {count}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-slate-500 dark:text-slate-400 font-bold text-[11px]">Status do Disparo:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs font-bold focus:outline-none focus:border-indigo-500 shadow-sm"
            >
              <option value="all">Todos os Status ({reports.length})</option>
              <option value="success">✅ Enviados com Sucesso</option>
              <option value="error">❌ Falhas / Erros</option>
              <option value="pending">⏳ Pendentes</option>
            </select>
          </div>

          {/* Period Filter */}
          <div className="space-y-1">
            <label className="text-slate-500 dark:text-slate-400 font-bold text-[11px]">Período de Disparo:</label>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value as PeriodFilterType)}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs font-bold focus:outline-none focus:border-indigo-500 shadow-sm"
            >
              <option value="all">Todos os Períodos (Histórico Completo)</option>
              <option value="today">📅 Hoje</option>
              <option value="yesterday">📅 Ontem</option>
              <option value="last7">📅 Últimos 7 dias</option>
              <option value="last30">📅 Últimos 30 dias</option>
              <option value="this_month">📅 Este Mês</option>
              <option value="custom">🔍 Personalizado (Datas)</option>
            </select>
          </div>
        </div>

        {/* Selected Instance Chips/Pills (if any) */}
        {selectedFilterInstances.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-bold">Instâncias Filtradas:</span>
            {selectedFilterInstances.map((inst) => (
              <span
                key={inst}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30"
              >
                <span>📱 {inst}</span>
                <button
                  type="button"
                  onClick={() => toggleInstanceFilter(inst)}
                  className="hover:text-rose-500 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setSelectedFilterInstances([])}
              className="text-[10px] text-rose-500 hover:underline font-bold ml-1"
            >
              Limpar todas
            </button>
          </div>
        )}

        {/* Custom Date Range Row (if selected) */}
        {filterPeriod === 'custom' && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold">De:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs font-bold shadow-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold">Até:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs font-bold shadow-sm"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
              >
                Limpar datas
              </button>
            )}
          </div>
        )}

        {/* Category Filter (when filtering errors or in general) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px]">Diagnóstico de Erro:</span>
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                filterCategory === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterCategory('NUMBER_NOT_EXISTS')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                filterCategory === 'NUMBER_NOT_EXISTS'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
              }`}
            >
              🚫 Sem WhatsApp
            </button>
            <button
              onClick={() => setFilterCategory('SENDER_BLOCKED')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                filterCategory === 'SENDER_BLOCKED'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20'
              }`}
            >
              🔒 Desconectado
            </button>
            <button
              onClick={() => setFilterCategory('USER_BLOCKED')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                filterCategory === 'USER_BLOCKED'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/20'
              }`}
            >
              ⛔ Bloqueado
            </button>
            <button
              onClick={() => setFilterCategory('TIMEOUT')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                filterCategory === 'TIMEOUT'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20'
              }`}
            >
              📡 Timeout VPS
            </button>
          </div>

          {/* Reset Filters */}
          {(filterStatus !== 'all' ||
            selectedFilterInstances.length > 0 ||
            filterPeriod !== 'all' ||
            filterCategory !== 'all' ||
            searchQuery.trim() !== '') && (
            <button
              onClick={() => {
                setFilterStatus('all');
                setSelectedFilterInstances([]);
                setFilterPeriod('all');
                setFilterCategory('all');
                setSearchQuery('');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-rose-500 hover:text-rose-600 font-bold flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Limpar Todos os Filtros
            </button>
          )}
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm transition-colors">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Select All Checkbox */}
          <button
            onClick={handleToggleSelectAll}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            {selectedIds.length === filteredReports.length && filteredReports.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {selectedIds.length > 0 ? `${selectedIds.length} Selecionados` : 'Selecionar Todos'}
            </span>
          </button>

          {/* Resend Filtered Errors */}
          {filteredErrorsList.length > 0 && (
            <button
              onClick={() => handleBulkResendErrors(filteredErrorsList)}
              disabled={bulkResending}
              className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${bulkResending ? 'animate-spin' : ''}`} />
              <span>Reenviar Todas as Falhas ({filteredErrorsList.length})</span>
            </button>
          )}

          {/* Bulk Delete Selected */}
          {selectedIds.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Selecionados ({selectedIds.length})</span>
            </button>
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportCSV}
            disabled={filteredReports.length === 0}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Exportar em formato CSV perfeitamente compatível com Excel (delimitador ';' e UTF-8 BOM)"
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV (Excel BR)
          </button>

          <button
            onClick={exportExcel}
            disabled={filteredReports.length === 0}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Exportar em arquivo nativo de Planilha Excel (.xls)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar Excel (.xls)
          </button>

          {reports.length > 0 && (
            <button
              onClick={handleClearAll}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/20 hover:text-rose-600 text-slate-500 transition-colors shadow-sm"
              title="Limpar Todo o Histórico"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Detailed Reports Table */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 overflow-x-auto shadow-sm transition-colors">
        {filteredReports.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-slate-800 dark:text-slate-200 text-sm font-bold">Nenhum registro encontrado com os filtros atuais.</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-md mx-auto">
              Experimente alterar os filtros de período, instância ou status para visualizar os disparos efetuados.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredReports.length && filteredReports.length > 0}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="p-3.5">Data / Hora</th>
                <th className="p-3.5">Instância</th>
                <th className="p-3.5">Contato / Destinatário</th>
                <th className="p-3.5">Mensagem Enviada</th>
                <th className="p-3.5">Status & Diagnóstico</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-sans">
              {filteredReports.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                      isSelected ? 'bg-indigo-50/50 dark:bg-indigo-500/10' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(item.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Sent Date / Time */}
                    <td className="p-3.5 text-slate-600 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {item.sentAt}
                    </td>

                    {/* Instance Name */}
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 font-mono">
                        📱 {item.instanceName || 'Padrão'}
                      </span>
                    </td>

                    {/* Contact Name & Phone */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-200">{item.contactName || 'Contato'}</p>
                          <p className="font-mono text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1">
                            +{item.phone.replace(/\D/g, '')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCopyText(item.phone, `phone_${item.id}`)}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Copiar número de telefone"
                        >
                          {copiedId === `phone_${item.id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>

                    {/* Message Preview */}
                    <td className="p-3.5 max-w-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-slate-800 dark:text-slate-300 font-medium" title={item.messageSent}>
                          {item.messageSent}
                        </p>
                        <button
                          onClick={() => setSelectedReportModal(item)}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] font-bold shrink-0 flex items-center gap-0.5"
                        >
                          <Eye className="w-3 h-3" /> Ver
                        </button>
                      </div>
                    </td>

                    {/* Status & Diagnostics */}
                    <td className="p-3.5 whitespace-nowrap">
                      {item.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Enviado
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 cursor-pointer"
                            onClick={() => setSelectedReportModal(item)}
                            title={item.errorMessage}
                          >
                            <XCircle className="w-3 h-3 shrink-0" /> Falha ({item.errorCategory || 'Erro'})
                          </span>
                          {item.errorMessage && (
                            <p className="text-[10px] text-slate-400 max-w-[180px] truncate" title={item.errorMessage}>
                              {item.errorMessage}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleResend(item)}
                          disabled={resendingId === item.id || bulkResending}
                          className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold transition-colors inline-flex items-center gap-1 shadow-sm disabled:opacity-50"
                          title="Reenviar mensagem para este contato"
                        >
                          {resendingId === item.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Reenviar
                        </button>

                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          title="Excluir este registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Message & Technical Details Modal */}
      {selectedReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
                  Detalhes do Disparo WhatsApp
                </h3>
              </div>
              <button
                onClick={() => setSelectedReportModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-400 font-medium">Data e Hora:</span>
                <p className="font-bold text-slate-900 dark:text-slate-100 font-mono">{selectedReportModal.sentAt}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Instância Utilizada:</span>
                <p className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">📱 {selectedReportModal.instanceName || 'Padrão'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Destinatário:</span>
                <p className="font-bold text-slate-900 dark:text-slate-100">{selectedReportModal.contactName || 'Contato'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Telefone:</span>
                <p className="font-bold text-slate-900 dark:text-slate-100 font-mono">+{selectedReportModal.phone.replace(/\D/g, '')}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Status de Entrega:</span>
                <p className="font-bold">
                  {selectedReportModal.status === 'success' ? (
                    <span className="text-emerald-600 dark:text-emerald-400">✅ Enviado com Sucesso</span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400">❌ Falha no Envio</span>
                  )}
                </p>
              </div>
              {selectedReportModal.errorCategory && (
                <div>
                  <span className="text-slate-400 font-medium">Diagnóstico do Erro:</span>
                  <p className="font-bold text-rose-600 dark:text-rose-400">{selectedReportModal.errorCategory}</p>
                </div>
              )}
            </div>

            {/* Message Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mensagem Completa Enviada:</label>
                <button
                  onClick={() => handleCopyText(selectedReportModal.messageSent, 'modal_msg')}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copiar Mensagem
                </button>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-sans whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed shadow-inner">
                {selectedReportModal.messageSent}
              </div>
            </div>

            {/* Error Message Details if error */}
            {selectedReportModal.errorMessage && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-rose-600 dark:text-rose-400">Resposta da API / Motivo do Erro:</label>
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs font-mono break-all max-h-32 overflow-y-auto">
                  {selectedReportModal.errorMessage}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedReportModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  handleResend(selectedReportModal);
                  setSelectedReportModal(null);
                }}
                disabled={resendingId === selectedReportModal.id}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" /> Reenviar Agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
