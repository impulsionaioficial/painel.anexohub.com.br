'use client';

import { useState, useEffect } from 'react';
import { QrCode, RefreshCw, LogOut, CheckCircle2, Wifi, Server, Smartphone, ShieldCheck, AlertCircle } from 'lucide-react';
import { getStoredConfig } from '@/lib/evolution-store';

export default function ConexaoPage() {
  const [status, setStatus] = useState<'open' | 'connecting' | 'close' | 'loading'>('loading');
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState<boolean>(false);

  const fetchStatus = async () => {
    const config = getStoredConfig();
    try {
      const res = await fetch('/api/evolution/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.isDemo) setIsDemo(true);
      if (data.success && data.instance?.state) {
        setStatus(data.instance.state);
      } else {
        setStatus('close');
      }
    } catch {
      setStatus('close');
    }
  };

  const generateQRCode = async () => {
    setLoading(true);
    setErrorMsg(null);
    const config = getStoredConfig();

    try {
      const res = await fetch('/api/evolution/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();

      if (data.isDemo) setIsDemo(true);

      if (data.success && data.qrcode?.base64) {
        let b64 = data.qrcode.base64;
        if (!b64.startsWith('data:image')) {
          b64 = `data:image/png;base64,${b64}`;
        }
        setQrCodeBase64(b64);
        if (data.qrcode.pairingCode) setPairingCode(data.qrcode.pairingCode);
        setStatus('connecting');
      } else {
        setErrorMsg(data.error || 'Não foi possível obter o QR Code. Verifique as configurações da VPS.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao conectar à Evolution API');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Deseja desconectar o WhatsApp desta instância?')) return;
    setLoading(true);
    const config = getStoredConfig();
    try {
      await fetch('/api/evolution/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setQrCodeBase64(null);
      setStatus('close');
    } catch {
      alert('Erro ao desconectar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
          <QrCode className="w-7 h-7 text-emerald-400" /> Conexão & QR Code do WhatsApp
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Escaneie o QR Code abaixo diretamente na tela usando o WhatsApp no seu celular para autenticar a sessão.
        </p>
      </div>

      {isDemo && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-200">Modo Demonstrativo Ativo</p>
            <p className="text-amber-300/80">
              Você está visualizando a demonstração. Para conectar com seu WhatsApp real, acesse a aba <b>Configurações VPS</b> e insira a URL e a API Key da sua Evolution API.
            </p>
          </div>
        </div>
      )}

      {/* Main Connection Card */}
      <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
        {/* Status bar inside card */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center gap-3">
            {status === 'open' ? (
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Wifi className="w-5 h-5" />
              </div>
            ) : status === 'connecting' ? (
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400">Status da Instância</p>
              <p className="font-bold text-slate-100 text-sm capitalize">
                {status === 'open' ? '🟢 Conectado e Ativo' : status === 'connecting' ? '🟠 Aguardando Leitura do QR Code' : '🔴 Desconectado'}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchStatus}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Checar Status
            </button>
            {status === 'open' && (
              <button
                onClick={handleLogout}
                disabled={loading}
                className="px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Desconectar
              </button>
            )}
          </div>
        </div>

        {/* QR Code Container */}
        {status === 'open' ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-slate-100">WhatsApp Conectado com Sucesso!</h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Sua sessão do WhatsApp está ativa na VPS. Agora você já pode utilizar o disparador em massa com segurança.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 space-y-6">
            {qrCodeBase64 ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-white rounded-2xl shadow-2xl shadow-emerald-500/10 border border-slate-200">
                  <img
                    src={qrCodeBase64}
                    alt="QR Code WhatsApp Evolution API"
                    className="w-64 h-64 object-contain"
                  />
                </div>
                {pairingCode && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <p className="text-xs text-slate-400">Código de Pareamento:</p>
                    <p className="font-mono text-lg font-bold text-emerald-400 tracking-wider">{pairingCode}</p>
                  </div>
                )}
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  Abra o WhatsApp &gt; Dispositivos Conectados &gt; Conectar um dispositivo
                </p>
              </div>
            ) : (
              <div className="text-center space-y-4 py-8">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-400 flex items-center justify-center mx-auto">
                  <QrCode className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-200">Gerar QR Code na Tela</h3>
                  <p className="text-slate-400 text-xs max-w-sm mx-auto">
                    Clique no botão abaixo para solicitar o QR Code direto da Evolution API.
                  </p>
                </div>
                <button
                  onClick={generateQRCode}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  Gerar QR Code
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs max-w-md text-center">
                {errorMsg}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions list */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs space-y-1.5">
          <span className="font-bold text-emerald-400">1. Abra o WhatsApp</span>
          <p className="text-slate-400">No seu smartphone, abra o WhatsApp no número que fará os disparos.</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs space-y-1.5">
          <span className="font-bold text-emerald-400">2. Dispositivos Conectados</span>
          <p className="text-slate-400">Acesse Menu (3 pontos no Android ou Configurações no iOS) &gt; Dispositivos Conectados.</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs space-y-1.5">
          <span className="font-bold text-emerald-400">3. Escanear QR Code</span>
          <p className="text-slate-400">Toque em "Conectar um dispositivo" e aponte para a imagem acima no seu monitor.</p>
        </div>
      </div>
    </div>
  );
}
