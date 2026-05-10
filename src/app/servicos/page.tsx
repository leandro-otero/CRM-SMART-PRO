'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Zap, Briefcase, Activity, DollarSign, Clock, Settings, Sparkles } from 'lucide-react';
import { ServiceModal, ServiceData } from '@/components/ServiceModal';
import { formatCurrency } from '@/lib/servicePortfolio';

export default function ServicosPage() {
  const [servicos, setServicos] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Partial<ServiceData> | null>(null);
  const [isSuggestion, setIsSuggestion] = useState(false);
  const [suggestionData, setSuggestionData] = useState<{ reason?: string, revenue?: string }>({});
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  const fetchServicos = async () => {
    setLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from('catalogo_servicos')
        .select('*')
        .order('categoria', { ascending: true })
        .order('nome', { ascending: true });
        
      if (dbError) throw dbError;
      setServicos(data || []);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar serviços');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServicos();
  }, []);

  const handleAddManual = () => {
    setSelectedService(null);
    setIsSuggestion(false);
    setSuggestionData({});
    setShowModal(true);
  };

  const handleEdit = (service: ServiceData) => {
    setSelectedService(service);
    setIsSuggestion(false);
    setSuggestionData({});
    setShowModal(true);
  };

  const handleSugerirIA = async () => {
    setLoadingSuggestion(true);
    try {
      const res = await fetch('/api/servicos/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicosAtuais: servicos })
      });
      const data = await res.json();
      
      if (data.suggestion) {
        const { servico_sugerido, motivo, potencial_receita_adicional } = data.suggestion;
        setSelectedService(servico_sugerido);
        setIsSuggestion(true);
        setSuggestionData({ reason: motivo, revenue: potencial_receita_adicional });
        setShowModal(true);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar sugestão da IA.');
    } finally {
      setLoadingSuggestion(false);
    }
  };

  if (loading && servicos.length === 0) {
    return <div className="flex items-center justify-center h-screen text-indigo-400 font-bold animate-pulse">A carregar catálogo de serviços...</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6 md:space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Briefcase size={24} className="text-indigo-400" />
            Catálogo de Serviços
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gira o portfólio da agência e otimize a rentabilidade.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSugerirIA} 
            disabled={loadingSuggestion}
            className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
          >
            {loadingSuggestion ? <span className="animate-spin text-lg leading-none">⟳</span> : <Sparkles size={16} />}
            {loadingSuggestion ? 'A pensar...' : 'Sugerir com IA'}
          </button>
          <button onClick={handleAddManual} className="btn-primary flex items-center gap-2 py-2 px-4 text-sm">
            <Plus size={16} /> Novo Serviço
          </button>
        </div>
      </header>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {servicos.map(s => (
          <div 
            key={s.id} 
            onClick={() => handleEdit(s)}
            className={`glass-card p-5 cursor-pointer hover:border-indigo-500/30 transition-all ${!s.ativo ? 'opacity-50 grayscale' : ''}`}
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 bg-white/5 rounded-md text-gray-400">{s.categoria}</span>
              {s.ativo ? <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" /> : <span className="w-2 h-2 rounded-full bg-red-400" />}
            </div>
            <h3 className="text-lg font-bold text-white leading-tight mb-1">{s.nome}</h3>
            <p className="text-xs text-gray-500 line-clamp-2 min-h-[32px]">{s.descricao}</p>
            
            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-emerald-400/70 font-semibold uppercase tracking-wider">Setup</p>
                <p className="text-sm font-bold text-emerald-400">{s.valor_setup > 0 ? formatCurrency(s.valor_setup) : '--'}</p>
              </div>
              <div>
                <p className="text-[10px] text-indigo-400/70 font-semibold uppercase tracking-wider">Mensal</p>
                <p className="text-sm font-bold text-indigo-400">{s.valor_mensal > 0 ? formatCurrency(s.valor_mensal) : '--'}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-1 text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-md" title="Margem de Lucro">
                <Activity size={12} className="text-emerald-500" /> {s.margem_estimada}%
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400 bg-white/5 px-2 py-1 rounded-md" title="Horas Mensais">
                <Clock size={12} className="text-indigo-400" /> {s.tempo_execucao_mensal}h
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <ServiceModal 
          service={selectedService} 
          isSuggestion={isSuggestion}
          suggestionReason={suggestionData.reason}
          suggestionRevenue={suggestionData.revenue}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            fetchServicos();
          }}
        />
      )}
    </div>
  );
}
