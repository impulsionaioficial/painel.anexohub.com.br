'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  Search,
  Download,
  Send,
  RefreshCw,
  Crown,
  AlertCircle,
  QrCode,
  Plus,
  Settings,
  X,
  PhoneCall,
  Sparkles,
  Check,
  Server,
  FileSpreadsheet,
  FileText,
  CheckSquare,
  Square,
  Layers,
} from 'lucide-react';
import { getStoredConfig, saveStoredConfig, formatPhoneNumber } from '@/lib/evolution-store';

interface Participant {
  jid: string;
  phone: string;
  name: string;
  admin?: 'admin' | 'superadmin' | null;
  isLid?: boolean;
}

interface Group {
  id: string;
  subject: string;
  description?: string;
  creation?: number;
  owner?: string;
  size: number;
  participants: Participant[];
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  pushName?: string;
}

interface InstanceItem {
  name: string;
  status: string;
  owner?: string;
}

export default function ExtratorPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'groups' | 'contacts'>('groups');

  // Evolution Config State
  const [config, setConfig] = useState({
    baseUrl: '',
    apiKey: '',
    instanceName: '',
  });

  const [connectionState, setConnectionState] = useState<'open' | 'connecting' | 'close' | 'checking'>('checking');
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Instances list
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');

  // Data
  const [groups, setGroups] = useState<Group[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Selected Group Checkboxes
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Search & Filter
  const [groupSearch, setGroupSearch] = useState<string>('');
  const [contactSearch, setContactSearch] = useState<string>('');
  const [memberSearch, setMemberSearch] = useState<string>('');

  // Modals State
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showNewInstanceModal, setShowNewInstanceModal] = useState<boolean>(false);

  // QR Code State
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState<boolean>(false);

  // Form Inputs
  const [inputBaseUrl, setInputBaseUrl] = useState<string>('');
  const [inputApiKey, setInputApiKey] = useState<string>('');
  const [inputNewInstanceName, setInputNewInstanceName] = useState<string>('');
  const [creatingInstance, setCreatingInstance] = useState<boolean>(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initial load
  useEffect(() => {
    const currentConfig = getStoredConfig();
    setConfig(currentConfig);
    setInputBaseUrl(currentConfig.baseUrl || '');
    setInputApiKey(currentConfig.apiKey || '');
    setSelectedInstance(currentConfig.instanceName || 'allwhatspy_instancia');

    const isDemoMode = !currentConfig.baseUrl || currentConfig.baseUrl.includes('exemplo.com');
    setIsDemo(isDemoMode);

    loadAllData(currentConfig);
    fetchInstancesList(currentConfig);
  }, []);

  // Fetch instances available on VPS
  const fetchInstancesList = async (cfg: typeof config) => {
    if (!cfg.baseUrl || !cfg.apiKey || cfg.baseUrl.includes('exemplo.com')) return;

    try {
      const res = await fetch('/api/evolution/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: cfg.baseUrl,
          apiKey: cfg.apiKey,
        }),
      });
      const data = await res.json();
      if (data.success && data.instances) {
        setInstances(data.instances);
      }
    } catch {}
  };

  // Main loader for Groups and Contacts
  const loadAllData = async (cfg: typeof config, targetInstance?: string) => {
    setLoading(true);
    setErrorMsg(null);
    const instName = targetInstance || cfg.instanceName || 'allwhatspy_instancia';

    try {
      // 1. Fetch Groups
      const resGroups = await fetch('/api/evolution/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: cfg.baseUrl,
          apiKey: cfg.apiKey,
          instanceName: instName,
        }),
      });
      const dataGroups = await resGroups.json();

      if (dataGroups.success) {
        const loadedGroups: Group[] = dataGroups.groups || [];
        setGroups(loadedGroups);
        // Select all by default
        setSelectedGroupIds(loadedGroups.map((g) => g.id));

        if (dataGroups.isDemo) {
          setIsDemo(true);
          setConnectionState('close');
        } else {
          setIsDemo(false);
          setConnectionState('open');
        }
      } else {
        setErrorMsg(dataGroups.error || 'Erro ao carregar grupos do WhatsApp.');
      }

      // 2. Fetch Contacts
      const resContacts = await fetch('/api/evolution/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: cfg.baseUrl,
          apiKey: cfg.apiKey,
          instanceName: instName,
        }),
      });
      const dataContacts = await resContacts.json();

      if (dataContacts.success) {
        setContacts(dataContacts.contacts || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha na comunicação com a API.');
    } finally {
      setLoading(false);
    }
  };

  // Switch Active Instance
  const handleSelectInstance = (name: string) => {
    setSelectedInstance(name);
    const newConfig = { ...config, instanceName: name };
    setConfig(newConfig);
    saveStoredConfig(newConfig);
    loadAllData(newConfig, name);
  };

  // Generate / Fetch QR Code
  const handleOpenQrModal = async () => {
    setShowQrModal(true);
    setLoadingQr(true);
    setQrBase64(null);
    setPairingCode(null);

    try {
      const res = await fetch('/api/evolution/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          instanceName: selectedInstance || config.instanceName || 'allwhatspy_instancia',
        }),
      });

      const data = await res.json();
      if (data.success && data.qrcode) {
        setQrBase64(data.qrcode.base64);
        setPairingCode(data.qrcode.pairingCode);
        startStatusPolling();
      } else {
        setErrorMsg(data.error || 'Não foi possível gerar o QR Code.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao conectar à VPS.');
    } finally {
      setLoadingQr(false);
    }
  };

  // Poll connection status while scanning
  const startStatusPolling = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/evolution/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            instanceName: selectedInstance || config.instanceName,
          }),
        });
        const data = await res.json();

        if (data.success && data.instance?.state === 'open') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setConnectionState('open');
          setShowQrModal(false);
          showToast('🎉 WhatsApp conectado com sucesso! Atualizando dados...');
          loadAllData(config, selectedInstance);
        }
      } catch {}
    }, 3000);
  };

  const handleCloseQrModal = () => {
    setShowQrModal(false);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  };

  const [resolvingLids, setResolvingLids] = useState<boolean>(false);

  // Resolve hidden LIDs to real phone numbers via Evolution API
  const handleResolveLids = async (targetGroupObj?: Group) => {
    const groupsToProcess = targetGroupObj ? [targetGroupObj] : groups.filter((g) => selectedGroupIds.includes(g.id));
    const lidsToResolve: string[] = [];

    groupsToProcess.forEach((g) => {
      g.participants.forEach((p) => {
        if (p.isLid || p.phone.length > 13) {
          lidsToResolve.push(p.phone);
        }
      });
    });

    if (lidsToResolve.length === 0) {
      showToast('ℹ️ Todos os contatos desta lista já possuem números de telefone reais!');
      return;
    }

    setResolvingLids(true);
    showToast(`🔍 Consultando Evolution API para revelar ${lidsToResolve.length} números...`);

    try {
      const res = await fetch('/api/evolution/resolve-lids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          instanceName: selectedInstance || config.instanceName,
          lids: lidsToResolve,
        }),
      });

      const data = await res.json();
      if (data.success && data.resolved) {
        const map: Record<string, { phone: string; name?: string }> = data.resolved;
        let countResolved = 0;

        // Update groups state in memory
        setGroups((prevGroups) =>
          prevGroups.map((g) => {
            const updatedParticipants = g.participants.map((p) => {
              if (map[p.phone]) {
                countResolved++;
                const item = map[p.phone];
                return {
                  ...p,
                  phone: item.phone,
                  name: p.name && !p.name.includes('Membro') ? p.name : item.name || `+${item.phone}`,
                  isLid: false,
                };
              }
              return p;
            });
            return { ...g, participants: updatedParticipants };
          })
        );

        // Also update selectedGroup if modal is open
        if (selectedGroup) {
          setSelectedGroup((prev) => {
            if (!prev) return null;
            const updatedParticipants = prev.participants.map((p) => {
              if (map[p.phone]) {
                const item = map[p.phone];
                return {
                  ...p,
                  phone: item.phone,
                  name: p.name && !p.name.includes('Membro') ? p.name : item.name || `+${item.phone}`,
                  isLid: false,
                };
              }
              return p;
            });
            return { ...prev, participants: updatedParticipants };
          });
        }

        if (countResolved > 0) {
          showToast(`🎉 ${countResolved} números de telefone recuperados com sucesso!`);
        } else {
          showToast('ℹ️ O WhatsApp ainda não disponibilizou o telefone no perfil desses LIDs.');
        }
      } else {
        showToast('⚠️ Erro ao consultar a Evolution API para resolver números.');
      }
    } catch (err: any) {
      showToast('⚠️ Falha de comunicação com o servidor ao resolver números.');
    } finally {
      setResolvingLids(false);
    }
  };

  // Create New Instance
  const handleCreateInstance = async () => {
    if (!inputNewInstanceName.trim()) {
      alert('Digite o nome para a nova instância.');
      return;
    }

    setCreatingInstance(true);
    const cleanName = inputNewInstanceName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    try {
      const res = await fetch('/api/evolution/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          action: 'create',
          instanceName: cleanName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`✅ Instância "${cleanName}" criada!`);
        setShowNewInstanceModal(false);
        setInputNewInstanceName('');
        handleSelectInstance(cleanName);
        fetchInstancesList(config);
        handleOpenQrModal();
      } else {
        alert(data.error || 'Erro ao criar instância.');
      }
    } catch (err: any) {
      alert(err.message || 'Falha de comunicação.');
    } finally {
      setCreatingInstance(false);
    }
  };

  // Save VPS Config
  const handleSaveConfig = () => {
    if (!inputBaseUrl.trim() || !inputApiKey.trim()) {
      alert('Preencha a URL da VPS e a API Key.');
      return;
    }

    const newConfig = {
      baseUrl: inputBaseUrl.trim(),
      apiKey: inputApiKey.trim(),
      instanceName: selectedInstance || 'allwhatspy_instancia',
    };

    setConfig(newConfig);
    saveStoredConfig(newConfig);
    setIsDemo(false);
    setShowConfigModal(false);
    showToast('⚙️ Configurações da VPS salvas! Carregando instâncias...');
    fetchInstancesList(newConfig);
    loadAllData(newConfig);
  };

  // Filtered Groups & Contacts
  const filteredGroups = groups.filter(
    (g: Group) =>
      g.subject.toLowerCase().includes(groupSearch.toLowerCase()) ||
      (g.description && g.description.toLowerCase().includes(groupSearch.toLowerCase()))
  );

  const filteredContacts = contacts.filter(
    (c: Contact) =>
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.phone.includes(contactSearch.replace(/\D/g, ''))
  );

  // Toggle single group checkbox selection
  const toggleGroupSelect = (id: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle select all groups
  const toggleSelectAllGroups = () => {
    if (selectedGroupIds.length === filteredGroups.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(filteredGroups.map((g: Group) => g.id));
    }
  };

  // Build rows containing EXACTLY the 4 required output fields:
  // 1. Nome no WhatsApp (se tiver)
  // 2. Número do WhatsApp
  // 3. Qual grupo era
  // 4. Data de extração
  const getSelectedExportRows = () => {
    const extractionDateStr = new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const rows: { name: string; phone: string; groupName: string; extractionDate: string }[] = [];
    const targetGroups = groups.filter((g) => selectedGroupIds.includes(g.id));

    targetGroups.forEach((group) => {
      group.participants.forEach((p) => {
        const cleanPhone = formatPhoneNumber(p.phone);
        const nameVal = p.name && !p.name.startsWith('+') ? p.name.trim() : '';

        rows.push({
          name: nameVal,
          phone: cleanPhone,
          groupName: group.subject || 'Sem Nome',
          extractionDate: extractionDateStr,
        });
      });
    });

    return rows;
  };

  // EXPORT EXCEL (.csv format styled for Excel with text phone formatting)
  const exportExcel = () => {
    const rows = getSelectedExportRows();
    if (rows.length === 0) {
      showToast('⚠️ Selecione pelo menos 1 grupo para extrair!');
      return;
    }

    const header = ['Nome no WhatsApp', 'Número do WhatsApp', 'Qual Grupo Era', 'Data de Extração'];
    const csvLines = [
      header.join(';'),
      ...rows.map((r) =>
        [
          `"${(r.name || '').replace(/"/g, '""')}"`,
          `"'${r.phone}"`, // Format phone as text in Excel with leading single quote
          `"${(r.groupName || '').replace(/"/g, '""')}"`,
          `"${r.extractionDate}"`,
        ].join(';')
      ),
    ];

    const csvContent = '\uFEFF' + csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `extracao_grupos_excel_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`✅ ${rows.length} contatos exportados para Excel!`);
  };

  // EXPORT CSV (Standard UTF-8 BOM)
  const exportCsv = () => {
    const rows = getSelectedExportRows();
    if (rows.length === 0) {
      showToast('⚠️ Selecione pelo menos 1 grupo para extrair!');
      return;
    }

    const header = ['Nome no WhatsApp', 'Número do WhatsApp', 'Qual Grupo Era', 'Data de Extração'];
    const csvLines = [
      header.join(';'),
      ...rows.map((r) =>
        [
          `"${(r.name || '').replace(/"/g, '""')}"`,
          `"${r.phone}"`,
          `"${(r.groupName || '').replace(/"/g, '""')}"`,
          `"${r.extractionDate}"`,
        ].join(';')
      ),
    ];

    const csvContent = '\uFEFF' + csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `extracao_grupos_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`✅ ${rows.length} contatos exportados em CSV!`);
  };

  // EXPORT TXT (Text file layout)
  const exportTxt = () => {
    const rows = getSelectedExportRows();
    if (rows.length === 0) {
      showToast('⚠️ Selecione pelo menos 1 grupo para extrair!');
      return;
    }

    const txtLines = [
      `NOME NO WHATSAPP | NÚMERO DO WHATSAPP | QUAL GRUPO ERA | DATA DE EXTRAÇÃO`,
      `---------------------------------------------------------------------------------`,
      ...rows.map(
        (r) =>
          `${r.name || 'N/A'} | ${r.phone} | ${r.groupName} | ${r.extractionDate}`
      ),
    ];

    const txtContent = txtLines.join('\n');
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `extracao_grupos_${Date.now()}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`📄 ${rows.length} contatos exportados em TXT!`);
  };

  // Send to Disparador Helper
  const handleSendToDisparador = (rows: { name: string; phone: string }[]) => {
    if (rows.length === 0) {
      showToast('⚠️ Nenhum contato selecionado!');
      return;
    }

    const formatted = rows.map((r, idx) => ({
      id: `ext_${Date.now()}_${idx}`,
      name: r.name || `Contato ${formatPhoneNumber(r.phone)}`,
      phone: formatPhoneNumber(r.phone),
      status: 'pending' as const,
    }));

    localStorage.setItem('awp_imported_contacts', JSON.stringify(formatted));
    showToast(`🚀 ${rows.length} contatos enviados! Redirecionando...`);
    setTimeout(() => {
      router.push('/disparador');
    }, 800);
  };

  const selectedRowsCount = getSelectedExportRows().length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 select-none">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <UserPlus className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Extrator de Grupos e Contatos
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Selecione grupos e extraia nomes, números, nome do grupo e data nos formatos CSV, Excel ou TXT.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-all"
          >
            <Settings className="w-4 h-4 text-indigo-500" />
            <span>Configurar VPS</span>
          </button>

          <button
            onClick={() => loadAllData(config)}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Dados</span>
          </button>
        </div>
      </div>

      {/* Demo Warning Banner */}
      {isDemo && (
        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs font-bold">Você está em Modo Demonstração (Dados Ilustrativos)</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Insira a URL da sua VPS e a API Key para conectar seu WhatsApp real, escanear o QR Code e extrair seus grupos reais.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all shrink-0 shadow-md shadow-amber-500/20"
          >
            Conectar Minha VPS Agora
          </button>
        </div>
      )}

      {/* Connection & Instance Bar */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full shrink-0 ${
                connectionState === 'open'
                  ? 'bg-emerald-500 animate-pulse'
                  : connectionState === 'connecting'
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-rose-500'
              }`}
            />
            <div>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">
                Status Conexão
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {connectionState === 'open'
                  ? 'WhatsApp Conectado'
                  : connectionState === 'connecting'
                  ? 'Aguardando Leitura QR'
                  : 'Desconectado'}
              </span>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block">
              Instância Ativa
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              {instances.length > 0 ? (
                <select
                  value={selectedInstance}
                  onChange={(e) => handleSelectInstance(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                >
                  {instances.map((inst) => (
                    <option key={inst.name} value={inst.name}>
                      {inst.name} ({inst.status === 'open' ? '🟢 Conectada' : '🔴 Desconectada'})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedInstance || 'allwhatspy_instancia'}
                </span>
              )}

              <button
                onClick={() => setShowNewInstanceModal(true)}
                title="Criar nova instância no WhatsApp"
                className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleOpenQrModal}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 shadow-sm transition-all"
          >
            <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Escanear QR Code</span>
          </button>
        </div>
      </div>

      {errorMsg && !isDemo && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('groups')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'groups'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Extrator de Grupos ({groups.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'contacts'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          <span>Agenda de Contatos ({contacts.length})</span>
        </button>
      </div>

      {/* TAB 1: GRUPOS COM SELEÇÃO E EXPORTAÇÃO EXCEL, CSV E TXT */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Top Control Bar: Search & Export Formats */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Select All Checkbox & Counter */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={toggleSelectAllGroups}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 transition-all"
                >
                  {selectedGroupIds.length === filteredGroups.length && filteredGroups.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>
                    {selectedGroupIds.length === filteredGroups.length
                      ? 'Desmarcar Todos'
                      : 'Selecionar Todos os Grupos'}
                  </span>
                </button>

                <span className="text-xs font-bold text-slate-500">
                  {selectedGroupIds.length} de {filteredGroups.length} grupos selecionados ({selectedRowsCount} contatos)
                </span>
              </div>

              {/* Format Extraction Buttons */}
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                <button
                  onClick={exportCsv}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-500/20 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar CSV</span>
                </button>

                <button
                  onClick={exportExcel}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-500/10 hover:bg-green-100 border border-green-200 dark:border-green-500/20 transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />
                  <span>Baixar Excel</span>
                </button>

                <button
                  onClick={exportTxt}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 border border-sky-200 dark:border-sky-500/20 transition-all"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-600" />
                  <span>Baixar TXT</span>
                </button>

                <button
                  onClick={() => handleSendToDisparador(getSelectedExportRows())}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Disparar para Selecionados</span>
                </button>
              </div>
            </div>

            {/* Filter Search Input */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Filtrar grupos por nome ou descrição..."
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Groups List Grid */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <span>Carregando grupos do WhatsApp...</span>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              Nenhum grupo encontrado com este filtro.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGroups.map((group) => {
                const isSelected = selectedGroupIds.includes(group.id);
                const adminCount = group.participants.filter((p) => p.admin).length;

                return (
                  <div
                    key={group.id}
                    onClick={() => toggleGroupSelect(group.id)}
                    className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                      isSelected
                        ? 'border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                        : 'border-slate-200 dark:border-slate-800/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Checkbox */}
                          <div className="shrink-0 text-indigo-600 dark:text-indigo-400">
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 fill-indigo-500/20" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                            )}
                          </div>
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                            {group.subject}
                          </h3>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                          {group.size} membros
                        </span>
                      </div>

                      {group.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {group.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium pt-1">
                        <span className="flex items-center gap-1">
                          <Crown className="w-3.5 h-3.5 text-amber-500" /> {adminCount} Admins
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroup(group);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Ver Membros</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendToDisparador(group.participants);
                        }}
                        title="Enviar membros direto para o Disparador"
                        className="p-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONTATOS DA AGENDA */}
      {activeTab === 'contacts' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por nome ou número..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={() => handleSendToDisparador(filteredContacts)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all"
              >
                <Send className="w-4 h-4" />
                <span>Disparar para Agenda ({filteredContacts.length})</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <span>Carregando contatos...</span>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              Nenhum contato encontrado.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-4">Nome / Apelido</th>
                      <th className="p-4">Número WhatsApp</th>
                      <th className="p-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredContacts.map((contact) => (
                      <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{contact.name}</td>
                        <td className="p-4 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                          +{formatPhoneNumber(contact.phone)}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleSendToDisparador([contact])}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-700 transition-all inline-flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" /> Disparar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ESCANEAR QR CODE */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-6 animate-in zoom-in-95 duration-150 relative">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Escanear QR Code WhatsApp
                </h2>
              </div>
              <button
                onClick={handleCloseQrModal}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center space-y-4">
              {loadingQr ? (
                <div className="w-64 h-64 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                  <span className="text-xs text-slate-500 font-medium">Gerando QR Code...</span>
                </div>
              ) : qrBase64 ? (
                <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200">
                  <img src={qrBase64} alt="QR Code WhatsApp" className="w-60 h-60 object-contain rounded-lg" />
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500">Não foi possível carregar o QR Code.</div>
              )}

              {pairingCode && (
                <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-mono font-bold text-center w-full">
                  Código de Conectividade: <span className="text-sm underline">{pairingCode}</span>
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                Abra o WhatsApp no celular → <strong>Dispositivos Conectados</strong> → <strong>Conectar um dispositivo</strong> e aponte a câmera para a tela.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={handleCloseQrModal}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIGURAR VPS */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Configurar Evolution API (VPS)
                </h2>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  URL da VPS / Evolution API
                </label>
                <input
                  type="text"
                  placeholder="https://sua-vps.com:8084"
                  value={inputBaseUrl}
                  onChange={(e) => setInputBaseUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Global API Key da Evolution API
                </label>
                <input
                  type="password"
                  placeholder="SUA_API_KEY_AQUI"
                  value={inputApiKey}
                  onChange={(e) => setInputApiKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20"
              >
                Salvar & Conectar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CRIAR NOVA INSTÂNCIA */}
      {showNewInstanceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Criar Nova Instância WhatsApp
                </h2>
              </div>
              <button
                onClick={() => setShowNewInstanceModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Nome da Instância (sem espaços ou acentos)
              </label>
              <input
                type="text"
                placeholder="ex: atendimento_empresa"
                value={inputNewInstanceName}
                onChange={(e) => setInputNewInstanceName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowNewInstanceModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateInstance}
                disabled={creatingInstance}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {creatingInstance && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Criar & Escanear QR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: INTEGRANTES DO GRUPO */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  {selectedGroup.subject}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Lista de todos os {selectedGroup.participants.length} participantes deste grupo.
                </p>
              </div>

              <button
                onClick={() => setSelectedGroup(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filtrar membro..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => handleSendToDisparador(selectedGroup.participants)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" /> Disparar para Todos
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-2 divide-y divide-slate-100 dark:divide-slate-800">
              {selectedGroup.participants
                .filter(
                  (p) =>
                    p.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                    p.phone.includes(memberSearch.replace(/\D/g, ''))
                )
                .map((participant) => {
                  const isLidEncrypted = participant.isLid || participant.phone.length > 13;

                  return (
                    <div key={participant.jid} className="pt-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">{participant.name}</p>
                          {isLidEncrypted ? (
                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md inline-block">
                              🔒 Oculto p/ WhatsApp (Comunidade)
                            </span>
                          ) : (
                            <p className="font-mono text-[11px] text-slate-400">+{formatPhoneNumber(participant.phone)}</p>
                          )}
                        </div>
                        {participant.admin && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px] flex items-center gap-1">
                            <Crown className="w-3 h-3" /> Admin
                          </span>
                        )}
                      </div>

                      {!isLidEncrypted && (
                        <button
                          onClick={() => handleSendToDisparador([participant])}
                          className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" /> Disparar
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
