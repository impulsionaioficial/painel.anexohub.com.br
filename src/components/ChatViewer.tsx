'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Search, Send, RefreshCw, Phone, CheckCheck, Terminal, AlertCircle, Smartphone } from 'lucide-react';
import { getStoredConfig } from '@/lib/evolution-store';

interface InstanceItem {
  name: string;
  status: 'open' | 'connecting' | 'close';
  owner?: string;
}

interface ChatItem {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

interface MessageItem {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: string;
}

export default function ChatViewer() {
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [replyText, setReplyText] = useState<string>('');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const [loadingInstances, setLoadingInstances] = useState<boolean>(false);
  const [loadingChats, setLoadingChats] = useState<boolean>(false);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [sendingReply, setSendingReply] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [showDebug, setShowDebug] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize default instance from stored config
  useEffect(() => {
    const config = getStoredConfig();
    setSelectedInstance(config.instanceName || 'teste');
  }, []);

  // Fetch all instances connected on the VPS
  const fetchInstances = async () => {
    setLoadingInstances(true);
    const config = getStoredConfig();

    try {
      const res = await fetch('/api/evolution/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
        }),
      });

      const data = await res.json();
      if (data.success && data.instances) {
        setInstances(data.instances);
        if (!selectedInstance && data.instances.length > 0) {
          const firstInst = data.instances[0].name;
          setSelectedInstance(firstInst);
          fetchChats(firstInst);
        }
      }
    } catch {
      // Ignore network hiccup
    } finally {
      setLoadingInstances(false);
    }
  };

  // Fetch chats for a specific instance
  const fetchChats = async (instName?: string) => {
    setLoadingChats(true);
    const config = getStoredConfig();
    const activeInst = instName || selectedInstance || config.instanceName;

    try {
      const res = await fetch('/api/evolution/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          instanceName: activeInst,
        }),
      });

      const data = await res.json();
      if (data.success && data.chats) {
        setChats(data.chats);
        if (data.chats.length > 0) {
          setSelectedChat(data.chats[0]);
          fetchMessages(data.chats[0].id, activeInst);
        } else {
          setSelectedChat(null);
          setMessages([]);
        }
      } else {
        setChats([]);
        setSelectedChat(null);
        setMessages([]);
      }
    } catch {
      setChats([]);
    } finally {
      setLoadingChats(false);
    }
  };

  // Fetch messages for a chat within a specific instance
  const fetchMessages = async (remoteJid: string, instName?: string) => {
    setLoadingMessages(true);
    setDebugLogs([]);
    const config = getStoredConfig();
    const activeInst = instName || selectedInstance || config.instanceName;

    try {
      const res = await fetch('/api/evolution/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          instanceName: activeInst,
          remoteJid,
        }),
      });

      const data = await res.json();
      if (data.debugLogs) {
        setDebugLogs(data.debugLogs);
      }

      if (data.success && data.messages) {
        setMessages(data.messages);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    fetchInstances();
    const config = getStoredConfig();
    fetchChats(config.instanceName);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInstanceChange = (newInst: string) => {
    if (newInst === selectedInstance) return;
    setSelectedInstance(newInst);
    setSelectedChat(null);
    setMessages([]);
    fetchChats(newInst);
  };

  const handleSelectChat = (chat: ChatItem) => {
    if (selectedChat?.id === chat.id) return;
    setSelectedChat(chat);
    setMessages([]);
    fetchMessages(chat.id, selectedInstance);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedChat) return;

    setSendingReply(true);
    const config = getStoredConfig();
    const activeInst = selectedInstance || config.instanceName;
    const currentText = replyText.trim();
    setReplyText('');

    try {
      const res = await fetch('/api/evolution/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          instanceName: activeInst,
          phone: selectedChat.id || selectedChat.phone,
          message: currentText,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const newMsg: MessageItem = {
          id: `sent_${Date.now()}`,
          fromMe: true,
          text: currentText,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, newMsg]);
      } else {
        alert(`Erro ao enviar resposta: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Falha no envio: ${err.message}`);
    } finally {
      setSendingReply(false);
    }
  };

  const filteredChats = chats.filter(
    (c) =>
      c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.phone.includes(searchFilter) ||
      c.lastMessage.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-xl grid grid-cols-1 lg:grid-cols-12 min-h-[640px] transition-colors">
      {/* Left Column: Instance Selector & Chats List (4 cols) */}
      <div className={`lg:col-span-4 border-r border-slate-200 dark:border-slate-800 flex-col bg-slate-50/50 dark:bg-slate-950/60 ${selectedChat ? 'hidden lg:flex' : 'flex'}`}>
        
        {/* Header Controls */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 space-y-3">
          {/* Instance Selector Dropdown */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <Smartphone className="w-3.5 h-3.5" /> Instância WhatsApp
              </span>
              <button
                onClick={fetchInstances}
                disabled={loadingInstances}
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex items-center gap-1 font-semibold"
                title="Atualizar lista de instâncias da VPS"
              >
                <RefreshCw className={`w-3 h-3 ${loadingInstances ? 'animate-spin' : ''}`} /> Atualizar
              </button>
            </div>

            <div className="relative">
              <select
                value={selectedInstance}
                onChange={(e) => handleInstanceChange(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none shadow-sm"
              >
                {instances.length === 0 ? (
                  <option value={selectedInstance} className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">
                    {selectedInstance || 'Instância Padrão'}
                  </option>
                ) : (
                  instances.map((inst) => (
                    <option key={inst.name} value={inst.name} className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200">
                      {inst.name} ({inst.status === 'open' ? '🟢 Conectada' : '🔴 Desconectada'})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Conversations Title & Search Bar */}
          <div className="flex items-center justify-between pt-1">
            <h2 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" /> Conversas ({chats.length})
            </h2>
            <button
              onClick={() => fetchChats(selectedInstance)}
              disabled={loadingChats}
              className="p-1.5 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs transition-colors border border-slate-200 dark:border-slate-800 shadow-sm"
              title="Atualizar Conversas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingChats ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por nome ou número..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
            />
          </div>
        </div>

        {/* Chats Feed */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-200/60 dark:divide-slate-800/50">
          {filteredChats.length === 0 ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs px-4 space-y-1 font-medium">
              <p>{loadingChats ? 'Carregando conversas da instância...' : 'Nenhuma conversa encontrada nesta instância.'}</p>
              {!loadingChats && (
                <p className="text-[11px] text-slate-400 dark:text-slate-600">Alterne a instância no menu acima para carregar outros chats.</p>
              )}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isSelected = selectedChat?.id === chat.id;
              return (
                <div
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className={`p-3.5 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 border-l-4 border-l-indigo-600'
                      : 'hover:bg-slate-100/70 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-extrabold text-white text-xs shrink-0 shadow-sm">
                      {chat.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="truncate space-y-0.5">
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">{chat.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{chat.lastMessage}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <span className="text-[10px] text-slate-400 font-medium">{chat.timestamp}</span>
                    {chat.unreadCount > 0 && (
                      <span className="block w-4 h-4 rounded-full bg-indigo-600 text-white font-extrabold text-[10px] text-center leading-4 ml-auto shadow-sm">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Chat Conversation Window (8 cols) */}
      <div className={`lg:col-span-8 flex-col bg-white dark:bg-slate-900/40 ${selectedChat ? 'flex' : 'hidden lg:flex'}`}>
        {selectedChat ? (
          <>
            {/* Chat Top Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/80 flex items-center justify-between backdrop-blur-md">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedChat(null)}
                  className="lg:hidden px-2.5 py-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs border border-slate-200 dark:border-slate-700"
                >
                  ← Voltar
                </button>
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center font-extrabold text-white text-sm shadow-md shadow-indigo-500/20 shrink-0">
                  {selectedChat.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{selectedChat.name}</h3>
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono font-bold flex items-center gap-1">
                    <Phone className="w-3 h-3" /> +{selectedChat.phone}
                    <span className="text-slate-400 dark:text-slate-500 font-sans font-normal ml-2">({selectedInstance})</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-colors flex items-center gap-1 ${
                    showDebug
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700'
                  }`}
                  title="Ver logs da API"
                >
                  <Terminal className="w-3.5 h-3.5" /> Debug VPS
                </button>
                <button
                  onClick={() => fetchMessages(selectedChat.id, selectedInstance)}
                  disabled={loadingMessages}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMessages ? 'animate-spin' : ''}`} /> Atualizar
                </button>
              </div>
            </div>

            {/* Diagnostic VPS Log Panel */}
            {showDebug && debugLogs.length > 0 && (
              <div className="p-3 bg-slate-950 border-b border-slate-800 font-mono text-[10px] text-amber-300 max-h-36 overflow-y-auto space-y-1">
                <p className="font-bold text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Logs HTTP de Comunicação com a Evolution API (Instância: {selectedInstance}):
                </p>
                {debugLogs.map((logLine, i) => (
                  <div key={i} className="leading-tight break-all border-b border-slate-900 pb-0.5">
                    {logLine}
                  </div>
                ))}
              </div>
            )}

            {/* Messages Scroll Feed */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[440px] bg-slate-50/60 dark:bg-slate-950/40">
              {loadingMessages ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-xs font-medium">
                  Carregando histórico de mensagens da instância {selectedInstance}...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Nenhuma mensagem registrada nesta conversa.</p>
                  <button
                    onClick={() => setShowDebug(true)}
                    className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 mx-auto font-mono"
                  >
                    <Terminal className="w-3 h-3" /> Clique aqui para inspecionar os logs de resposta da VPS
                  </button>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.fromMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-md p-3.5 text-xs space-y-1 shadow-sm ${
                        msg.fromMe
                          ? 'bg-indigo-600 text-white font-medium rounded-2xl rounded-br-none shadow-indigo-500/10'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-2xl rounded-bl-none'
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      <div className={`flex items-center justify-end gap-1 text-[10px] ${msg.fromMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                        <span>{msg.timestamp}</span>
                        {msg.fromMe && <CheckCheck className="w-3.5 h-3.5 text-indigo-200" />}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Input Bar */}
            <form onSubmit={handleSendReply} className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 flex gap-2">
              <input
                type="text"
                placeholder={`Responder para ${selectedChat.name} via ${selectedInstance}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
              />
              <button
                type="submit"
                disabled={sendingReply || !replyText.trim()}
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {sendingReply ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-24 text-slate-400 dark:text-slate-500 text-xs space-y-2 font-medium">
            <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            <p>Selecione uma conversa à esquerda para visualizar o histórico de mensagens da instância <strong className="text-slate-700 dark:text-slate-300">{selectedInstance}</strong>.</p>
          </div>
        )}
      </div>
    </div>
  );
}
