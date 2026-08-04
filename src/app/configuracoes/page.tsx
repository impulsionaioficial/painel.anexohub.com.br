'use client';

import { useState, useEffect } from 'react';
import { Settings, Server, Key, Save, CheckCircle2, RefreshCw, Plus, Trash2, Layers, QrCode, LogOut } from 'lucide-react';
import { EvolutionConfig, QRCodeData } from '@/lib/types';
import { getStoredConfig, saveStoredConfig } from '@/lib/evolution-store';

interface InstanceItem {
  name: string;
  status: string;
  owner?: string;
}

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<EvolutionConfig>({
    baseUrl: '',
    apiKey: '',
    instanceName: '',
  });

  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [selectedInstanceName, setSelectedInstanceName] = useState<string>('');

  // QR Code & Instance Status State
  const [connectionState, setConnectionState] = useState<'open' | 'connecting' | 'close' | 'checking'>('checking');
  const [qrCodeData, setQrCodeData] = useState<QRCodeData | null>(null);
  const [loadingQr, setLoadingQr] = useState<boolean>(false);
  const [profileInfo, setProfileInfo] = useState<{ name?: string; ownerJid?: string }>({});

  const [newInstanceName, setNewInstanceName] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [loadingInstances, setLoadingInstances] = useState<boolean>(false);
  const [creatingInstance, setCreatingInstance] = useState<boolean>(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Check connection status of a specific instance
  const checkStatus = async (targetInstance: string) => {
    if (!config.baseUrl || !config.apiKey || !targetInstance) {
      setConnectionState('close');
      return;
    }

    setConnectionState('checking');
    try {
      const res = await fetch('/api/evolution/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          instanceName: targetInstance,
        }),
      });

      const data = await res.json();
      if (data.success && data.instance) {
        setConnectionState(data.instance.state || 'close');
        setProfileInfo({
          name: data.instance.profileName,
          ownerJid: data.instance.ownerJid,
        });
      } else {
        setConnectionState('close');
      }
    } catch {
      setConnectionState('close');
    }
  };

  // Connect & Fetch QR Code for selected instance
  const fetchQrCode = async () => {
    if (!selectedInstanceName) {
      alert('Selecione uma instância para gerar o QR Code.');
      return;
    }

    setLoadingQr(true);
    setQrCodeData(null);

    try {
      const res = await fetch('/api/evolution/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          instanceName: selectedInstanceName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.qrcode) {
          setQrCodeData(data.qrcode);
          setConnectionState('connecting');
        } else if (data.status === 'open') {
          setConnectionState('open');
        }
      } else {
        alert(`Erro ao gerar QR Code: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Falha ao conectar à VPS: ${err.message}`);
    } finally {
      setLoadingQr(false);
    }
  };

  // Logout / Delete Instance Session
  const handleLogout = async () => {
    if (!selectedInstanceName) return;
    if (!confirm(`Deseja desconectar a sessão da instância [${selectedInstanceName}]?`)) return;

    try {
      const res = await fetch('/api/evolution/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          instanceName: selectedInstanceName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setConnectionState('close');
        setQrCodeData(null);
        alert(`Sessão da instância [${selectedInstanceName}] desconectada com sucesso!`);
        checkStatus(selectedInstanceName);
      } else {
        alert(`Erro ao desconectar: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const fetchInstances = async (currentConfig: EvolutionConfig) => {
    if (!currentConfig.baseUrl || !currentConfig.apiKey) return;
    setLoadingInstances(true);

    try {
      const res = await fetch('/api/evolution/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: currentConfig.baseUrl,
          apiKey: currentConfig.apiKey,
        }),
      });

      const data = await res.json();
      if (data.success && data.instances) {
        setInstances(data.instances);

        // Auto-select first instance if not selected
        if (data.instances.length > 0 && !selectedInstanceName) {
          const first = data.instances[0].name;
          setSelectedInstanceName(first);
          checkStatus(first);
        }
      }
    } catch {
      // Ignore network hiccup
    } finally {
      setLoadingInstances(false);
    }
  };

  useEffect(() => {
    const loaded = getStoredConfig();
    setConfig(loaded);
    fetchInstances(loaded);
  }, []);

  const handleInstanceSelectChange = (name: string) => {
    setSelectedInstanceName(name);
    setQrCodeData(null);
    checkStatus(name);

    // Save as active fallback config
    const updated = { ...config, instanceName: name };
    setConfig(updated);
    saveStoredConfig(updated);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredConfig(config);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    fetchInstances(config);
  };

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstanceName.trim()) return;

    setCreatingInstance(true);
    try {
      const res = await fetch('/api/evolution/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          action: 'create',
          instanceName: newInstanceName.trim(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert(`Instância [${newInstanceName}] criada com sucesso na VPS!`);
        const createdName = newInstanceName.trim();
        setNewInstanceName('');
        setSelectedInstanceName(createdName);
        fetchInstances(config);
        checkStatus(createdName);
      } else {
        alert(`Erro ao criar instância: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Falha na requisição: ${err.message}`);
    } finally {
      setCreatingInstance(false);
    }
  };

  const handleDeleteInstance = async (nameToDelete: string) => {
    if (!confirm(`TEM CERTEZA QUE DESEJA DELETAR A INSTÂNCIA [${nameToDelete}] DA VPS?\n\nEsta ação apagará a sessão do WhatsApp e os arquivos da instância.`)) {
      return;
    }

    setDeletingName(nameToDelete);
    try {
      const res = await fetch('/api/evolution/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          action: 'delete',
          instanceName: nameToDelete,
        }),
      });

      const data = await res.json();

      if (data.success) {
        alert(`Instância [${nameToDelete}] deletada com sucesso!`);
        if (selectedInstanceName === nameToDelete) {
          setSelectedInstanceName('');
          setQrCodeData(null);
        }
        fetchInstances(config);
      } else {
        alert(`Erro ao deletar: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Falha: ${err.message}`);
    } finally {
      setDeletingName(null);
    }
  };

  const handleTestConnection = async () => {
    setTestResult(null);

    try {
      const res = await fetch('/api/evolution/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          instanceName: selectedInstanceName || 'teste',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: `Conexão com VPS OK! Estado da instância [${selectedInstanceName || 'teste'}]: ${data.instance?.state || 'open'}`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Falha ao conectar à Evolution API.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Erro ao testar: ${err.message}`,
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-indigo-600 dark:text-indigo-400" /> Configurações do WhatsApp & Evolution API
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
          Selecione uma instância para conectar via QR Code, configure o servidor VPS e gerencie suas instâncias.
        </p>
      </div>

      {/* 1. SECTION: INSTANCE SELECTOR & QR CODE GENERATOR */}
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-6 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Conexão WhatsApp por QR Code
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Escolha a instância desejada abaixo para ler o QR Code ou verificar status.</p>
          </div>

          {/* Instance Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Instância:</span>
            <select
              value={selectedInstanceName}
              onChange={(e) => handleInstanceSelectChange(e.target.value)}
              className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-bold focus:outline-none focus:border-indigo-500 shadow-sm"
            >
              {instances.length === 0 ? (
                <option value="">Nenhuma instância</option>
              ) : (
                instances.map((inst) => (
                  <option key={inst.name} value={inst.name}>
                    {inst.name} ({inst.status === 'open' ? '🟢 Conectado' : '🔴 Desconectado'})
                  </option>
                ))
              )}
            </select>
            <button
              onClick={() => checkStatus(selectedInstanceName)}
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold shadow-sm"
              title="Atualizar Status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Connection Status Card */}
        {connectionState === 'open' ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                  Instância [{selectedInstanceName}] Conectada e Pronta!
                </h3>
              </div>
              {profileInfo.ownerJid && (
                <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400/80 font-bold">Número Conectado: {profileInfo.ownerJid.replace('@s.whatsapp.net', '')}</p>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-xs font-extrabold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <LogOut className="w-4 h-4" /> Desconectar Sessão
            </button>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-6 text-center shadow-sm">
            <div className="max-w-md mx-auto space-y-2">
              <span className="inline-flex p-3 rounded-2xl bg-indigo-50 dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm">
                <QrCode className="w-8 h-8" />
              </span>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Conectar WhatsApp à Instância [{selectedInstanceName || 'Selecione uma'}]</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Abra o WhatsApp no seu celular &gt; Menu (3 pontos) &gt; Aparelhos conectados &gt; Conectar um aparelho e aponte para o QR Code abaixo.
              </p>
            </div>

            {/* QR Code Rendering */}
            {qrCodeData?.base64 ? (
              <div className="inline-block p-4 bg-white rounded-3xl shadow-xl space-y-2 border-4 border-indigo-500/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCodeData.base64.startsWith('data:') ? qrCodeData.base64 : `data:image/png;base64,${qrCodeData.base64}`}
                  alt="QR Code WhatsApp Evolution API"
                  className="w-64 h-64 mx-auto object-contain"
                />
                <p className="text-[11px] text-slate-800 font-extrabold font-mono">Aguardando leitura pelo celular...</p>
              </div>
            ) : (
              <div>
                <button
                  onClick={fetchQrCode}
                  disabled={loadingQr || !selectedInstanceName}
                  className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-md shadow-indigo-500/25 flex items-center gap-2 mx-auto disabled:opacity-50"
                >
                  {loadingQr ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  Gerar QR Code de Conexão
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. SECTION: VPS SERVER & GLOBAL CREDENTIALS */}
      <form onSubmit={handleSaveConfig} className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-6 shadow-sm transition-colors">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Servidor VPS & Credenciais Globais
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">URL da Evolution API na VPS</label>
            <input
              type="text"
              placeholder="https://sua-vps.com:8084 ou http://IP_DA_VPS:8084"
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-mono shadow-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-amber-500" /> Global API Key da Evolution API
            </label>
            <input
              type="password"
              placeholder="GLOBAL_AUTHENTICATION_API_KEY"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-indigo-500 font-mono shadow-sm"
              required
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-md shadow-indigo-500/25 flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Salvar Credenciais
          </button>

          <button
            type="button"
            onClick={handleTestConnection}
            className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-sm font-bold transition-colors flex items-center gap-2 shadow-sm"
          >
            <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Testar Conexão VPS
          </button>
        </div>

        {savedSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4" /> Credenciais salvas com sucesso!
          </div>
        )}

        {testResult && (
          <div className={`p-4 rounded-2xl text-xs font-bold ${testResult.success ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
            {testResult.message}
          </div>
        )}
      </form>

      {/* 3. SECTION: CREATE NEW INSTANCE */}
      <form onSubmit={handleCreateInstance} className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-sm transition-colors">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Criar Nova Instância do WhatsApp na VPS
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
          Crie uma nova instância para conectar um número de WhatsApp diferente na sua Evolution API.
        </p>

        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Nome da nova instância (ex: comercial_whatsapp, suporte_sp)"
            value={newInstanceName}
            onChange={(e) => setNewInstanceName(e.target.value)}
            className="flex-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-mono shadow-sm"
            required
          />
          <button
            type="submit"
            disabled={creatingInstance}
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/25 flex items-center gap-2 disabled:opacity-50"
          >
            {creatingInstance ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Criar Instância na VPS
          </button>
        </div>
      </form>

      {/* 4. SECTION: INSTANCES MANAGER LIST */}
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-sm transition-colors">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Instâncias Cadastradas na VPS ({instances.length})
          </h2>
          <button
            onClick={() => fetchInstances(config)}
            disabled={loadingInstances}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingInstances ? 'animate-spin' : ''}`} /> Atualizar Lista
          </button>
        </div>

        <div className="space-y-3">
          {instances.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-xs text-center py-6 font-medium">
              Nenhuma instância encontrada na Evolution API. Clique em "Criar Instância" acima.
            </p>
          ) : (
            instances.map((inst) => (
              <div
                key={inst.name}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono font-bold text-slate-800 dark:text-slate-100 text-sm">{inst.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 font-medium">
                    Status:{' '}
                    <span className={`font-extrabold ${inst.status === 'open' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                      {inst.status === 'open' ? '🟢 Conectado' : '🔴 Desconectado (close)'}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleInstanceSelectChange(inst.name)}
                    className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
                  >
                    Gerar QR Code / Status
                  </button>
                  <button
                    onClick={() => handleDeleteInstance(inst.name)}
                    disabled={deletingName === inst.name}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                  >
                    {deletingName === inst.name ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Deletar Instância
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
