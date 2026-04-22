'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { formatCurrency } from '@/lib/servicePortfolio';
import { DollarSign, TrendingUp, PieChart, Calendar, AlertTriangle, RefreshCw, Plus, X, Trash2 } from 'lucide-react';

interface Cliente { id: string; nome_empresa: string; status: string; }
interface Servico { id: string; cliente_id: string; nome_servico: string; tipo: string; valor: number; status: string; data_vencimento: string; }
interface Despesa { id: string; descricao: string; valor: number; categoria: string; recorrente: boolean; }

export default function FinanceiroPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDespesaForm, setShowDespesaForm] = useState(false);
  const [formDespesa, setFormDespesa] = useState({ descricao: '', valor: '', categoria: 'Software', recorrente: true });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cR, sR, dR] = await Promise.all([
        supabase.from('clientes').select('id, nome_empresa, status'),
        supabase.from('servicos_contratados').select('*'),
        supabase.from('despesas').select('*'),
      ]);
      if (cR.error) throw cR.error;
      if (sR.error) throw sR.error;
      if (dR.error) throw dR.error;
      setClientes(cR.data || []);
      setServicos(sR.data || []);
      setDespesas(dR.data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados financeiros';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDespesa.descricao || !formDespesa.valor) return;
    
    const { error: insErr } = await supabase.from('despesas').insert({
      descricao: formDespesa.descricao,
      valor: Number(formDespesa.valor),
      categoria: formDespesa.categoria,
      recorrente: formDespesa.recorrente
    });
    
    if (insErr) {
      setError(`Erro ao adicionar despesa: ${insErr.message}`);
      return;
    }
    
    setShowDespesaForm(false);
    setFormDespesa({ descricao: '', valor: '', categoria: 'Software', recorrente: true });
    fetchData();
  };

  const handleDeleteDespesa = async (id: string) => {
    if (!confirm('Remover esta despesa?')) return;
    const { error: delErr } = await supabase.from('despesas').delete().eq('id', id);
    if (delErr) {
      setError(`Erro ao remover despesa: ${delErr.message}`);
      return;
    }
    fetchData();
  };

  const metrics = useMemo(() => {
    const ativos = servicos.filter(s => s.status === 'ativo');
    const mrr = ativos.filter(s => s.tipo === 'mensal').reduce((a, s) => a + Number(s.valor), 0);
    const setupTotal = servicos.filter(s => s.tipo === 'setup').reduce((a, s) => a + Number(s.valor), 0);
    const anualTotal = ativos.filter(s => s.tipo === 'anual').reduce((a, s) => a + Number(s.valor), 0);
    const arr = (mrr * 12) + anualTotal;
    const totalBruto = mrr + Math.round(anualTotal / 12);

    // Real expenses from database instead of hardcoded €150
    const gastosRecorrentes = despesas.filter(d => d.recorrente).reduce((a, d) => a + Number(d.valor), 0);
    const gastos = gastosRecorrentes;
    const lucro = totalBruto - gastos;
    const margem = totalBruto > 0 ? Math.round((lucro / totalBruto) * 100) : 0;

    // Revenue per client
    const receitaPorCliente = clientes.map(c => {
      const cs = servicos.filter(s => s.cliente_id === c.id && s.status === 'ativo');
      const mensal = cs.filter(s => s.tipo === 'mensal').reduce((a, s) => a + Number(s.valor), 0);
      return { nome: c.nome_empresa, mensal, pct: mrr > 0 ? Math.round((mensal / mrr) * 100) : 0 };
    }).filter(c => c.mensal > 0).sort((a, b) => b.mensal - a.mensal);

    // Upcoming payments
    const vencimentos = servicos
      .filter(s => s.data_vencimento && s.status === 'ativo')
      .map(s => {
        const cliente = clientes.find(c => c.id === s.cliente_id);
        return { ...s, clienteNome: cliente?.nome_empresa || 'Desconhecido' };
      })
      .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())
      .slice(0, 8);

    return { mrr, setupTotal, anualTotal, arr, totalBruto, gastos, lucro, margem, receitaPorCliente, vencimentos };
  }, [clientes, servicos, despesas]);

  if (loading) return <div className="flex items-center justify-center h-screen text-indigo-400 font-bold animate-pulse">A carregar dados financeiros...</div>;

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="glass-card p-8 text-center max-w-md space-y-4">
          <AlertTriangle size={48} className="text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Erro de Conexão</h2>
          <p className="text-sm text-gray-400">{error}</p>
          <button onClick={fetchData} className="btn-primary flex items-center gap-2 mx-auto text-sm">
            <RefreshCw size={16} /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 md:space-y-8">
      <header>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <DollarSign size={24} className="text-indigo-400" />
          Relatório Financeiro
        </h1>
        <p className="text-gray-500 text-sm mt-1">{new Date().toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</p>
      </header>

      {/* Revenue Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <FinCard icon={<TrendingUp size={18} />} label="MRR" value={formatCurrency(metrics.mrr)} sub="/mês" color="emerald" />
        <FinCard icon={<DollarSign size={18} />} label="Setups Recebidos" value={formatCurrency(metrics.setupTotal)} sub="total" color="indigo" />
        <FinCard icon={<Calendar size={18} />} label="Receitas Anuais" value={formatCurrency(metrics.anualTotal)} sub="/ano" color="violet" />
        <FinCard icon={<PieChart size={18} />} label="ARR Estimado" value={formatCurrency(metrics.arr)} sub="/ano" color="blue" />
      </section>

      {/* P&L Summary */}
      <section className="glass-card p-6">
        <h2 className="text-lg font-bold text-white mb-4">Resultado do Mês</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="text-center p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Receita Bruta</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1">{formatCurrency(metrics.totalBruto)}</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-red-500/5 border border-red-500/10">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Gastos</p>
            <p className="text-2xl font-extrabold text-red-400 mt-1">{formatCurrency(metrics.gastos)}</p>
            {metrics.gastos === 0 && <p className="text-[10px] text-gray-600 mt-1">Sem despesas registadas</p>}
          </div>
          <div className="text-center p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Lucro ({metrics.margem}%)</p>
            <p className="text-2xl font-extrabold text-indigo-400 mt-1">{formatCurrency(metrics.lucro)}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue per Client */}
        <section className="glass-card p-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <PieChart size={16} className="text-indigo-400" />
            Receita por Cliente
          </h3>
          {metrics.receitaPorCliente.length === 0 ? (
            <p className="text-gray-600 text-sm py-4 text-center">Sem dados de receita</p>
          ) : (
            <div className="space-y-3">
              {metrics.receitaPorCliente.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300 font-medium">{c.nome}</span>
                    <span className="text-gray-400">{formatCurrency(c.mensal)}/mês ({c.pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Payments */}
        <section className="glass-card p-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-amber-400" />
            Próximos Vencimentos
          </h3>
          {metrics.vencimentos.length === 0 ? (
            <p className="text-gray-600 text-sm py-4 text-center">Sem vencimentos registados</p>
          ) : (
            <div className="space-y-3">
              {metrics.vencimentos.map((v, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{v.clienteNome}</p>
                    <p className="text-[11px] text-gray-500">{v.nome_servico} · {v.tipo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{formatCurrency(v.valor)}</p>
                    <p className="text-[10px] text-gray-500">{new Date(v.data_vencimento).toLocaleDateString('pt-PT')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Gestão de Despesas */}
      <section className="glass-card p-6 mt-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-400" />
            Despesas e Custos
          </h3>
          <button onClick={() => setShowDespesaForm(!showDespesaForm)} className="btn-secondary flex items-center gap-2 text-sm">
            <Plus size={16} /> Nova Despesa
          </button>
        </div>

        {showDespesaForm && (
          <form onSubmit={handleAddDespesa} className="bg-white/[0.02] border border-white/5 p-4 rounded-xl mb-6 grid grid-cols-1 md:grid-cols-5 gap-4 animate-slide-up">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400 font-semibold mb-1 block">Descrição</label>
              <input required value={formDespesa.descricao} onChange={e => setFormDespesa({...formDespesa, descricao: e.target.value})} className="input-glass w-full" placeholder="Ex: Assinatura Vercel" />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-semibold mb-1 block">Valor (€)</label>
              <input required type="number" step="0.01" value={formDespesa.valor} onChange={e => setFormDespesa({...formDespesa, valor: e.target.value})} className="input-glass w-full" placeholder="20.00" />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-semibold mb-1 block">Categoria</label>
              <select value={formDespesa.categoria} onChange={e => setFormDespesa({...formDespesa, categoria: e.target.value})} className="input-glass w-full">
                <option value="Software">Software</option>
                <option value="Marketing">Marketing</option>
                <option value="Operacional">Operacional</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-300 h-11 cursor-pointer">
                <input type="checkbox" checked={formDespesa.recorrente} onChange={e => setFormDespesa({...formDespesa, recorrente: e.target.checked})} className="rounded bg-dark-bg border-white/20 text-indigo-500 focus:ring-indigo-500/20 w-4 h-4" />
                Mensal
              </label>
              <div className="flex-1 flex gap-2 justify-end">
                <button type="button" onClick={() => setShowDespesaForm(false)} className="p-2.5 rounded-lg border border-white/10 text-gray-400 hover:bg-white/5"><X size={16} /></button>
                <button type="submit" className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20 px-4 rounded-lg text-sm font-bold transition-all">Adicionar</button>
              </div>
            </div>
          </form>
        )}

        {despesas.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">Nenhuma despesa registada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-500">
                  <th className="pb-3 font-semibold w-1/3">Descrição</th>
                  <th className="pb-3 font-semibold">Categoria</th>
                  <th className="pb-3 font-semibold">Tipo</th>
                  <th className="pb-3 font-semibold text-right">Valor</th>
                  <th className="pb-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {despesas.map(d => (
                  <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 text-sm text-gray-200">{d.descricao}</td>
                    <td className="py-3 text-xs text-gray-400"><span className="bg-white/5 px-2 py-1 rounded-md">{d.categoria}</span></td>
                    <td className="py-3 text-xs">{d.recorrente ? <span className="text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md font-medium">Recorrente (Mensal)</span> : <span className="text-gray-400 bg-white/5 px-2 py-1 rounded-md">Única</span>}</td>
                    <td className="py-3 text-sm font-bold text-red-400 text-right">{formatCurrency(d.valor)}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => handleDeleteDespesa(d.id)} className="p-1.5 rounded-md hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FinCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  };
  return (
    <div className="glass-card p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border mb-3 ${colors[color]}`}>{icon}</div>
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-extrabold text-white mt-1">{value}<span className="text-sm text-gray-500 font-normal ml-1">{sub}</span></p>
    </div>
  );
}
