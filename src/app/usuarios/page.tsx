'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Key, Trash2, Edit3, CheckCircle2, Lock, Sparkles, Check, X } from 'lucide-react';
import { UserAccount, PermissionKey, ALL_PERMISSIONS, UserRole } from '@/lib/auth-types';
import { getActiveUser } from '@/lib/auth-store';

export default function UsuariosPage() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);

  // Form State
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('user');
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionKey[]>([
    'module_whatsapp_disparador',
    'module_email_disparador',
    'can_start_campaign',
  ]);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUser(getActiveUser());
    void fetch('/api/users', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setUsers(data.users || []);
      });
  }, []);

  const togglePermission = (key: PermissionKey) => {
    if (selectedPermissions.includes(key)) {
      setSelectedPermissions(selectedPermissions.filter((k) => k !== key));
    } else {
      setSelectedPermissions([...selectedPermissions, key]);
    }
  };

  const handleSelectAllModulePermissions = () => {
    const moduleKeys = ALL_PERMISSIONS.map((p) => p.key);
    setSelectedPermissions(moduleKeys);
  };

  const handleClearAllPermissions = () => {
    setSelectedPermissions([]);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      alert('Já existe um usuário cadastrado com este e-mail.');
      return;
    }

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role, permissions: selectedPermissions }),
    });
    const data = await response.json();
    if (!response.ok || !data.user) {
      alert(data.error || 'Não foi possível criar o usuário.');
      return;
    }
    setUsers((current) => [...current, data.user]);

    setName('');
    setEmail('');
    setPassword('');
    alert(`Usuário [${name}] criado com sucesso!`);
  };

  const handleToggleUserRole = async (userId: string) => {
    const existing = users.find((user) => user.id === userId);
    if (!existing) return;
    const nextRole: UserRole = existing.role === 'admin' ? 'user' : 'admin';
    const response = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, role: nextRole, permissions: existing.permissions }),
    });
    const data = await response.json();
    if (!response.ok) return alert(data.error || 'Não foi possível atualizar o usuário.');
    setUsers((current) => current.map((user) => (user.id === userId ? data.user : user)));
  };

  const handleToggleUserPermission = async (userId: string, permKey: PermissionKey) => {
    const existing = users.find((user) => user.id === userId);
    if (!existing) return;
    const nextPermissions = existing.permissions.includes(permKey)
      ? existing.permissions.filter((permission) => permission !== permKey)
      : [...existing.permissions, permKey];
    const response = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, role: existing.role, permissions: nextPermissions }),
    });
    const data = await response.json();
    if (!response.ok) return alert(data.error || 'Não foi possível atualizar a permissão.');
    setUsers((current) => current.map((user) => (user.id === userId ? data.user : user)));
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (confirm(`Deseja excluir permanentemente o usuário [${userName}]?`)) {
      const response = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId }),
      });
      const data = await response.json();
      if (!response.ok) return alert(data.error || 'Não foi possível excluir o usuário.');
      setUsers((current) => current.filter((user) => user.id !== userId));
    }
  };

  const modulePermissions = ALL_PERMISSIONS.filter((p) => p.category === 'módulo');
  const actionPermissions = ALL_PERMISSIONS.filter((p) => p.category === 'ação');

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
          <Users className="w-7 h-7 text-indigo-600 dark:text-indigo-400" /> Gestão de Usuários & Controle de Acesso (RBAC)
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
          Crie contas para sua equipe e selecione individualmente quais abas e quais botões cada usuário tem permissão para acessar.
        </p>
      </div>

      {/* Grid: Create User Form + User List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Create User Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleCreateUser} className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-6 shadow-sm transition-colors">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Cadastrar Novo Usuário
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  placeholder="ex: João Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">E-mail de Acesso</label>
                <input
                  type="email"
                  placeholder="joao@suaempresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Senha de Acesso</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={12}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-indigo-500 shadow-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Perfil de Acesso</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:border-indigo-500 shadow-sm"
                >
                  <option value="user">👤 Usuário Operador (Permissões Personalizadas)</option>
                  <option value="admin">👑 Administrador Total (Todas Permissões)</option>
                </select>
              </div>

              {/* Permission Matrix Checkboxes (Only if role is user) */}
              {role === 'user' && (
                <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Matriz de Permissões</span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button type="button" onClick={handleSelectAllModulePermissions} className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                        Marcar Tudo
                      </button>
                      <span className="text-slate-300">|</span>
                      <button type="button" onClick={handleClearAllPermissions} className="text-slate-400 hover:underline font-bold">
                        Desmarcar
                      </button>
                    </div>
                  </div>

                  {/* Modules Permissions */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Módulos & Abas Permitidos</p>
                    <div className="space-y-1.5">
                      {modulePermissions.map((perm) => (
                        <label key={perm.key} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 text-xs cursor-pointer hover:border-indigo-500/40">
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(perm.key)}
                            onChange={() => togglePermission(perm.key)}
                            className="rounded-md border-slate-300 text-indigo-600 focus:ring-0"
                          />
                          <span className="font-bold text-slate-800 dark:text-slate-200">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Action Capabilities Permissions */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Botões & Ações Específicas</p>
                    <div className="space-y-1.5">
                      {actionPermissions.map((perm) => (
                        <label key={perm.key} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 text-xs cursor-pointer hover:border-indigo-500/40">
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(perm.key)}
                            onChange={() => togglePermission(perm.key)}
                            className="rounded-md border-slate-300 text-indigo-600 focus:ring-0"
                          />
                          <span className="font-bold text-slate-800 dark:text-slate-200">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> Criar Usuário
            </button>
          </form>
        </div>

        {/* Right Column: Registered Users List & Matrix Manager (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 space-y-6 shadow-sm transition-colors">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Usuários Cadastrados ({users.length})
            </h2>

            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center text-sm border border-indigo-500/20">
                        {user.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                          {user.name}
                          {user.role === 'admin' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              👑 ADMIN
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              OPERADOR
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{user.email} &bull; Criado em {user.createdAt}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleUserRole(user.id)}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
                        title="Alternar entre Admin e Operador"
                      >
                        {user.role === 'admin' ? 'Tornar Operador' : 'Tornar Admin'}
                      </button>

                      {user.id !== 'admin_default_id' && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                          title="Excluir usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Individual Permissions Checkboxes List */}
                  {user.role !== 'admin' && (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Permissões de Acesso Ativas:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {ALL_PERMISSIONS.map((perm) => {
                          const hasPerm = user.permissions ? user.permissions.includes(perm.key) : false;
                          return (
                            <label
                              key={perm.key}
                              onClick={() => handleToggleUserPermission(user.id, perm.key)}
                              className={`cursor-pointer p-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-between ${
                                hasPerm
                                  ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500/30 text-indigo-900 dark:text-indigo-300'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60'
                              }`}
                            >
                              <span className="truncate">{perm.label}</span>
                              {hasPerm ? <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" /> : <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
