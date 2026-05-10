'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/AuthProvider';
import { ShieldAlert, UserPlus, Mail, Lock, User, Trash2, Loader2 } from 'lucide-react';

interface Perfil {
  id: string;
  nome: string;
  role: string;
  created_at: string;
}

export default function EquipaPage() {
  const { userProfile } = useAuth();
  const [equipa, setEquipa] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ nome: '', email: '', password: '', role: 'membro' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchEquipa();
  }, []);

  const fetchEquipa = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .order('created_at', { ascending: true });
      
    if (!error && data) {
      setEquipa(data);
    }
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar utilizador');
      }

      // Refresh list and close modal
      await fetchEquipa();
      setIsModalOpen(false);
      setFormData({ nome: '', email: '', password: '', role: 'membro' });
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  if (userProfile?.role !== 'admin') {
    return (
      <div className="p-8 max-w-[1200px] mx-auto text-center">
        <ShieldAlert size={48} className="mx-auto text-red-500 mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
        <p className="text-gray-400">Apenas administradores podem aceder a esta página.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 md:space-y-8 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <ShieldAlert size={28} className="text-indigo-400" />
            Gestão da Equipa
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gira os acessos e permissões dos utilizadores do sistema.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary py-2.5 px-5 flex items-center gap-2 text-sm shrink-0"
        >
          <UserPlus size={18} />
          Adicionar Membro
        </button>
      </header>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs uppercase bg-white/[0.02] text-gray-500">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Nome</th>
                <th className="px-6 py-4 font-semibold tracking-wider">ID Único</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Permissão</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Registado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center">
                    <Loader2 size={24} className="animate-spin text-indigo-500 mx-auto" />
                  </td>
                </tr>
              ) : equipa.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Nenhum membro encontrado.
                  </td>
                </tr>
              ) : (
                equipa.map((membro) => (
                  <tr key={membro.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${membro.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {membro.nome.charAt(0).toUpperCase()}
                      </div>
                      {membro.nome}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs font-mono">{membro.id.substring(0, 8)}...</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${membro.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                        {membro.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(membro.created_at).toLocaleDateString('pt-PT')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Adicionar Utilizador */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-md bg-dark-surface border border-white/10 rounded-2xl shadow-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Novo Membro da Equipa</h2>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-400 font-bold uppercase tracking-widest mb-1.5 px-1">Nome</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData(p => ({ ...p, nome: e.target.value }))}
                    className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    placeholder="João Silva"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 font-bold uppercase tracking-widest mb-1.5 px-1">E-mail (Login)</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                    className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    placeholder="joao@agencia.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 font-bold uppercase tracking-widest mb-1.5 px-1">Palavra-passe Inicial</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                    className="w-full bg-black/30 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    placeholder="Min. 6 caracteres"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 font-bold uppercase tracking-widest mb-1.5 px-1">Permissão</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/30 transition-all"
                >
                  <option value="membro" className="bg-gray-900">Membro Normal (Acesso ao CRM)</option>
                  <option value="admin" className="bg-gray-900">Administrador (Pode gerir equipa)</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="btn-primary py-2.5 px-6 flex items-center gap-2 text-sm"
                >
                  {formLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  Criar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
