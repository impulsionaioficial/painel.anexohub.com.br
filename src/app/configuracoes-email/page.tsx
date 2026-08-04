'use client';

import { useState, useEffect } from 'react';
import { Mail, Server, Plus, Trash2, RefreshCw, Send, ShieldAlert, CheckCircle2, AlertTriangle, HelpCircle, Search } from 'lucide-react';
import { SMTPAccount } from '@/lib/types';
import { getStoredSMTPAccounts, saveStoredSMTPAccounts } from '@/lib/email-store';

export default function ConfiguracoesEmailPage() {
  const [accounts, setAccounts] = useState<SMTPAccount[]>([]);
  const [testRecipient, setTestRecipient] = useState<string>('');

  const [name, setName] = useState<string>('Conta SMTP Principal');
  const [host, setHost] = useState<string>('smtp.gmail.com');
  const [port, setPort] = useState<number>(587);
  const [secure, setSecure] = useState<boolean>(false);
  const [user, setUser] = useState<string>('');
  const [pass, setPass] = useState<string>('');
  const [fromName, setFromName] = useState<string>('');

  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Anti-Spam DNS Checker state
  const [checkDomain, setCheckDomain] = useState<string>('');
  const [checkingDns, setCheckingDns] = useState<boolean>(false);
  const [dnsResult, setDnsResult] = useState<any | null>(null);

  useEffect(() => {
    const accs = getStoredSMTPAccounts();
    setAccounts(accs);
    if (accs.length > 0 && accs[0].user && accs[0].user.includes('@')) {
      setCheckDomain(accs[0].user.split('@')[1]);
    }
  }, []);

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!host || !user || !pass) return;

    const newAcc: SMTPAccount = {
      id: `smtp_${Date.now()}`,
      name: name || user,
      host,
      port: Number(port),
      secure,
      user,
      pass,
      fromName: fromName || name,
      fromEmail: user,
      status: 'active',
    };

    const updated = [...accounts, newAcc];
    setAccounts(updated);
    saveStoredSMTPAccounts(updated);

    setName('');
    setUser('');
    setPass('');
    setFromName('');
    alert('Conta SMTP adicionada com sucesso!');
  };

  const handleRemoveAccount = (id: string) => {
    if (confirm('Deseja remover esta conta SMTP?')) {
      const updated = accounts.filter((a) => a.id !== id);
      setAccounts(updated);
      saveStoredSMTPAccounts(updated);
    }
  };

  const handleTestSMTP = async (acc: SMTPAccount) => {
    setTestingId(acc.id);
    setTestResult(null);

    try {
      const res = await fetch('/api/email/smtp-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...acc,
          testRecipient: testRecipient || acc.user,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setTestResult({
          id: acc.id,
          success: true,
          message: data.isDemo ? data.message : '🟢 Conexão SMTP bem-sucedida! E-mail de teste enviado.',
        });
      } else {
        setTestResult({
          id: acc.id,
          success: false,
          message: `🔴 ${data.error}`,
        });
      }
    } catch (err: any) {
      setTestResult({
        id: acc.id,
        success: false,
        message: `🔴 Erro de conexão: ${err.message}`,
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleCheckDNS = async () => {
    if (!checkDomain.trim()) return;
    setCheckingDns(true);
    setDnsResult(null);

    try {
      const res = await fetch('/api/email/dns-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: checkDomain.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        setDnsResult(data.result);
      } else {
        alert(`Erro na consulta DNS: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Falha ao checar DNS: ${err.message}`);
    } finally {
      setCheckingDns(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
          <Mail className="w-7 h-7 text-indigo-600 dark:text-indigo-400" /> Servidores SMTP & Credenciais Anti-Spam
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
          Cadastre seus servidores SMTP e verifique seus registros de autenticação **SPF, DKIM e DMARC** no DNS para garantir entrega na caixa de entrada.
        </p>
      </div>

      {/* Anti-Spam & Deliverability DNS Diagnostic Widget */}
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-6 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" /> Diagnóstico de Entregabilidade (SPF / DKIM / DMARC)
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">
              Consulte se o domínio do seu e-mail possui os registros DNS necessários para não cair na caixa de Spam no Gmail, Outlook e Yahoo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="ex: seudominio.com.br"
              value={checkDomain}
              onChange={(e) => setCheckDomain(e.target.value)}
              className="p-2.5 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono w-56 focus:outline-none focus:border-amber-500 shadow-sm"
            />
            <button
              onClick={handleCheckDNS}
              disabled={checkingDns || !checkDomain.trim()}
              className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {checkingDns ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Testar DNS
            </button>
          </div>
        </div>

        {/* DNS Check Results */}
        {dnsResult && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            {/* SPF Card */}
            <div className={`p-4 rounded-2xl border space-y-2 shadow-sm ${dnsResult.spf.found ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">SPF (Sender Policy)</span>
                {dnsResult.spf.found ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-rose-500" />}
              </div>
              <p className={dnsResult.spf.found ? 'text-emerald-600 dark:text-emerald-400 break-all font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>{dnsResult.spf.message}</p>
              {dnsResult.spf.found && <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 text-[11px] text-slate-700 dark:text-slate-300 break-all border border-slate-200 dark:border-slate-800">{dnsResult.spf.record}</div>}
            </div>

            {/* DMARC Card */}
            <div className={`p-4 rounded-2xl border space-y-2 shadow-sm ${dnsResult.dmarc.found ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">DMARC Policy</span>
                {dnsResult.dmarc.found ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-rose-500" />}
              </div>
              <p className={dnsResult.dmarc.found ? 'text-emerald-600 dark:text-emerald-400 break-all font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>{dnsResult.dmarc.message}</p>
              {dnsResult.dmarc.found && <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 text-[11px] text-slate-700 dark:text-slate-300 break-all border border-slate-200 dark:border-slate-800">{dnsResult.dmarc.record}</div>}
            </div>

            {/* DKIM Card */}
            <div className={`p-4 rounded-2xl border space-y-2 shadow-sm ${dnsResult.dkim.found ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-amber-500/5 border-amber-500/30'}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">DKIM Assinatura</span>
                {dnsResult.dkim.found ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <HelpCircle className="w-4 h-4 text-amber-500" />}
              </div>
              <p className={dnsResult.dkim.found ? 'text-emerald-600 dark:text-emerald-400 break-all font-semibold' : 'text-amber-600 dark:text-amber-300 font-semibold'}>{dnsResult.dkim.message}</p>
              {dnsResult.dkim.found && <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 text-[11px] text-slate-700 dark:text-slate-300 break-all border border-slate-200 dark:border-slate-800">{dnsResult.dkim.record}</div>}
            </div>
          </div>
        )}

        {/* Instructions Guide */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-xs space-y-3">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            📌 Como criar o registro DMARC e SPF no seu Gerenciador de DNS (Cloudflare, Registro.br, GoDaddy):
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[11px] text-slate-700 dark:text-slate-300">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
              <p className="font-bold text-indigo-600 dark:text-indigo-400">1. Registro DMARC (Tipo TXT):</p>
              <p><strong>Nome:</strong> <code className="text-amber-600 dark:text-amber-300">_dmarc</code></p>
              <p><strong>Valor:</strong> <code className="text-emerald-600 dark:text-emerald-300">v=DMARC1; p=none; rua=mailto:dmarc@{checkDomain || 'seudominio.com'}</code></p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
              <p className="font-bold text-indigo-600 dark:text-indigo-400">2. Registro SPF (Tipo TXT):</p>
              <p><strong>Nome:</strong> <code className="text-amber-600 dark:text-amber-300">@</code></p>
              <p><strong>Valor:</strong> <code className="text-emerald-600 dark:text-emerald-300">v=spf1 mx include:_spf.google.com ~all</code></p>
            </div>
          </div>
        </div>
      </div>

      {/* Add New SMTP Account Form */}
      <form onSubmit={handleAddAccount} className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-6 shadow-sm transition-colors">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Cadastrar Novo Servidor SMTP
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome de Identificação</label>
            <input
              type="text"
              placeholder="ex: SMTP Comercial Gmail"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Remetente (Exibição)</label>
            <input
              type="text"
              placeholder="ex: Lucas Lourenço"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Host SMTP</label>
            <input
              type="text"
              placeholder="smtp.gmail.com ou smtp.hostinger.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-mono shadow-sm"
              required
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Porta</label>
              <input
                type="number"
                placeholder="587 ou 465"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-mono shadow-sm"
                required
              />
            </div>
            <div className="flex items-end pb-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={secure}
                  onChange={(e) => setSecure(e.target.checked)}
                  className="rounded-md border-slate-300 text-indigo-600 focus:ring-0"
                />
                SSL/TLS (Porta 465)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">E-mail / Usuário SMTP</label>
            <input
              type="email"
              placeholder="seuemail@dominio.com"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-mono shadow-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Senha / Senha de App</label>
            <input
              type="password"
              placeholder="Senha do e-mail ou App Password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-mono shadow-sm"
              required
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-md shadow-indigo-500/25 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Salvar Conta SMTP
          </button>
        </div>
      </form>

      {/* Registered Accounts List */}
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-sm transition-colors">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Contas Cadastradas ({accounts.length})
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">E-mail de Teste:</span>
            <input
              type="email"
              placeholder="seu-email-pessoal@gmail.com"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              className="p-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs font-mono shadow-sm"
            />
          </div>
        </div>

        <div className="space-y-3">
          {accounts.map((acc) => (
            <div key={acc.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                    {acc.name} <span className="text-slate-400 font-normal">({acc.fromName})</span>
                  </h3>
                  <p className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{acc.user} &bull; {acc.host}:{acc.port}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestSMTP(acc)}
                    disabled={testingId === acc.id}
                    className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    {testingId === acc.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                    Testar Conexão
                  </button>
                  <button onClick={() => handleRemoveAccount(acc.id)} className="p-1.5 text-slate-400 hover:text-rose-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {testResult && testResult.id === acc.id && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${testResult.success ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                  {testResult.message}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
