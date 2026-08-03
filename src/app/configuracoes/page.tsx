'use client';

import { useState, useEffect } from 'react';
import { Settings, Server, Key, ShieldCheck, Save, CheckCircle2, RefreshCw } from 'lucide-react';
import { EvolutionConfig } from '@/lib/types';
import { getStoredConfig, saveStoredConfig } from '@/lib/evolution-store';

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<EvolutionConfig>({
    baseUrl: '',
    apiKey: '',
    instanceName: '',
  });

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setConfig(getStoredConfig());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredConfig(config);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/evolution/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: `Conexão bem-sucedida com a VPS! Estado da instância: ${data.instance?.state || 'OK'}`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Falha ao conectar com a Evolution API.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Erro ao testar: ${err.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
          <Settings className="w-7 h-7 text-emerald-400" /> Configurações da Evolution API (VPS)
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Insira as credenciais do container da Evolution API rodando na sua VPS Linux.
        </p>
      </div>

      <form onSubmit={handleSave} className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-emerald-400" /> URL da Evolution API na VPS
            </label>
            <input
              type="text"
              placeholder="https://sua-vps.com:8084 ou http://IP_DA_VPS:8084"
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50 font-mono"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Exemplo: <code className="text-slate-400">http://192.168.1.100:8084</code> ou com domínio HTTPS.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-amber-400" /> Global API Key da Evolution API
            </label>
            <input
              type="password"
              placeholder="Sua API Key Global (AUTHENTICATION_API_KEY)"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-400" /> Nome da Instância no WhatsApp
            </label>
            <input
              type="text"
              placeholder="minha_instancia_whatsapp"
              value={config.instanceName}
              onChange={(e) => setConfig({ ...config, instanceName: e.target.value })}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500/50 font-mono"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Nome identificador único para essa sessão do WhatsApp na sua VPS.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Salvar Configurações
          </button>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4 text-emerald-400" />}
            Testar Conexão
          </button>
        </div>

        {savedSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Configurações salvas com sucesso!
          </div>
        )}

        {testResult && (
          <div
            className={`p-4 rounded-xl text-xs ${
              testResult.success
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
            }`}
          >
            {testResult.message}
          </div>
        )}
      </form>
    </div>
  );
}
