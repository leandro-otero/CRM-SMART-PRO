'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { formatCurrency } from '@/lib/servicePortfolio';
import { Users, Plus, X, Search, Phone, Mail, MapPin, MessageCircle, ChevronDown, ChevronUp, Trash2, FileText, AlertTriangle, RefreshCw, Edit2 } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';

interface Cliente {
  id: string; nome_empresa: string; responsavel: string; cargo: string;
  telefone: string; whatsapp: string; email: string; endereco: string;
  segmento: string; cnpj_nif: string; data_inicio: string; status: string;
  notas: string; created_at: string;
}

interface Servico {
  id: string; cliente_id: string; nome_servico: string; tipo: string;
  valor: number; status: string; data_vencimento: string;
}

export default function ClientesPage() {
  const { showToast } = useToast();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; nome: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome_empresa: '', responsavel: '', cargo: '', telefone: '', whatsapp: '', email: '', endereco: '', segmento: '', cnpj_nif: '', notas: '' });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, sRes] = await Promise.all([
        supabase.from('clientes').select('*').order('created_at', { ascending: false }),
        supabase.from('servicos_contratados').select('*'),
      ]);
      if (cRes.error) throw cRes.error;
      if (sRes.error) throw sRes.error;
      setClientes(cRes.data || []);
      setServicos(sRes.data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar clientes';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      const { error: updateErr } = await supabase.from('clientes').update(form).eq('id', editingId);
      if (updateErr) {
        setError(`Erro ao atualizar: ${updateErr.message}`);
        return;
      }
      await supabase.from('atividade_log').insert({ entidade_tipo: 'cliente', acao: `Cliente atualizado: ${form.nome_empresa}`, detalhes: `ID: ${editingId}` });
      showToast(`Cliente "${form.nome_empresa}" atualizado!`, 'success');
    } else {
      const { error: insertErr } = await supabase.from('clientes').insert(form);
      if (insertErr) {
        setError(`Erro ao registar: ${insertErr.message}`);
        showToast('Erro ao registar cliente', 'error');
        return;
      }
      await supabase.from('atividade_log').insert({ entidade_tipo: 'cliente', acao: `Novo cliente: ${form.nome_empresa}`, detalhes: `Responsável: ${form.responsavel}` });
      showToast(`Cliente "${form.nome_empresa}" registado!`, 'success');
    }
    
    setShowForm(false);
    setEditingId(null);
    setForm({ nome_empresa: '', responsavel: '', cargo: '', telefone: '', whatsapp: '', email: '', endereco: '', segmento: '', cnpj_nif: '', notas: '' });
    fetchData();
  };

  const handleEdit = (c: Cliente) => {
    setForm({
      nome_empresa: c.nome_empresa || '',
      responsavel: c.responsavel || '',
      cargo: c.cargo || '',
      telefone: c.telefone || '',
      whatsapp: c.whatsapp || '',
      email: c.email || '',
      endereco: c.endereco || '',
      segmento: c.segmento || '',
      cnpj_nif: c.cnpj_nif || '',
      notas: c.notas || ''
    });
    setEditingId(c.id);
    setShowForm(true);
    setExpandedId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteCliente = async (id: string, nome: string) => {
    setDeleteConfirm({ id, nome });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);
    const { error: delErr } = await supabase.from('clientes').delete().eq('id', id);
    if (delErr) {
      setError(`Erro ao remover: ${delErr.message}`);
      return;
    }
    fetchData();
  };

  const filtered = clientes.filter(c => c.nome_empresa.toLowerCase().includes(searchTerm.toLowerCase()) || c.responsavel?.toLowerCase().includes(searchTerm.toLowerCase()));
  const getMRR = (cid: string) => servicos.filter(s => s.cliente_id === cid && s.tipo === 'mensal' && s.status === 'ativo').reduce((a, s) => a + Number(s.valor), 0);
  const totalMRR = clientes.reduce((a, c) => a + getMRR(c.id), 0);

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 md:space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3"><Users size={24} className="text-indigo-400" />Gestão de Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">{clientes.filter(c => c.status === 'ATIVO').length} ativos · MRR: {formatCurrency(totalMRR)}/mês</p>
        </div>
        <button onClick={() => { setEditingId(null); setForm({ nome_empresa: '', responsavel: '', cargo: '', telefone: '', whatsapp: '', email: '', endereco: '', segmento: '', cnpj_nif: '', notas: '' }); setShowForm(!showForm); }} className="btn-primary flex items-center gap-2 text-sm shrink-0"><Plus size={16} />Novo Cliente</button>
      </header>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={18} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-xs text-red-400">✕</button>
        </div>
      )}

      {showForm && (
        <section className="glass-card p-6 animate-slide-up">
          <div className="flex justify-between items-center mb-5"><h2 className="text-lg font-bold text-white">{editingId ? 'Editar Cliente' : 'Registar Cliente'}</h2><button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-white/10 text-gray-400"><X size={18} /></button></div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">Empresa *</label><input required value={form.nome_empresa} onChange={e => setForm({...form, nome_empresa: e.target.value})} className="input-glass w-full" placeholder="Nome da empresa" /></div>
            <div><label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">Responsável</label><input value={form.responsavel} onChange={e => setForm({...form, responsavel: e.target.value})} className="input-glass w-full" placeholder="Nome" /></div>
            <div><label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">Cargo</label><input value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} className="input-glass w-full" placeholder="Gerente, Sócio..." /></div>
            <div><label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">NIF/CNPJ</label><input value={form.cnpj_nif} onChange={e => setForm({...form, cnpj_nif: e.target.value})} className="input-glass w-full" placeholder="PT 123456789" /></div>
            <div><label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">Telefone</label><input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} className="input-glass w-full" placeholder="+351 9XX" /></div>
            <div><label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">WhatsApp</label><input value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} className="input-glass w-full" placeholder="+351 9XX" /></div>
            <div><label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-glass w-full" placeholder="email@empresa.pt" /></div>
            <div><label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">Segmento</label><input value={form.segmento} onChange={e => setForm({...form, segmento: e.target.value})} className="input-glass w-full" placeholder="Gastronomia, Saúde..." /></div>
            <div className="md:col-span-2"><label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">Endereço</label><input value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} className="input-glass w-full" placeholder="Endereço completo" /></div>
            <div className="md:col-span-2"><label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">Notas</label><textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} className="input-glass w-full h-20 resize-none" placeholder="Observações sobre o cliente..." /></div>
            <div className="md:col-span-2 flex gap-3 justify-end"><button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancelar</button><button type="submit" className="btn-primary text-sm">{editingId ? 'Guardar' : 'Registar'}</button></div>
          </form>
        </section>
      )}

      <div className="relative"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" /><input type="text" placeholder="Pesquisar clientes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-glass w-full pl-11" /></div>

      {loading ? <div className="text-center py-16 text-indigo-400 animate-pulse font-bold">A carregar...</div> : filtered.length === 0 ? (
        <div className="text-center py-16"><Users size={48} className="text-gray-700 mx-auto mb-3" /><p className="text-gray-500 font-semibold">Nenhum cliente</p></div>
      ) : (
        <div className="space-y-4">
          {filtered.map(c => {
            const isExp = expandedId === c.id;
            const cs = servicos.filter(s => s.cliente_id === c.id);
            const mrr = getMRR(c.id);
            return (
              <div key={c.id} className="glass-card overflow-hidden">
                <div className="p-4 md:p-5 flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-5 cursor-pointer" onClick={() => setExpandedId(isExp ? null : c.id)}>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center text-lg font-bold text-indigo-300 shrink-0">{c.nome_empresa[0]}</div>
                  <div className="flex-1 min-w-0"><h3 className="font-bold text-gray-100 text-sm md:text-base">{c.nome_empresa}</h3><p className="text-xs text-gray-500 truncate">{c.responsavel || '—'}{c.cargo ? ` · ${c.cargo}` : ''} · {c.segmento || '—'}</p></div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${c.status === 'ATIVO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{c.status}</span>
                  <div className="text-right hidden sm:block"><p className="text-sm font-bold text-emerald-400">{formatCurrency(mrr)}/mês</p><p className="text-[10px] text-gray-500">MRR</p></div>
                  {isExp ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
                </div>
                {isExp && (
                  <div className="border-t border-white/5 p-5 space-y-5 animate-fade-in">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {c.telefone && <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5"><Phone size={14} className="text-gray-400" /><span className="text-sm text-gray-300">{c.telefone}</span></div>}
                      {c.email && <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5"><Mail size={14} className="text-gray-400" /><span className="text-sm text-gray-300 truncate">{c.email}</span></div>}
                      {c.cnpj_nif && <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5"><FileText size={14} className="text-gray-400" /><span className="text-sm text-gray-300">NIF: {c.cnpj_nif}</span></div>}
                      {c.endereco && <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5"><MapPin size={14} className="text-gray-400 shrink-0" /><span className="text-sm text-gray-300 truncate">{c.endereco}</span></div>}
                    </div>
                    {cs.length > 0 && <div><p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Serviços</p>{cs.map(s => <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 mb-2"><div className="flex items-center gap-3"><FileText size={14} className="text-indigo-400" /><span className="text-sm text-gray-200">{s.nome_servico}</span><span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-400 uppercase">{s.tipo}</span></div><span className="text-sm font-bold text-white">{formatCurrency(s.valor)}</span></div>)}</div>}
                    {c.notas && <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5"><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Notas</p><p className="text-sm text-gray-300">{c.notas}</p></div>}
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      {c.whatsapp && <button onClick={e => { e.stopPropagation(); window.open(`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`, '_blank'); }} className="btn-success flex items-center gap-2 text-sm"><MessageCircle size={14} />WhatsApp</button>}
                      <button onClick={e => { e.stopPropagation(); handleEdit(c); }} className="btn-secondary flex items-center gap-2 text-sm"><Edit2 size={14} />Editar</button>
                      <button onClick={e => { e.stopPropagation(); deleteCliente(c.id, c.nome_empresa); }} className="btn-secondary flex items-center gap-2 text-sm text-red-400"><Trash2 size={14} />Remover</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-dark-surface/95 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl backdrop-blur-xl animate-slide-up space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Remover Cliente</h3>
                <p className="text-sm text-gray-400">Esta ação não pode ser revertida.</p>
              </div>
            </div>
            <p className="text-sm text-gray-300">
              Tem a certeza que deseja remover <span className="font-bold text-white">&ldquo;{deleteConfirm.nome}&rdquo;</span> e todos os serviços associados?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={confirmDelete} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 px-5 rounded-xl transition-all text-sm flex items-center gap-2">
                <Trash2 size={14} /> Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
