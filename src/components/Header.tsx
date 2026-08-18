'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, Sun, Moon, Menu, Sparkles, User, LogOut } from 'lucide-react';
import { getActiveUser, setActiveUser } from '@/lib/auth-store';
import { UserAccount } from '@/lib/auth-types';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export default function Header({ onToggleMobileMenu }: HeaderProps) {
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  useEffect(() => {
    setCurrentUser(getActiveUser());

    try {
      const savedTheme = localStorage.getItem('awp_theme_mode');
      if (savedTheme === 'light') {
        setIsDarkTheme(false);
        document.documentElement.classList.remove('dark');
      } else {
        setIsDarkTheme(true);
        document.documentElement.classList.add('dark');
      }
    } catch {
      // Default dark
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkTheme;
    setIsDarkTheme(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('awp_theme_mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('awp_theme_mode', 'light');
    }
  };

  const handleLogout = async () => {
    if (confirm('Deseja encerrar sua sessão?')) {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
      setActiveUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <header className="h-16 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800/80 px-4 md:px-6 flex items-center justify-between backdrop-blur-md sticky top-0 z-40 select-none transition-colors">
      {/* Mobile Menu Button & Brand Header */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Abrir menu de navegação"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="md:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-slate-900 dark:text-slate-100 text-xs tracking-tight">
            AllWhatsPy <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-mono">PRO</span>
          </span>
        </div>
      </div>

      {/* Right User & Tools Bar */}
      <div className="flex items-center gap-3">
        {/* User Badge */}
        {currentUser && (
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs shadow-sm">
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-extrabold text-[10px] flex items-center justify-center">
              {currentUser.name.substring(0, 1).toUpperCase()}
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-200 hidden sm:inline">{currentUser.name}</span>
            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              {currentUser.role === 'admin' ? 'ADMIN' : 'OPERADOR'}
            </span>
          </div>
        )}

        {/* Refresh Page State */}
        <button
          onClick={() => window.location.reload()}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
          title="Atualizar página"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Theme Toggle Button (Light/Dark) */}
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-600 dark:text-amber-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors flex items-center justify-center"
          title={isDarkTheme ? 'Alternar para Modo Claro ☀️' : 'Alternar para Modo Escuro 🌙'}
        >
          {isDarkTheme ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="p-2 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
          title="Sair da conta"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
