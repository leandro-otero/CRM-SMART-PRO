'use client';

import { useState, useEffect } from 'react';
import { Search, Sparkles, MapPin, Loader2, ChevronDown, ChevronUp, Copy, MessageCircle, AlertTriangle, CheckCircle2, Target, Globe, Camera, ShoppingCart } from 'lucide-react';
import { buscarLeads, LeadBruto } from '@/lib/geminiClient';
import { calcularScore, isSegmentoAltaDemanda } from '@/lib/leadScoring';
import { SERVICOS, formatCurrency } from '@/lib/servicePortfolio';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ToastProvider';

interface LeadAnalisado extends LeadBruto {
  score: number;
  classificacao: string;
  emoji: string;
  cor: string;
  detalhes: string[];
  servicos_recomendados: string[];
  potencial_receita: number;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'duplicate' | 'error';

export default function ProspeccaoPage() {
  const { showToast } = useToast();
  const [segmento, setSegmento] = useState('');
  const [cidade, setCidade] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LeadAnalisado[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [searchDone, setSearchDone] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState(8);
  const [catalogoServicos, setCatalogoServicos] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('catalogo_servicos').select('*').then(({ data }) => {
      if (data) setCatalogoServicos(data);
    });
  }, []);

  const handleSearch = async () => {
    if (!segmento.trim() || !cidade.trim()) return;
    setLoading(true);
    setSearchDone(false);
    setSearchError(null);

    try {
      const { leads, mode } = await buscarLeads(segmento, cidade, quantidade);

      if (mode === 'simulation') {
        setSearchError('⚠️ Modo simulação — Chave do Google não configurada corretamente.');
      } else if (mode === 'api_error') {
        setSearchError('❌ Erro na API do Google: A chave que adicionou não tem autorização para a "Places API" ou é inválida. Por favor, ative a Places API no Google Cloud Console.');
      }

      const analisados: LeadAnalisado[] = leads.map(lead => {
        const scoreResult = calcularScore({
          tem_site: lead.tem_site,
          tem_google_maps: true,
          google_maps_completo: lead.google_maps_completo,
          tem_instagram: lead.tem_instagram,
          instagram_ativo: lead.instagram_ativo,
          tem_ecommerce: lead.tem_ecommerce,
          segmento_alta_demanda: isSegmentoAltaDemanda(segmento),
          concorrentes_com_presenca: true,
          negocio_estabelecido: parseInt(lead.tempo_mercado_estimado) > 1,
          ticket_medio_alto: false,
        });

        const servicos_recomendados: string[] = [];
        if (!lead.tem_site) servicos_recomendados.push('Landing Page');
        if (!lead.google_maps_completo) servicos_recomendados.push('Google Maps');
        if (!lead.tem_instagram || !lead.instagram_ativo) servicos_recomendados.push('Gestão de Instagram');
        if (lead.tem_whatsapp_business === false) servicos_recomendados.push('Automação WhatsApp');
        if (!lead.tem_ecommerce) servicos_recomendados.push('E-Commerce');

        const potencial_receita = servicos_recomendados.reduce((acc, nome) => {
          const s = catalogoServicos.find(sv => sv.nome.toLowerCase() === nome.toLowerCase() || sv.nome.toLowerCase().includes(nome.toLowerCase()));
          return acc + (s ? s.valor_mensal : 0);
        }, 0);

        return {
          ...lead,
          ...scoreResult,
          servicos_recomendados,
          potencial_receita,
        };
      });

      analisados.sort((a, b) => b.score - a.score);
      setResults(analisados);
      setSearchDone(true);
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('Erro ao buscar leads. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const salvarLead = async (lead: LeadAnalisado) => {
    setSaveStatus(prev => ({ ...prev, [lead.nome]: 'saving' }));

    try {
      // Check for duplicates first
      const { data: existing } = await supabase
        .from('leads_prospeccao')
        .select('id')
        .eq('nome_empresa', lead.nome)
        .eq('regiao_busca', cidade)
        .limit(1);

      if (existing && existing.length > 0) {
        setSaveStatus(prev => ({ ...prev, [lead.nome]: 'duplicate' }));
        showToast(`"${lead.nome}" já existe no pipeline`, 'warning');
        setTimeout(() => setSaveStatus(prev => ({ ...prev, [lead.nome]: 'idle' })), 3000);
        return;
      }

      const { error } = await supabase.from('leads_prospeccao').insert({
        nome_empresa: lead.nome,
        responsavel: null,
        morada: lead.endereco,
        nicho: segmento,
        regiao_busca: cidade,
        rating_google: lead.avaliacao_google,
        total_avaliacoes: lead.total_avaliacoes,
        whatsapp_extraido: lead.telefone,
        score_aceitacao: lead.score,
        classificacao: lead.classificacao,
        potencial_receita_mensal: lead.potencial_receita,
        servicos_recomendados: lead.servicos_recomendados,
        tem_site: lead.tem_site,
        tem_google_maps: true,
        google_maps_completo: lead.google_maps_completo,
        tem_instagram: lead.tem_instagram,
        instagram_ativo: lead.instagram_ativo,
        tem_ecommerce: lead.tem_ecommerce,
        tem_whatsapp_business: lead.tem_whatsapp_business,
        tempo_mercado_estimado: lead.tempo_mercado_estimado,
        observacoes_ia: lead.observacoes,
        problemas_digitais: lead.detalhes,
        status_funil: 'Prospecção',
        urgencia: lead.score >= 80 ? 'ALTA' : lead.score >= 60 ? 'MEDIA' : 'BAIXA',
        melhor_abordagem: 'WhatsApp',
        dor_identificada: lead.observacoes,
        servico_primario: lead.servicos_recomendados[0] || 'Landing Page',
        copy_icebreaker: `Olá, boa tarde! Encontrámos o ${lead.nome} no Google e ficámos impressionados com a vossa reputação (${lead.avaliacao_google}⭐). Notámos algumas oportunidades para melhorar a vossa presença digital. Faz sentido enviar-vos um áudio rápido de 1 minuto a explicar como isto funcionaria?`,
      });

      if (error) throw error;

      // Fire and forget activity log to avoid blocking UI
      supabase.from('atividade_log').insert({
        entidade_tipo: 'lead',
        acao: `Novo lead guardado: ${lead.nome}`,
        detalhes: `Score: ${lead.score} | Classificação: ${lead.classificacao} | Segmento: ${segmento}`,
      }).then();

      setSaveStatus(prev => ({ ...prev, [lead.nome]: 'saved' }));
      showToast(`"${lead.nome}" guardado no Pipeline!`, 'success');
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus(prev => ({ ...prev, [lead.nome]: 'error' }));
      showToast(`Erro ao guardar "${lead.nome}"`, 'error');
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [lead.nome]: 'idle' })), 3000);
    }
  };

  const getButtonContent = (nome: string) => {
    const status = saveStatus[nome] || 'idle';
    switch (status) {
      case 'saving': return { text: 'A guardar...', disabled: true, className: 'btn-primary opacity-70' };
      case 'saved': return { text: '✅ Guardado no Pipeline!', disabled: true, className: 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-semibold py-2.5 px-5 rounded-xl' };
      case 'duplicate': return { text: '⚠️ Lead já existe no pipeline', disabled: true, className: 'bg-amber-600/20 border border-amber-500/30 text-amber-400 font-semibold py-2.5 px-5 rounded-xl' };
      case 'error': return { text: '❌ Erro ao guardar', disabled: true, className: 'bg-red-600/20 border border-red-500/30 text-red-400 font-semibold py-2.5 px-5 rounded-xl' };
      default: return { text: '📥 Guardar no Pipeline', disabled: false, className: 'btn-primary' };
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 md:space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Sparkles size={24} className="text-indigo-400" />
          Prospecção Inteligente
        </h1>
        <p className="text-gray-500 text-sm mt-1">Encontre leads com alto potencial usando IA</p>
      </header>

      {/* Search Form */}
      <section className="glass-card p-5 md:p-8 relative overflow-hidden">
        {/* Subtle glowing orb in background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
        
        <div className="flex flex-col md:flex-row gap-5 md:items-end relative z-10">
          <div className="flex-1 w-full">
            <label className="text-[11px] text-indigo-300 font-bold uppercase tracking-widest mb-2 block">Alvo / Segmento</label>
            <div className="relative group">
              <Target size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400/60 group-focus-within:text-indigo-400 transition-colors" />
              <input
                type="text"
                list="segmentos-comuns"
                placeholder="Ex: Clínicas, Restaurantes..."
                value={segmento}
                onChange={e => setSegmento(e.target.value)}
                className="input-glass w-full !pl-12 h-14 text-base transition-all focus:ring-2 focus:ring-indigo-500/30"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <datalist id="segmentos-comuns">
                <option value="Clínicas Dentárias" />
                <option value="Restaurantes" />
                <option value="Imobiliárias" />
                <option value="Salões de Beleza" />
                <option value="Ginásios" />
                <option value="Barbearias" />
                <option value="Clínicas de Estética" />
                <option value="Oficinas Automóveis" />
                <option value="Advogados" />
                <option value="Escolas de Condução" />
              </datalist>
            </div>
          </div>
          <div className="flex-1 w-full">
            <label className="text-[11px] text-indigo-300 font-bold uppercase tracking-widest mb-2 block">Cidade / Região</label>
            <div className="relative group">
              <MapPin size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400/60 group-focus-within:text-indigo-400 transition-colors" />
              <input
                type="text"
                placeholder="Ex: Porto, Lisboa, Braga..."
                value={cidade}
                onChange={e => setCidade(e.target.value)}
                className="input-glass w-full !pl-12 h-14 text-base transition-all focus:ring-2 focus:ring-indigo-500/30"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <div className="w-full md:w-auto">
            <label className="text-[11px] text-indigo-300 font-bold uppercase tracking-widest mb-2 block md:block hidden">Quantidade</label>
            <div className="relative">
              <select
                value={quantidade}
                onChange={e => setQuantidade(Number(e.target.value))}
                className="input-glass h-14 px-4 pr-10 text-base w-full md:w-24 appearance-none cursor-pointer"
              >
                <option value={5}>5</option>
                <option value={8}>8</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <ChevronDown size={16} className="text-gray-400" />
              </div>
            </div>
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !segmento.trim() || !cidade.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-indigo-600/30 disabled:text-white/40 h-14 px-8 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/40 flex items-center justify-center gap-3 w-full md:w-auto shrink-0 mt-2 md:mt-0"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            {loading ? 'A procurar...' : 'Buscar Leads'}
          </button>
        </div>
      </section>

      {/* Warning banner for simulation mode */}
      {searchError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">{searchError}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <Loader2 size={32} className="animate-spin text-indigo-400 mx-auto mb-4" />
          <p className="text-gray-400 font-semibold">A analisar o mercado de <span className="text-indigo-300">{segmento}</span> em <span className="text-indigo-300">{cidade}</span>...</p>
        </div>
      )}

      {/* Results */}
      {searchDone && results.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              {results.length} leads encontrados — <span className="text-indigo-400">{segmento}</span> em <span className="text-indigo-400">{cidade}</span>
            </h2>
          </div>

          <div className="space-y-4 stagger-children">
            {results.map((lead, index) => {
              const isExpanded = expandedId === lead.nome;
              const badgeClass = `badge-${lead.classificacao.toLowerCase()}`;
              const btn = getButtonContent(lead.nome);

              return (
                <div key={lead.nome} className="glass-card overflow-hidden">
                  {/* Main row */}
                  <div
                    className="p-4 md:p-5 flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-5 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : lead.nome)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg font-extrabold text-gray-400 shrink-0">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-100 text-sm md:text-base">{lead.nome}</h3>
                      <p className="text-xs text-gray-500 truncate">{lead.bairro}, {lead.endereco}</p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${badgeClass}`}>
                      {lead.emoji} {lead.score}%
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-emerald-400">{formatCurrency(lead.potencial_receita)}/mês</p>
                      <p className="text-[10px] text-gray-500">receita potencial</p>
                    </div>
                    {isExpanded ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="border-t border-white/5 p-5 space-y-5 animate-fade-in">
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                        <PresenceBadge 
                          label="Site" 
                          has={lead.tem_site} 
                          url={lead.website || `https://www.google.com/search?q=${encodeURIComponent(lead.nome + ' ' + lead.endereco)}`}
                          icon={Globe}
                        />
                        <PresenceBadge 
                          label="Maps" 
                          has={lead.google_maps_completo} 
                          url={lead.place_id ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.nome)}&query_place_id=${lead.place_id}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.nome + ' ' + lead.endereco)}`}
                          icon={MapPin}
                        />
                        <PresenceBadge 
                          label="Instagram" 
                          has={lead.instagram_ativo} 
                          url={`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(lead.nome)}`}
                          icon={Camera}
                        />
                        <PresenceBadge 
                          label="WhatsApp" 
                          has={lead.tem_whatsapp_business} 
                          url={`https://wa.me/${lead.telefone?.replace(/\D/g, '').length === 9 ? '351' + lead.telefone.replace(/\D/g, '') : lead.telefone?.replace(/\D/g, '') || ''}`}
                          icon={MessageCircle}
                        />
                        <PresenceBadge 
                          label="E-commerce" 
                          has={lead.tem_ecommerce} 
                          url={lead.website || `https://www.google.com/search?q=${encodeURIComponent(lead.nome + ' loja online')}`}
                          icon={ShoppingCart}
                        />
                        <div className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/5">
                          <p className="text-base font-bold text-yellow-400">{lead.avaliacao_google}⭐</p>
                          <p className="text-[10px] text-gray-500">{lead.total_avaliacoes} reviews</p>
                        </div>
                      </div>

                      <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Decomposição do Score</p>
                        <div className="flex flex-wrap gap-2">
                          {lead.detalhes.map((d, i) => (
                            <span key={i} className="text-[11px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-1 rounded-lg">{d}</span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Serviços Recomendados</p>
                        <div className="flex flex-wrap gap-2">
                          {lead.servicos_recomendados.map((s, i) => (
                            <span key={i} className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-3 py-1.5 rounded-lg font-semibold">{s}</span>
                          ))}
                        </div>
                      </div>

                      <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl">
                        <p className="text-xs text-amber-300 font-semibold">💡 Insight IA: {lead.observacoes}</p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); salvarLead(lead); }}
                          disabled={btn.disabled}
                          className={`${btn.className} flex items-center gap-2 text-sm flex-1 justify-center`}
                        >
                          {btn.text}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            let num = lead.telefone.replace(/\D/g, '');
                            if (num.length === 9) num = '351' + num;
                            window.open(`https://wa.me/${num}`, '_blank');
                          }}
                          className="btn-success flex items-center gap-2 text-sm"
                        >
                          <MessageCircle size={16} />
                          WhatsApp
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(lead.telefone);
                          }}
                          className="btn-secondary flex items-center gap-2 text-sm"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PresenceBadge({ label, has, url, icon: Icon }: { label: string; has: boolean; url?: string | null; icon?: any }) {
  const isLink = has && url;
  
  const content = (
    <>
      {has ? (
        Icon ? <Icon size={18} className="text-emerald-400 mx-auto mb-1" /> : <CheckCircle2 size={18} className="text-emerald-400 mx-auto mb-1" />
      ) : (
        <p className="text-base leading-none mb-1">❌</p>
      )}
      <p className="text-[10px] text-gray-500 font-semibold">{label}</p>
    </>
  );

  const baseClasses = "text-center p-2 rounded-lg border flex flex-col items-center justify-center transition-all duration-200 h-full w-full";
  
  if (isLink) {
    return (
      <a 
        href={url as string}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={`Abrir ${label}`}
        className={`${baseClasses} bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:-translate-y-0.5 cursor-pointer`}
      >
        {content}
      </a>
    );
  }

  return (
    <div className={`${baseClasses} ${has ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/5 border-red-500/10 opacity-70'}`}>
      {content}
    </div>
  );
}
// Forcing TS update
