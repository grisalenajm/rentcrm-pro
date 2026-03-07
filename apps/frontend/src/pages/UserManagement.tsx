import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUserPreferences } from '../context/UserPreferencesContext';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = { name: '', email: '', role: 'gestor', password: '' };

const ROLE_COLORS: Record<string, string> = {
  admin:  'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  gestor: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  viewer: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
};
const ROLE_COLORS_LIGHT: Record<string, string> = {
  admin:  'bg-purple-100 text-purple-700 border border-purple-200',
  gestor: 'bg-blue-100 text-blue-700 border border-blue-200',
  viewer: 'bg-slate-100 text-slate-600 border border-slate-200',
};

export default function UserManagement() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const { theme } = useUserPreferences();
  const dark = theme === 'dark';
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (me?.role !== 'admin') return <Navigate to="/" />;

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.put(`/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setEditing(null);
      setShowForm(false);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/users/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => api.put(`/users/${id}/reset-password`),
    onSuccess: (res) => {
      setTempPassword(res.data.tempPassword);
      setCopied(false);
    },
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, role: u.role, password: '' });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = editing
      ? { name: form.name, email: form.email, role: form.role, ...(form.password ? { password: form.password } : {}) }
      : form;
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const handleResetPassword = (u: User) => {
    if (!window.confirm(t('users.resetPasswordConfirm'))) return;
    resetPasswordMutation.mutate(u.id);
  };

  const handleToggleActive = (u: User) => {
    const msg = u.isActive ? t('users.confirmDeactivate') : t('users.confirmActivate');
    if (!window.confirm(msg)) return;
    toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive });
  };

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
    }
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const bg = dark ? 'bg-slate-950 text-white' : 'bg-gray-50 text-gray-900';
  const card = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200';
  const input = dark
    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-emerald-500';
  const label = dark ? 'text-slate-300' : 'text-gray-700';
  const muted = dark ? 'text-slate-400' : 'text-gray-500';
  const rowHover = dark ? 'hover:bg-slate-800/50' : 'hover:bg-gray-50';
  const overlay = dark ? 'bg-slate-950/80' : 'bg-gray-900/60';
  const modal = dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200';
  const roleColors = dark ? ROLE_COLORS : ROLE_COLORS_LIGHT;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className={`p-6 min-h-screen ${bg}`}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('users.title')}</h1>
          <p className={`text-sm mt-1 ${muted}`}>{users.length} {t('users.registered')}</p>
        </div>
        <button onClick={openCreate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold transition-colors text-white">
          + {t('users.new')}
        </button>
      </div>

      {isLoading ? (
        <div className={`text-center py-20 ${muted}`}>{t('common.loading')}</div>
      ) : users.length === 0 ? (
        <div className={`text-center py-20 ${muted}`}>{t('common.noData')}</div>
      ) : (
        <div className={`rounded-xl border ${card} overflow-hidden`}>
          <table className="w-full">
            <thead>
              <tr className={`border-b ${dark ? 'border-slate-800 text-slate-400' : 'border-gray-200 text-gray-500'} text-xs uppercase tracking-wider`}>
                <th className="px-4 py-3 text-left">{t('common.name')}</th>
                <th className="px-4 py-3 text-left">{t('common.email')}</th>
                <th className="px-4 py-3 text-left">{t('users.role')}</th>
                <th className="px-4 py-3 text-left">{t('common.status')}</th>
                <th className="px-4 py-3 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={`border-b ${dark ? 'border-slate-800/50' : 'border-gray-100'} ${rowHover} transition-colors`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${dark ? 'bg-emerald-600/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-sm">{u.name}</span>
                      {u.id === me?.id && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${dark ? 'bg-slate-700 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>yo</span>
                      )}
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-sm ${muted}`}>{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleColors[u.role] ?? roleColors.viewer}`}>
                      {t(`users.roles.${u.role}` as any) || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      u.isActive
                        ? dark ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : dark ? 'bg-red-500/20 text-red-400 border border-red-500/30'     : 'bg-red-100 text-red-600 border border-red-200'
                    }`}>
                      {u.isActive ? t('users.active') : t('users.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(u)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${dark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                        {t('common.edit')}
                      </button>
                      <button onClick={() => handleResetPassword(u)}
                        disabled={resetPasswordMutation.isPending}
                        className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${dark ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300' : 'bg-amber-50 hover:bg-amber-100 text-amber-700'}`}>
                        {t('users.resetPassword')}
                      </button>
                      {u.id !== me?.id && (
                        <button onClick={() => handleToggleActive(u)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                            u.isActive
                              ? dark ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300'         : 'bg-red-50 hover:bg-red-100 text-red-600'
                              : dark ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                          }`}>
                          {u.isActive ? t('users.deactivate') : t('users.activate')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create / Edit */}
      {showForm && (
        <div className={`fixed inset-0 ${overlay} flex items-center justify-center z-50 p-4`}>
          <div className={`w-full max-w-md rounded-xl border ${modal} p-6 shadow-2xl`}>
            <h2 className="text-lg font-bold mb-5">
              {editing ? t('users.editUser') : t('users.newUser')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${label}`}>{t('common.name')}</label>
                <input value={form.name} onChange={f('name')} required
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${input}`} />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${label}`}>{t('common.email')}</label>
                <input type="email" value={form.email} onChange={f('email')} required
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${input}`} />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${label}`}>{t('users.role')}</label>
                <select value={form.role} onChange={f('role')} required
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${input}`}>
                  <option value="admin">{t('users.roles.admin')}</option>
                  <option value="gestor">{t('users.roles.gestor')}</option>
                  <option value="viewer">{t('users.roles.viewer')}</option>
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${label}`}>{t('users.password')}</label>
                <input type="password" value={form.password} onChange={f('password')}
                  required={!editing} minLength={8}
                  placeholder={editing ? '(dejar vacío para no cambiar)' : ''}
                  className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors ${input}`} />
              </div>
              {(createMutation.isError || updateMutation.isError) && (
                <p className="text-red-400 text-sm">
                  {(createMutation.error as any)?.response?.data?.message || (updateMutation.error as any)?.response?.data?.message || 'Error'}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isSaving}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors">
                  {isSaving ? t('common.saving') : t('common.save')}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${dark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Temporary password */}
      {tempPassword && (
        <div className={`fixed inset-0 ${overlay} flex items-center justify-center z-50 p-4`}>
          <div className={`w-full max-w-sm rounded-xl border ${modal} p-6 shadow-2xl`}>
            <h2 className="text-lg font-bold mb-2">{t('users.tempPassword')}</h2>
            <p className={`text-sm mb-4 ${muted}`}>
              {t('users.resetPasswordConfirm').replace('¿', '').replace('?', '')}
            </p>
            <div className={`flex items-center gap-2 p-3 rounded-lg font-mono text-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-gray-100 border border-gray-200'}`}>
              <span className="flex-1 select-all">{tempPassword}</span>
              <button onClick={handleCopy}
                className={`text-xs px-2 py-1 rounded transition-colors ${dark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-white hover:bg-gray-50 border border-gray-300'}`}>
                {copied ? '✓' : t('users.copyPassword')}
              </button>
            </div>
            <button onClick={() => setTempPassword(null)}
              className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-semibold text-white transition-colors">
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
