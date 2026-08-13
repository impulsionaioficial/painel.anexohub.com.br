'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  Search,
  Download,
  Send,
  RefreshCw,
  ShieldCheck,
  Crown,
  AlertCircle,
  FileSpreadsheet,
  Copy,
  Check,
  X,
  Layers,
  PhoneCall,
  Sparkles,
  Info,
} from 'lucide-react';
import { getStoredConfig, formatPhoneNumber } from '@/lib/evolution-store';

interface Participant {
  jid: string;
  phone: string;
  name: string;
  admin?: 'admin' | 'superadmin' | null;
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

export default function ExtratorPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'groups' | 'contacts'>('groups');

  // Evolution Config & Status
  const [instanceName, setInstanceName] = useState<string>('');
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Data
  const [groups, setGroups] = useState<Group[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Search & Filter
  const [groupSearch, setGroupSearch] = useState<string>('');
  const [contactSearch, setContactSearch] = useState<string>('');
  const [memberSearch, setMemberSearch] = useState<string>('');

  // Selected Group Modal
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Copy Feedback Toast
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setCopiedToast(msg);
    setTimeout(() => setCopiedToast(null), 3000);
  };

  // Fetch groups and contacts from API routes
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    const config = getStoredConfig();
    setInstanceName(config.instanceName || 'allwhatspy_instancia');

    try {
      // 1. Fetch Groups
      const resGroups = await fetch('/api/evolution/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          instanceName: config.instanceName,
        }),
      });
      const dataGroups = await resGroups.json();

      if (dataGroups.success) {
        setGroups(dataGroups.groups || []);
        if (dataGroups.isDemo) setIsDemo(true);
      } else {
        setErrorMsg(dataGroups.error || 'Erro ao carregar grupos do WhatsApp.');
      }

      // 2. Fetch Contacts
      const resContacts = await fetch('/api/evolution/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          instanceName: config.instanceName,
        }),
      });
      const dataContacts = await resContacts.json();

      if (dataContacts.success) {
        setContacts(dataContacts.contacts || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha na comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Groups
  const filteredGroups = groups.filter(
    (g) =>
      g.subject.toLowerCase().includes(groupSearch.toLowerCase()) ||
      (g.description && g.description.toLowerCase().includes(groupSearch.toLowerCase()))
  );

  // Filtered Contacts
  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.phone.includes(contactSearch.replace(/\D/g, ''))
  );

  // Export CSV Helper
  const exportCsv = (filename: string, rows: { name: string; phone: string; origin?: string }[]) => {
    if (rows.length === 0) {
      showToast('⚠️ Nenhum contato para exportar!');
      return;
    }
    const header = ['Nome', 'Telefone', 'Origem'];
    const csvLines = [
      header.join(';'),
      ...rows.map((r) => `"${(r.name || '').replace(/"/g, '""')}";"${formatPhoneNumber(r.phone)}";"${(r.origin || '').replace(/"/g, '""')}"`),
    ];
    const csvContent = '\uFEFF' + csvLines.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`✅ ${rows.length} contatos baixados em CSV!`);
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

  // Extract all unique members from all groups
  const getAllUniqueGroupMembers = () => {
    const map = new Map<string, { name: string; phone: string; origin: string }>();
    groups.forEach((g) => {
      g.participants.forEach((p) => {
        if (p.phone && !map.has(p.phone)) {
          map.set(p.phone, {
            name: p.name,
            phone: p.phone,
            origin: `Grupo: ${g.subject}`,
          });
        }
      });
    });
    return Array.from(map.values());
  };

  const totalUniqueGroupMembers = getAllUniqueGroupMembers().length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 select-none">
      {/* Toast Notification */}
      {copiedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{copiedToast}</span>
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
            Extraia contatos da agenda, grupos e membros de grupos do número conectado via Evolution API.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Dados</span>
          </button>
        </div>
      </div>

      {/* Instance Connection Info Card */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Instância Conectada: <span className="font-mono text-indigo-600 dark:text-indigo-400">{instanceName}</span>
              {isDemo && (
                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">
                  Modo Demonstração
                </span>
              )}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Pronto para ler a estrutura de contatos e grupos vinculados.
            </p>
          </div>
        </div>

        {/* Global Quick Action */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => exportCsv('todos_membros_grupos', getAllUniqueGroupMembers())}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Todos dos Grupos ({totalUniqueGroupMembers})</span>
          </button>
          <button
            onClick={() => handleSendToDisparador(getAllUniqueGroupMembers())}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Disparar para Todos ({totalUniqueGroupMembers})</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
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

      {/* TAB 1: GRUPOS */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por nome do grupo ou descrição..."
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
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
                const adminCount = group.participants.filter((p) => p.admin).length;

                return (
                  <div
                    key={group.id}
                    className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                          {group.subject}
                        </h3>
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

                    {/* Actions Card Footer */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-2">
                      <button
                        onClick={() => setSelectedGroup(group)}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Ver Membros</span>
                      </button>

                      <button
                        onClick={() =>
                          exportCsv(`grupo_${group.subject.replace(/[^a-zA-Z0-9]/g, '_')}`, group.participants)
                        }
                        title="Baixar CSV dos membros deste grupo"
                        className="p-2 rounded-xl text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleSendToDisparador(group.participants)}
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
          {/* Search & Actions Bar */}
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
                onClick={() => exportCsv('agenda_contatos', filteredContacts)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Exportar CSV ({filteredContacts.length})</span>
              </button>
              <button
                onClick={() => handleSendToDisparador(filteredContacts)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all"
              >
                <Send className="w-4 h-4" />
                <span>Disparar para Agenda ({filteredContacts.length})</span>
              </button>
            </div>
          </div>

          {/* Contacts Table */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <span>Carregando contatos da agenda...</span>
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
                      <th className="p-4">JID WhatsApp</th>
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
                        <td className="p-4 font-mono text-[11px] text-slate-400">{contact.id}</td>
                        <td className="p-4 text-right space-x-2">
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

      {/* MODAL: INTEGRANTES DO GRUPO */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
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

            {/* Modal Search & Quick Actions */}
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
                  onClick={() =>
                    exportCsv(`grupo_${selectedGroup.subject.replace(/[^a-zA-Z0-9]/g, '_')}`, selectedGroup.participants)
                  }
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Exportar CSV
                </button>

                <button
                  onClick={() => handleSendToDisparador(selectedGroup.participants)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" /> Disparar para Todos
                </button>
              </div>
            </div>

            {/* Members List */}
            <div className="p-6 overflow-y-auto space-y-2 divide-y divide-slate-100 dark:divide-slate-800">
              {selectedGroup.participants
                .filter(
                  (p) =>
                    p.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                    p.phone.includes(memberSearch.replace(/\D/g, ''))
                )
                .map((participant) => (
                  <div key={participant.jid} className="pt-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{participant.name}</p>
                        <p className="font-mono text-[11px] text-slate-400">+{formatPhoneNumber(participant.phone)}</p>
                      </div>
                      {participant.admin && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px] flex items-center gap-1">
                          <Crown className="w-3 h-3" /> Admin
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleSendToDisparador([participant])}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" /> Disparar
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
