'use client';

import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Users,
  TrendingUp,
  Zap,
  Target,
  DollarSign,
  ArrowUpRight,
  Clock,
  AlertTriangle,
  Flame,
  BarChart3,
  Search,
  RefreshCw,
  Download,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';

const PipelineChart = lazy(() => import('@/components/PipelineChart'));

interface LeadRow {
  id: string;
  nome_empresa: string;
  nicho: string;
  score_aceitacao: number;
  classificacao: string;
  status_funil: string;
  data_entrada_etapa: string;
  potencial_receita_mensal: number;
}

interface ClienteRow {
  id: string;
  nome_empresa: string;
  status: string;
}

interface ServicoRow {
  valor: number;
  tipo: string;
  status: string;
}

interface AtividadeRow {
  id: string;
  acao: string;
  detalhes: string;
  entidade_tipo: string;
  created_at: string;
}

export default function Dashboard() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [servicos, setServicos] = useState<ServicoRow[]>([]);
  const [atividades, setAtividades] = useState<AtividadeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const exportCSV = () => {
    if (leads.length === 0) {
      showToast('Sem leads para exportar', 'warning');
      return;
    }
    const headers = ['Empresa', 'Nicho', 'Score', 'Classificação', 'Etapa Pipeline', 'Receita Potencial'];
    const rows = leads.map(l => [
      l.nome_empresa,
      l.nicho || '',
      l.score_aceitacao?.toString() || '0',
      l.classificacao || '',
      l.status_funil || '',
      l.potencial_receita_mensal?.toString() || '0',
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leadflow_leads_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${leads.length} leads exportados com sucesso!`, 'success');
  };

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [leadsRes, clientesRes, servicosRes, atividadesRes] = await Promise.all([
        supabase.from('leads_prospeccao').select('id, nome_empresa, nicho, score_aceitacao, classificacao, status_funil, data_entrada_etapa, potencial_receita_mensal').order('score_aceitacao', { ascending: false }),
        supabase.from('clientes').select('id, nome_empresa, status'),
        supabase.from('servicos_contratados').select('valor, tipo, status'),
        supabase.from('atividade_log').select('*').order('created_at', { ascending: false }).limit(10),
      ]);

      if (leadsRes.error) throw leadsRes.error;
      if (clientesRes.error) throw clientesRes.error;
      if (servicosRes.error) throw servicosRes.error;
      if (atividadesRes.error) throw atividadesRes.error;

      setLeads(leadsRes.data || []);
      setClientes(clientesRes.data || []);
      setServicos(servicosRes.data || []);
      setAtividades(atividadesRes.data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados';
      setError(message);
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchAll(); 

    let debounceTimer: NodeJS.Timeout;
    const debouncedFetch = (table: string) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (table === 'leads_prospeccao') {
          const { data } = await supabase.from('leads_prospeccao').select('id, nome_empresa, nicho, score_aceitacao, classificacao, status_funil, data_entrada_etapa, potencial_receita_mensal').order('score_aceitacao', { ascending: false });
          if (data) setLeads(data);
        } else if (table === 'clientes') {
          const { data } = await supabase.from('clientes').select('id, nome_empresa, status');
          if (data) setClientes(data);
        } else if (table === 'servicos_contratados') {
          const { data } = await supabase.from('servicos_contratados').select('valor, tipo, status');
          if (data) setServicos(data);
        } else if (table === 'atividade_log') {
          const { data } = await supabase.from('atividade_log').select('*').order('created_at', { ascending: false }).limit(10);
          if (data) setAtividades(data);
        }
      }, 300);
    };

    const channel = supabase
      .channel('dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_prospeccao' }, () => debouncedFetch('leads_prospeccao'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => debouncedFetch('clientes'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos_contratados' }, () => debouncedFetch('servicos_contratados'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividade_log' }, () => debouncedFetch('atividade_log'))
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const metrics = useMemo(() => {
    const totalLeads = leads.length;
    const scoreMedio = totalLeads > 0
      ? Math.round(leads.reduce((a, l) => a + (l.score_aceitacao || 0), 0) / totalLeads)
      : 0;
    const clientesAtivos = clientes.filter(c => c.status === 'ATIVO').length;
    const mrr = servicos
      .filter(s => s.tipo === 'mensal' && s.status === 'ativo')
      .reduce((a, s) => a + Number(s.valor), 0);
    const pipelineValue = leads.reduce((a, l) => a + (Number(l.potencial_receita_mensal) || 0), 0);
    const leadsQuentes = leads.filter(l => l.classificacao === 'QUENTE').length;
    const taxaConversao = totalLeads > 0
      ? Math.round((leads.filter(l => l.status_funil === 'Fechado').length / totalLeads) * 100)
      : 0;
    const propostaValue = leads
      .filter(l => ['Proposta Enviada', 'Negociação'].includes(l.status_funil))
      .reduce((a, l) => a + (Number(l.potencial_receita_mensal) || 0), 0);

    return { totalLeads, scoreMedio, clientesAtivos, mrr, pipelineValue, leadsQuentes, taxaConversao, propostaValue };
  }, [leads, clientes, servicos]);

  const leadsQuentes = leads.filter(l => l.classificacao === 'QUENTE').slice(0, 5);
  const leadsParados = leads.filter(l => {
    if (!l.data_entrada_etapa) return false;
    const dias = Math.floor((Date.now() - new Date(l.data_entrada_etapa).getTime()) / (1000 * 60 * 60 * 24));
    return dias >= 3 && !['Fechado', 'Rejeitado'].includes(l.status_funil);
  });

  const PIPELINE_STAGES = ['Prospecção', 'Contato', 'Qualificado', 'Proposta Enviada', 'Negociação', 'Fechado'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-3 text-indigo-400 font-bold animate-pulse">
          <Zap size={24} className="animate-bounce" />
          <span>A carregar LeadFlow...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="glass-card p-8 text-center max-w-md space-y-4">
          <AlertTriangle size={48} className="text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Erro de Conexão</h2>
          <p className="text-sm text-gray-400">{error}</p>
          <button onClick={fetchAll} className="btn-primary flex items-center gap-2 mx-auto text-sm">
            <RefreshCw size={16} /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6 md:space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Visão geral do seu negócio</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-xs sm:text-sm">
            <Download size={16} />
            <span className="hidden sm:inline">Exportar</span> CSV
          </button>
          <button
            onClick={fetchAll}
            className="btn-secondary flex items-center gap-2 text-xs sm:text-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <Link href="/prospeccao" className="btn-primary flex items-center gap-2 text-xs sm:text-sm">
            <Search size={16} />
            <span className="hidden sm:inline">Nova</span> Prospecção
          </Link>
        </div>
      </header>

      {/* Metrics Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 stagger-children">
        <MetricBox icon={<Users size={18} />} label="Leads Ativos" value={metrics.totalLeads} color="indigo" />
        <MetricBox icon={<Target size={18} />} label="Score Médio" value={`${metrics.scoreMedio}%`} color="emerald" />
        <MetricBox icon={<Flame size={18} />} label="Leads Quentes" value={metrics.leadsQuentes} color="amber" />
        <MetricBox icon={<Users size={18} />} label="Clientes" value={metrics.clientesAtivos} color="violet" />
        <MetricBox icon={<DollarSign size={18} />} label="MRR" value={`€${metrics.mrr.toLocaleString('pt-PT')}`} color="emerald" />
        <MetricBox icon={<TrendingUp size={18} />} label="Conversão" value={`${metrics.taxaConversao}%`} color="blue" />
        <MetricBox icon={<DollarSign size={18} />} label="Pipeline" value={`€${metrics.pipelineValue.toLocaleString('pt-PT')}`} color="indigo" />
        <MetricBox icon={<ArrowUpRight size={18} />} label="A Fechar" value={`€${metrics.propostaValue.toLocaleString('pt-PT')}`} color="amber" />
      </section>

      {/* Mini Pipeline */}
      <section className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 size={20} className="text-indigo-400" />
            Pipeline Resumido
          </h2>
          <Link href="/pipeline" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
            Ver completo <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {PIPELINE_STAGES.map((stage) => {
            const count = leads.filter(l => l.status_funil === stage).length;
            const isActive = count > 0;
            return (
              <div
                key={stage}
                className={`flex-1 min-w-[100px] text-center py-3 px-2 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
                    : 'bg-white/[0.02] border-white/5 text-gray-600'
                }`}
              >
                <p className="text-xl font-bold">{count}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider mt-1 truncate">{stage}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pipeline Evolution Chart */}
      <section className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-400" />
            Evolução do Pipeline
          </h2>
          <span className="text-[10px] text-gray-600 uppercase tracking-wider font-bold">Últimas 8 semanas</span>
        </div>
        <Suspense fallback={<div className="h-[240px] flex items-center justify-center text-indigo-400 animate-pulse text-sm">A carregar gráfico...</div>}>
          <PipelineChart leads={leads} />
        </Suspense>
      </section>

      {/* Bottom Grid: Hot Leads + Alerts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hot Leads */}
        <section className="glass-card p-6 lg:col-span-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <Flame size={16} className="text-emerald-400" />
            Leads Quentes
          </h3>
          {leadsQuentes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 text-sm">Nenhum lead quente no momento</p>
              <Link href="/prospeccao" className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 inline-block">
                Iniciar prospecção →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {leadsQuentes.map((lead) => (
                <Link key={lead.id} href="/pipeline" className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all block">
                  <div>
                    <p className="text-sm font-semibold text-gray-200">{lead.nome_empresa}</p>
                    <p className="text-[11px] text-gray-500">{lead.nicho || lead.status_funil}</p>
                  </div>
                  <span className="badge-quente text-xs font-bold px-2 py-1 rounded-lg">
                    🔥 {lead.score_aceitacao}%
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Alerts */}
        <section className="glass-card p-6 lg:col-span-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-400" />
            Alertas
          </h3>
          {leadsParados.length === 0 ? (
            <p className="text-gray-600 text-sm py-4 text-center">Nenhum alerta no momento ✅</p>
          ) : (
            <div className="space-y-3">
              {leadsParados.slice(0, 5).map((lead) => {
                const dias = Math.floor((Date.now() - new Date(lead.data_entrada_etapa).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={lead.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                    <div>
                      <p className="text-sm font-semibold text-gray-200">{lead.nome_empresa}</p>
                      <p className="text-[11px] text-gray-500">{lead.status_funil}</p>
                    </div>
                    <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                      <Clock size={12} /> {dias}d parado
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Activity Feed */}
        <section className="glass-card p-6 lg:col-span-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <Zap size={16} className="text-indigo-400" />
            Atividade Recente
          </h3>
          {atividades.length === 0 ? (
            <p className="text-gray-600 text-sm py-4 text-center">Nenhuma atividade registada</p>
          ) : (
            <div className="space-y-3">
              {atividades.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-300">{a.acao}</p>
                    <p className="text-[10px] text-gray-600">{new Date(a.created_at).toLocaleDateString('pt-PT')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MetricBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  };
  const c = colorMap[color] || colorMap.indigo;

  return (
    <div className="glass-card p-4 group">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border mb-3 ${c}`}>
        {icon}
      </div>
      <p className="text-2xl font-extrabold text-white">{value}</p>
      <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
