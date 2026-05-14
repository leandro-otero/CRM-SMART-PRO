'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { CheckSquare, Plus, X, Clock, AlertTriangle, CheckCircle2, Circle, RefreshCw, Flame, Users, Calendar as CalendarIcon, List, CalendarPlus } from 'lucide-react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pt';
import 'react-big-calendar/lib/css/react-big-calendar.css';

moment.locale('pt');
const localizer = momentLocalizer(moment);

interface Tarefa {
  id: string;
  lead_id: string | null;
  cliente_id: string | null;
  descricao: string;
  tipo: string;
  data_agendada: string | null;
  concluida: boolean;
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
  created_at: string;
  // Joined
  lead_nome?: string;
  cliente_nome?: string;
}

interface Lead { id: string; nome_empresa: string; }
interface Cliente { id: string; nome_empresa: string; }

const TIPOS_TAREFA = ['follow-up', 'reunião', 'proposta', 'demonstração', 'contrato', 'outro'];
const COR_PRIORIDADE = { ALTA: 'text-red-400 bg-red-500/10 border-red-500/20', MEDIA: 'text-amber-400 bg-amber-500/10 border-amber-500/20', BAIXA: 'text-gray-400 bg-gray-500/10 border-gray-500/20' };

export default function TarefasPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | 'pendentes' | 'concluidas' | 'alta' | 'atrasadas'>('pendentes');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [form, setForm] = useState({ descricao: '', tipo: 'follow-up', data_agendada: '', prioridade: 'MEDIA', lead_id: '', cliente_id: '' });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRes, lRes, cRes] = await Promise.all([
        supabase.from('pipeline_tarefas').select('*').order('prioridade', { ascending: true }).order('data_agendada', { ascending: true, nullsFirst: false }),
        supabase.from('leads_prospeccao').select('id, nome_empresa').order('nome_empresa'),
        supabase.from('clientes').select('id, nome_empresa').order('nome_empresa'),
      ]);
      if (tRes.error) throw tRes.error;
      if (lRes.error) throw lRes.error;
      if (cRes.error) throw cRes.error;

      // Join names
      const tarefasComNomes = (tRes.data || []).map(t => ({
        ...t,
        lead_nome: lRes.data?.find(l => l.id === t.lead_id)?.nome_empresa,
        cliente_nome: cRes.data?.find(c => c.id === t.cliente_id)?.nome_empresa,
      }));

      setTarefas(tarefasComNomes);
      setLeads(lRes.data || []);
      setClientes(cRes.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar tarefas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    let debounceTimer: NodeJS.Timeout;
    const channel = supabase
      .channel('tarefas_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_tarefas' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fetchData, 400);
      })
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error: err } = await supabase.from('pipeline_tarefas').insert({
      descricao: form.descricao,
      tipo: form.tipo,
      data_agendada: form.data_agendada || null,
      prioridade: form.prioridade,
      lead_id: form.lead_id || null,
      cliente_id: form.cliente_id || null,
      concluida: false,
    });
    if (err) { setError(err.message); return; }
    setShowForm(false);
    setForm({ descricao: '', tipo: 'follow-up', data_agendada: '', prioridade: 'MEDIA', lead_id: '', cliente_id: '' });
    fetchData();
  };

  const toggleConcluida = async (id: string, concluida: boolean) => {
    setTarefas(prev => prev.map(t => t.id === id ? { ...t, concluida: !concluida } : t));
    await supabase.from('pipeline_tarefas').update({ concluida: !concluida }).eq('id', id);
  };

  const deleteTarefa = async (id: string) => {
    setTarefas(prev => prev.filter(t => t.id !== id));
    await supabase.from('pipeline_tarefas').delete().eq('id', id);
  };

  const tarefasFiltradas = tarefas.filter(t => {
    if (filtro === 'pendentes') return !t.concluida;
    if (filtro === 'concluidas') return t.concluida;
    if (filtro === 'alta') return !t.concluida && t.prioridade === 'ALTA';
    if (filtro === 'atrasadas') return !t.concluida && !!isVencida(t.data_agendada);
    return true;
  });

  const pendentes = tarefas.filter(t => !t.concluida).length;
  const alta = tarefas.filter(t => !t.concluida && t.prioridade === 'ALTA').length;
  const concluidas = tarefas.filter(t => t.concluida).length;
  const vencidas = tarefas.filter(t => !t.concluida && isVencida(t.data_agendada)).length;

  const isVencida = (data: string | null) => data && new Date(data) < new Date() && new Date(data).toDateString() !== new Date().toDateString();
  const isHoje = (data: string | null) => data && new Date(data).toDateString() === new Date().toDateString();

  const generateGoogleCalendarLink = (tarefa: Tarefa) => {
    if (!tarefa.data_agendada) return '';
    const start = new Date(tarefa.data_agendada);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
    const formatGoogleDate = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, '');
    
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `[CRM] ${tarefa.descricao}`,
      dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
      details: `Tipo: ${tarefa.tipo}\nPrioridade: ${tarefa.prioridade}\n${tarefa.lead_nome ? `Lead: ${tarefa.lead_nome}` : ''}${tarefa.cliente_nome ? `Cliente: ${tarefa.cliente_nome}` : ''}`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const calendarEvents = tarefas.filter(t => t.data_agendada).map(t => ({
    id: t.id,
    title: t.descricao,
    start: new Date(t.data_agendada!),
    end: new Date(new Date(t.data_agendada!).getTime() + 60 * 60 * 1000), // 1 hour duration
    resource: t,
  }));

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 md:space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <CheckSquare size={24} className="text-indigo-400" />
            Tarefas & Follow-ups
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">{pendentes} pendentes · {alta} urgentes · {concluidas} concluídas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2 text-sm p-2.5">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Nova Tarefa
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <Clock size={18} className="text-indigo-400" />
          <div><p className="text-xs text-gray-500 font-semibold">Pendentes</p><p className="text-xl font-bold text-white">{pendentes}</p></div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <Flame size={18} className="text-red-400" />
          <div><p className="text-xs text-gray-500 font-semibold">Urgentes</p><p className="text-xl font-bold text-white">{alta}</p></div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <div><p className="text-xs text-gray-500 font-semibold">Concluídas</p><p className="text-xl font-bold text-white">{concluidas}</p></div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-400" />
          <div><p className="text-xs text-gray-500 font-semibold">Vencidas</p><p className={`text-xl font-bold ${vencidas > 0 ? 'text-red-400' : 'text-white'}`}>{vencidas}</p></div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={18} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* New Task Form */}
      {showForm && (
        <section className="glass-card p-6 animate-slide-up">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-bold text-white">Nova Tarefa</h2>
            <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">Descrição *</label>
              <input required value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} className="input-glass w-full" placeholder="Ex: Ligar ao João da Tasca do Mário..." />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">Tipo</label>
              <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} className="input-glass w-full">
                {TIPOS_TAREFA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">Prioridade</label>
              <select value={form.prioridade} onChange={e => setForm({...form, prioridade: e.target.value})} className="input-glass w-full">
                <option value="ALTA">🔴 Alta</option>
                <option value="MEDIA">🟡 Média</option>
                <option value="BAIXA">🟢 Baixa</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">Data Agendada</label>
              <input type="datetime-local" value={form.data_agendada} onChange={e => setForm({...form, data_agendada: e.target.value})} className="input-glass w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">Lead Associado</label>
              <select value={form.lead_id} onChange={e => setForm({...form, lead_id: e.target.value})} className="input-glass w-full">
                <option value="">— Nenhum —</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.nome_empresa}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">Cliente Associado</label>
              <select value={form.cliente_id} onChange={e => setForm({...form, cliente_id: e.target.value})} className="input-glass w-full">
                <option value="">— Nenhum —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome_empresa}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancelar</button>
              <button type="submit" className="btn-primary text-sm">Criar Tarefa</button>
            </div>
          </form>
        </section>
      )}

      {/* Filter Tabs & View Toggle */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'pendentes', label: 'Pendentes' },
            { key: 'alta', label: '🔴 Urgentes' },
            { key: 'atrasadas', label: '⚠️ Vencidas' },
            { key: 'todas', label: 'Todas' },
            { key: 'concluidas', label: '✅ Concluídas' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key as typeof filtro)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filtro === f.key ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-white/[0.03] text-gray-500 border border-white/5 hover:bg-white/[0.06]'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/5">
          <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <List size={16} /> Lista
          </button>
          <button onClick={() => setViewMode('calendar')} className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all ${viewMode === 'calendar' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <CalendarIcon size={16} /> Calendário
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="text-center py-16 text-indigo-400 animate-pulse font-bold">A carregar tarefas...</div>
      ) : viewMode === 'calendar' ? (
        <div className="glass-card p-6 h-[600px] overflow-hidden rb-calendar-container">
          <style dangerouslySetInnerHTML={{__html: `
            .rbc-calendar { font-family: inherit; color: white; }
            .rbc-btn-group button { color: #9ca3af; border-color: rgba(255,255,255,0.1); }
            .rbc-btn-group button.rbc-active { background: rgba(99, 102, 241, 0.2); color: #818cf8; border-color: rgba(99, 102, 241, 0.3); box-shadow: none; }
            .rbc-toolbar button:hover { background: rgba(255,255,255,0.05); }
            .rbc-month-view, .rbc-time-view, .rbc-header, .rbc-day-bg, .rbc-month-row, .rbc-time-header-content { border-color: rgba(255,255,255,0.05) !important; }
            .rbc-off-range-bg { background: rgba(255,255,255,0.02); }
            .rbc-today { background: rgba(99, 102, 241, 0.05); }
            .rbc-event { background-color: rgba(99, 102, 241, 0.8); border: none; border-radius: 6px; padding: 2px 6px; }
            .rbc-event.concluida { background-color: rgba(16, 185, 129, 0.5); text-decoration: line-through; }
            .rbc-event.alta { background-color: rgba(239, 68, 68, 0.8); }
          `}} />
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            messages={{
              next: "Próximo",
              previous: "Anterior",
              today: "Hoje",
              month: "Mês",
              week: "Semana",
              day: "Dia"
            }}
            eventPropGetter={(event) => {
              const t = event.resource as Tarefa;
              let className = '';
              if (t.concluida) className = 'concluida';
              else if (t.prioridade === 'ALTA') className = 'alta';
              return { className };
            }}
            onSelectEvent={(event) => {
              const url = generateGoogleCalendarLink(event.resource as Tarefa);
              if (url && window.confirm(`Deseja adicionar "${event.title}" ao seu Google Calendar?`)) {
                window.open(url, '_blank');
              }
            }}
          />
        </div>
      ) : tarefasFiltradas.length === 0 ? (
        <div className="text-center py-16">
          <CheckSquare size={48} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">Nenhuma tarefa</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tarefasFiltradas.map(t => {
            const vencida = isVencida(t.data_agendada);
            const hoje = isHoje(t.data_agendada);
            return (
              <div key={t.id} className={`glass-card p-4 flex items-start gap-4 transition-all ${t.concluida ? 'opacity-50' : ''} ${!t.concluida && isVencida(t.data_agendada) ? 'border-red-500/40 bg-red-500/[0.04]' : ''} ${!t.concluida && isHoje(t.data_agendada) ? 'border-amber-500/30 bg-amber-500/[0.03]' : ''}`}>
                <button onClick={() => toggleConcluida(t.id, t.concluida)} className="mt-0.5 shrink-0 text-gray-500 hover:text-indigo-400 transition-colors">
                  {t.concluida ? <CheckCircle2 size={22} className="text-emerald-400" /> : <Circle size={22} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${t.concluida ? 'line-through text-gray-500' : 'text-gray-100'}`}>{t.descricao}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-lg uppercase font-bold">{t.tipo}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg border font-bold ${COR_PRIORIDADE[t.prioridade]}`}>{t.prioridade}</span>
                    {t.lead_nome && <span className="text-[10px] text-indigo-400 flex items-center gap-1"><Users size={10} />{t.lead_nome}</span>}
                    {t.cliente_nome && <span className="text-[10px] text-emerald-400 flex items-center gap-1"><Users size={10} />{t.cliente_nome}</span>}
                    {t.data_agendada && (
                      <span className={`text-[10px] flex items-center gap-1 font-semibold ${vencida ? 'text-red-400' : hoje ? 'text-amber-400' : 'text-gray-500'}`}>
                        <Clock size={10} />
                        {vencida ? '⚠️ Vencida: ' : hoje ? '📅 Hoje: ' : ''}{new Date(t.data_agendada).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
                {t.data_agendada && !t.concluida && (
                  <a href={generateGoogleCalendarLink(t)} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-indigo-400 transition-colors shrink-0 p-1 mr-2 flex items-center gap-1 bg-white/5 rounded-lg px-2" title="Adicionar ao Google Calendar">
                    <CalendarPlus size={14} /> <span className="text-[10px] font-bold">Add</span>
                  </a>
                )}
                <button onClick={() => deleteTarefa(t.id)} className="text-gray-700 hover:text-red-400 transition-colors shrink-0 p-1">
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
