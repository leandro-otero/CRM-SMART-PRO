'use client';

import { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, closestCorners, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { KanbanColumn } from '@/components/KanbanColumn';
import { LeadCard, LeadData } from '@/components/LeadCard';
import { LeadDetailModal } from '@/components/LeadDetailModal';
import { supabase } from '@/lib/supabaseClient';
import { RefreshCw, Kanban, TrendingUp, DollarSign, Clock, AlertTriangle, Search, Filter, Download } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';

const COLUNAS_PIPELINE = [
  { id: 'Prospecção', cor: 'gray' },
  { id: 'Contato', cor: 'blue' },
  { id: 'Qualificado', cor: 'indigo' },
  { id: 'Proposta Enviada', cor: 'violet' },
  { id: 'Negociação', cor: 'amber' },
  { id: 'Fechado', cor: 'emerald' },
];

export default function PipelinePage() {
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<'TODOS' | 'QUENTE' | 'MORNO' | 'FRIO'>('TODOS');
  const { showToast } = useToast();

  const exportPipelineCSV = () => {
    if (leads.length === 0) {
      showToast('Sem leads para exportar', 'warning');
      return;
    }
    const headers = ['Empresa', 'Nicho', 'Score', 'Classificação', 'Etapa', 'Receita Potencial'];
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
    a.download = `leadflow_pipeline_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${leads.length} leads exportados!`, 'success');
  };

  const fetchLeads = async () => {
    setSyncing(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('leads_prospeccao')
        .select('*')
        .not('status_funil', 'eq', 'Rejeitado')
        .order('score_aceitacao', { ascending: false })
        .limit(150);

      if (fetchErr) throw fetchErr;
      setLeads((data || []) as LeadData[]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar pipeline';
      setError(message);
      console.error('Pipeline fetch error:', err);
    } finally {
      setLoading(false);
      setTimeout(() => setSyncing(false), 600);
    }
  };

  useEffect(() => { 
    fetchLeads(); 

    let debounceTimer: NodeJS.Timeout;
    const channel = supabase
      .channel('pipeline_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads_prospeccao' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fetchLeads, 500);
      })
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const novaColuna = over.id as string;
    const lead = leads.find(l => l.id === cardId);

    if (lead && lead.status_funil !== novaColuna) {
      // Optimistic update
      const previousLeads = [...leads];
      setLeads(prev =>
        prev.map(l => l.id === cardId ? { ...l, status_funil: novaColuna, data_entrada_etapa: new Date().toISOString() } : l)
      );

      const { error: updateErr } = await supabase
        .from('leads_prospeccao')
        .update({ status_funil: novaColuna, data_entrada_etapa: new Date().toISOString() })
        .eq('id', cardId);

      if (updateErr) {
        // Rollback on error
        console.error('Drag update failed:', updateErr);
        setLeads(previousLeads);
        return;
      }

      // Log the activity
      await supabase.from('atividade_log').insert({
        entidade_tipo: 'lead',
        entidade_id: cardId,
        acao: `Lead "${lead.nome_empresa}" movido para ${novaColuna}`,
        detalhes: `De: ${lead.status_funil} → Para: ${novaColuna}`,
      });

      showToast(`"${lead.nome_empresa}" movido para ${novaColuna}`, 'info');
    }
  };

  const totalPipeline = leads.reduce((a, l) => a + (Number(l.potencial_receita_mensal) || 0), 0);
  const leadsEmNegociacao = leads.filter(l => l.status_funil === 'Negociação').length;
  const leadsFechados = leads.filter(l => l.status_funil === 'Fechado').length;
  const taxaConversao = leads.length > 0 ? Math.round((leadsFechados / leads.length) * 100) : 0;

  return (
    <div className="p-4 md:p-8 h-screen flex flex-col">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 mb-4 md:mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Kanban size={24} className="text-indigo-400" />
            Pipeline de Vendas
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">Arraste os leads entre as etapas do funil</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportPipelineCSV} className="btn-secondary flex items-center gap-2 text-xs sm:text-sm">
            <Download size={16} />
            CSV
          </button>
          <button
            onClick={fetchLeads}
            disabled={syncing}
            className="btn-secondary flex items-center gap-2 text-xs sm:text-sm"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Atualizar'}</span>
          </button>
        </div>
      </header>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6 flex-shrink-0">
          <AlertTriangle size={18} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button onClick={fetchLeads} className="text-xs text-red-400 font-bold hover:text-red-300">Tentar novamente</button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <section className="flex flex-col gap-3 mb-4 md:mb-6 flex-shrink-0">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Pesquisar leads por nome ou nicho..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input-glass w-full !pl-11 h-11"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['TODOS', 'QUENTE', 'MORNO', 'FRIO'] as const).map(f => {
            const emoji = f === 'QUENTE' ? '🔥' : f === 'MORNO' ? '⚡' : f === 'FRIO' ? '❄️' : '';
            const isActive = filterClass === f;
            return (
              <button
                key={f}
                onClick={() => setFilterClass(f)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  isActive
                    ? f === 'QUENTE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : f === 'MORNO' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : f === 'FRIO' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                    : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-white/[0.03] text-gray-500 border-white/5 hover:bg-white/[0.06]'
                }`}
              >
                {emoji} {f === 'TODOS' ? 'Todos' : f}
              </button>
            );
          })}
        </div>
      </section>

      {/* Pipeline Metrics Bar */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6 flex-shrink-0">
        <div className="glass-card p-4 flex items-center gap-3">
          <DollarSign size={18} className="text-emerald-400" />
          <div>
            <p className="text-xs text-gray-500 font-semibold">Pipeline Total</p>
            <p className="text-lg font-bold text-white">€{totalPipeline.toLocaleString('pt-PT')}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <TrendingUp size={18} className="text-indigo-400" />
          <div>
            <p className="text-xs text-gray-500 font-semibold">Taxa Conversão</p>
            <p className="text-lg font-bold text-white">{taxaConversao}%</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <Clock size={18} className="text-amber-400" />
          <div>
            <p className="text-xs text-gray-500 font-semibold">Em Negociação</p>
            <p className="text-lg font-bold text-white">{leadsEmNegociacao}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <TrendingUp size={18} className="text-emerald-400" />
          <div>
            <p className="text-xs text-gray-500 font-semibold">Fechados</p>
            <p className="text-lg font-bold text-white">{leadsFechados}</p>
          </div>
        </div>
      </section>

      {/* Kanban Board */}
      <section className="flex-1 overflow-hidden min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-indigo-400 font-bold animate-pulse">
            A carregar pipeline... ⚡
          </div>
        ) : leads.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <Kanban size={64} className="text-gray-700 mx-auto" />
              <h3 className="text-lg font-bold text-gray-400">Pipeline vazio</h3>
              <p className="text-sm text-gray-600 max-w-sm">Comece por prospectar leads para preencher o seu funil de vendas.</p>
              <Link href="/prospeccao" className="btn-primary inline-flex items-center gap-2 text-sm">
                <Search size={16} /> Iniciar Prospecção
              </Link>
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <div className="flex overflow-x-auto gap-4 pb-8 pt-2 w-full custom-scrollbar h-full items-start px-1">
              {COLUNAS_PIPELINE.map(({ id }) => {
                const leadsNaColuna = leads
                  .filter(l => l.status_funil === id)
                  .filter(l => {
                    if (searchTerm) {
                      const s = searchTerm.toLowerCase();
                      if (!l.nome_empresa.toLowerCase().includes(s) && !(l.nicho || '').toLowerCase().includes(s)) return false;
                    }
                    if (filterClass !== 'TODOS') {
                      const classif = l.classificacao || (l.score_aceitacao >= 80 ? 'QUENTE' : l.score_aceitacao >= 60 ? 'MORNO' : 'FRIO');
                      if (classif !== filterClass) return false;
                    }
                    return true;
                  });
                return (
                  <KanbanColumn key={id} id={id} title={id} count={leadsNaColuna.length}>
                    {leadsNaColuna.map(lead => (
                      <LeadCard key={lead.id} lead={lead} onSelect={setSelectedLead} />
                    ))}
                  </KanbanColumn>
                );
              })}
            </div>
          </DndContext>
        )}
      </section>

      {selectedLead && (
        <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
      )}
    </div>
  );
}
