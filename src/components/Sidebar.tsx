'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Send, Mail, Settings, Server, ScrollText, Sparkles, ShieldCheck, X, Users, Webhook as WebhookIcon, Key } from 'lucide-react';
import { getActiveUser, hasPermission } from '@/lib/auth-store';
import { UserAccount } from '@/lib/auth-types';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  useEffect(() => {
    setCurrentUser(getActiveUser());
  }, []);

  const handleNavClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const showWaDisparador = hasPermission(currentUser, 'module_whatsapp_disparador');
  const showWaConfig = hasPermission(currentUser, 'module_whatsapp_config');
  const showWaLogs = hasPermission(currentUser, 'module_whatsapp_logs');
  const showEmailDisparador = hasPermission(currentUser, 'module_email_disparador');
  const showEmailConfig = hasPermission(currentUser, 'module_email_config');
  const showUsersAdmin = hasPermission(currentUser, 'module_users_admin');
  const showIntegrations = hasPermission(currentUser, 'module_integrations');

  const navContent = (
    <div className="flex flex-col justify-between h-full p-5 select-none">
      <div className="space-y-8">
        {/* Brand Header (Coursue Style) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 px-1 py-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm tracking-tight flex items-center gap-1.5">
                AllWhatsPy <span className="text-[9px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-mono font-bold">PRO</span>
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">WhatsApp & E-mail Hub</p>
            </div>
          </div>

          {/* Close button on Mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className="space-y-6">
          {/* WhatsApp Module */}
          {(showWaDisparador || showWaConfig || showWaLogs) && (
            <div className="space-y-1.5">
              <p className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Módulo WhatsApp
              </p>

              {showWaDisparador && (
                <Link
                  href="/disparador"
                  onClick={handleNavClick}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    pathname === '/disparador'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Send className="w-4 h-4" /> Disparador WhatsApp
                </Link>
              )}

              {showWaConfig && (
                <Link
                  href="/configuracoes"
                  onClick={handleNavClick}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    pathname === '/configuracoes'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Settings className="w-4 h-4" /> Configurações WhatsApp
                </Link>
              )}

              {showWaLogs && (
                <Link
                  href="/logs"
                  onClick={handleNavClick}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    pathname === '/logs'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <ScrollText className="w-4 h-4" /> Logs WhatsApp
                </Link>
              )}
            </div>
          )}

          {/* Email Module */}
          {(showEmailDisparador || showEmailConfig) && (
            <div className="space-y-1.5">
              <p className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Módulo E-mail
              </p>

              {showEmailDisparador && (
                <Link
                  href="/disparador-email"
                  onClick={handleNavClick}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    pathname === '/disparador-email'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Mail className="w-4 h-4" /> Disparador de E-mail
                </Link>
              )}

              {showEmailConfig && (
                <Link
                  href="/configuracoes-email"
                  onClick={handleNavClick}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    pathname === '/configuracoes-email'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Server className="w-4 h-4" /> Servidores SMTP
                </Link>
              )}
            </div>
          )}

          {/* Integrations Module */}
          {showIntegrations && (
            <div className="space-y-1.5">
              <p className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Desenvolvedor / CRM
              </p>

              <Link
                href="/integracoes"
                onClick={handleNavClick}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  pathname === '/integracoes'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <WebhookIcon className="w-4 h-4" /> APIs & Webhooks
              </Link>
            </div>
          )}

          {/* Admin Management Section */}
          {showUsersAdmin && (
            <div className="space-y-1.5">
              <p className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Administração
              </p>

              <Link
                href="/usuarios"
                onClick={handleNavClick}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  pathname === '/usuarios'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-4 h-4" /> Gestão de Usuários
              </Link>
            </div>
          )}
        </nav>
      </div>

      {/* Footer Info (Coursue Style Card) */}
      <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-slate-950 border border-indigo-100 dark:border-slate-800 text-xs space-y-1.5 mt-auto">
        <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="w-4 h-4" /> Multi-Canal
          </span>
          <span className="text-[10px] text-slate-400 font-mono">v2.5</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
          Painel de automação de marketing com controle de permissões.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed) */}
      <aside className="hidden md:flex w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 flex-col min-h-screen transition-colors shadow-sm shrink-0">
        {navContent}
      </aside>

      {/* Mobile Slide-Over Drawer Overlay */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Sliding Sidebar Panel */}
          <div className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 shadow-2xl z-10 flex flex-col h-full">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
