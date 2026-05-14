'use client';

import { X, MessageCircle, MapPin, Star, Globe, Camera, TrendingUp, DollarSign, Copy, ExternalLink, Mail, Zap, CheckCircle, XCircle, ShoppingCart, History, Plus, Calendar } from 'lucide-react';
import { LeadData } from './LeadCard';
import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/servicePortfolio';
import { useToast } from '@/components/ToastProvider';
import { getClassificacaoLabel } from '@/lib/leadScoring';
import { supabase } from '@/lib/supabaseClient';

interface LeadDetailModalProps { lead: LeadData; onClose: () => void; }

export const LeadDetailModal = ({ lead: initialLead, onClose }: LeadDetailModalProps) => {
  const [lead, setLead] = useState<LeadData>(initialLead);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [catalogoServicos, setCatalogoServicos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'detalhes' | 'timeline'>('detalhes');
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const { showToast } = useToast();
  // Calculator states
  const [selectedServices, setSelectedServices] = useState<string[]>(initialLead.servicos_recomendados || []);
  const [discountRate, setDiscountRate] = useState<number>(0);
  const [finalValue, setFinalValue] = useState<number>(0);
  const [isManualFinalValue, setIsManualFinalValue] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    supabase.from('catalogo_servicos').select('*').then(({ data }) => {
      if (data) setCatalogoServicos(data);
    });
  }, []);

  const totalSetup = selectedServices.reduce((acc, nome) => {
    const s = catalogoServicos.find(sv => sv.nome.toLowerCase() === nome.toLowerCase() || sv.nome.toLowerCase().includes(nome.toLowerCase()));
    return acc + (s?.valor_setup || 0);
  }, 0);

  const totalMensal = selectedServices.reduce((acc, nome) => {
    const s = catalogoServicos.find(sv => sv.nome.toLowerCase() === nome.toLowerCase() || sv.nome.toLowerCase().includes(nome.toLowerCase()));
    return acc + (s?.valor_mensal || 0);
  }, 0);

  const totalAnual = selectedServices.reduce((acc, nome) => {
    const s = catalogoServicos.find(sv => sv.nome.toLowerCase() === nome.toLowerCase() || sv.nome.toLowerCase().includes(nome.toLowerCase()));
    return acc + (s?.valor_anual || 0);
  }, 0);

  // Auto set delivery date based on max delivery time if not set
  useEffect(() => {
    if (selectedServices.length > 0 && !deliveryDate && catalogoServicos.length > 0) {
      let maxDays = 0;
      selectedServices.forEach(nome => {
        const s = catalogoServicos.find(sv => sv.nome.toLowerCase() === nome.toLowerCase() || sv.nome.toLowerCase().includes(nome.toLowerCase()));
        if (s && s.tempo_entrega) {
          const match = s.tempo_entrega.match(/\d+/);
          if (match) maxDays = Math.max(maxDays, parseInt(match[0]));
        }
      });
      if (maxDays > 0) {
        const d = new Date();
        d.setDate(d.getDate() + maxDays);
        setDeliveryDate(d.toISOString().split('T')[0]);
      } else {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        setDeliveryDate(d.toISOString().split('T')[0]);
      }
    }
  }, [selectedServices, catalogoServicos]);

  useEffect(() => {
    if (!isManualFinalValue) {
      setFinalValue(totalSetup * (1 - discountRate / 100));
    }
  }, [selectedServices, discountRate, totalSetup, isManualFinalValue]);

  const handleFinalValueChange = (val: number) => {
    setFinalValue(val);
    setIsManualFinalValue(true);
    if (totalSetup > 0) {
      const newRate = ((totalSetup - val) / totalSetup) * 100;
      setDiscountRate(newRate > 0 ? parseFloat(newRate.toFixed(2)) : 0);
    }
  };

  const handleDiscountChange = (rate: number) => {
    setDiscountRate(rate);
    setIsManualFinalValue(false);
  };
  
  const toggleService = (nome: string) => {
    setSelectedServices(prev => 
      prev.includes(nome) ? prev.filter(n => n !== nome) : [...prev, nome]
    );
  };

  const handleConfirmValores = async () => {
    setIsConfirming(true);
    try {
      await supabase.from('leads_prospeccao').update({ status_funil: 'Fechado' }).eq('id', lead.id);

      let clientId = null;
      const { data: existingClient } = await supabase.from('clientes').select('id').eq('nome_empresa', lead.nome_empresa).single();
      
      if (existingClient) {
        clientId = existingClient.id;
        await supabase.from('clientes').update({ lead_origem_id: lead.id }).eq('id', clientId);
      } else {
        const { data: newClient } = await supabase.from('clientes').insert({
          nome_empresa: lead.nome_empresa,
          responsavel: lead.responsavel || '',
          telefone: lead.telefone_google || '',
          whatsapp: lead.whatsapp_extraido || '',
          email: lead.email_extraido || '',
          endereco: lead.morada || '',
          segmento: lead.nicho || '',
          lead_origem_id: lead.id,
          status: 'ATIVO'
        }).select().single();
        if (newClient) clientId = newClient.id;
      }

      if (clientId && selectedServices.length > 0) {
        const servicosToInsert: any[] = [];
        selectedServices.forEach(nome => {
          const s = catalogoServicos.find(sv => sv.nome.toLowerCase() === nome.toLowerCase() || sv.nome.toLowerCase().includes(nome.toLowerCase()));
          servicosToInsert.push({
            cliente_id: clientId,
            nome_servico: nome,
            tipo: 'setup',
            valor: s ? s.valor_setup * (1 - discountRate/100) : 0,
            status: 'ativo'
          });
          if (s && s.valor_mensal > 0) servicosToInsert.push({ cliente_id: clientId, nome_servico: `${nome} (Mensal)`, tipo: 'mensal', valor: s.valor_mensal, status: 'ativo' });
          if (s && s.valor_anual > 0) servicosToInsert.push({ cliente_id: clientId, nome_servico: `${nome} (Anual/Licença)`, tipo: 'anual', valor: s.valor_anual, status: 'ativo' });
        });
        await supabase.from('servicos_contratados').insert(servicosToInsert);
      }

      const tarefas = [];
      if (deliveryDate) {
        tarefas.push({ lead_id: lead.id, cliente_id: clientId, descricao: `Entrega do Serviço: ${selectedServices.join(', ')}`, tipo: 'follow-up', prioridade: 'ALTA', data_agendada: new Date(deliveryDate).toISOString() });
      }
      const upsellDate = new Date();
      upsellDate.setDate(upsellDate.getDate() + 90);
      tarefas.push({ lead_id: lead.id, cliente_id: clientId, descricao: `Follow-up Pós-Venda (Upsell/Cross-sell). Cliente fechado há 3 meses. Serviços originais: ${selectedServices.join(', ')}`, tipo: 'follow-up', prioridade: 'MEDIA', data_agendada: upsellDate.toISOString() });
      await supabase.from('pipeline_tarefas').insert(tarefas);

      await supabase.from('atividade_log').insert({
        entidade_tipo: 'lead',
        entidade_id: lead.id,
        acao: 'Negócio Fechado',
        detalhes: `Valores: Setup: ${formatCurrency(finalValue)} | Mensal: ${formatCurrency(totalMensal)} | Anual: ${formatCurrency(totalAnual)}. Cliente e tarefas criados.`
      });

      showToast('Negócio Fechado e Cliente gerado com sucesso!', 'success');
      onClose();
      setTimeout(() => window.location.reload(), 1500);

    } catch (e) {
      console.error(e);
      showToast('Erro ao fechar negócio', 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleEditPresence = async (type: string, currentUrl: string | undefined) => {
    const url = window.prompt(`Insira o link para ${type}:`, currentUrl || '');
    if (url !== null) {
      const val = url.trim();
      let updatePayload: any = {};
      switch(type) {
        case 'Site':
          updatePayload.website = val;
          updatePayload.tem_site = !!val;
          break;
        case 'Maps':
          updatePayload.google_maps_completo = !!val;
          break;
        case 'Instagram':
          updatePayload.instagram = val;
          updatePayload.tem_instagram = !!val;
          updatePayload.instagram_ativo = !!val;
          break;
        case 'WhatsApp':
          updatePayload.whatsapp_extraido = val;
          updatePayload.tem_whatsapp_business = !!val;
          break;
        case 'E-commerce':
          updatePayload.website = val;
          updatePayload.tem_ecommerce = !!val;
          break;
        case 'Facebook':
          updatePayload.facebook = val;
          break;
      }
      
      if (Object.keys(updatePayload).length > 0) {
        const { error } = await supabase.from('leads_prospeccao').update(updatePayload).eq('id', lead.id);
        if (!error) {
          setLead(prev => ({ ...prev, ...updatePayload }));
        }
      }
    }
  };

  // Fetch timeline for this lead
  const fetchTimeline = async () => {
    setTimelineLoading(true);
    const { data } = await supabase
      .from('atividade_log')
      .select('*')
      .eq('entidade_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setTimeline(data);
    setTimelineLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'timeline') fetchTimeline();
  }, [activeTab]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const score = lead.score_aceitacao || 0;
  const classif = lead.classificacao || 'FRIO';
  const emoji = classif === 'QUENTE' ? '🔥' : classif === 'MORNO' ? '⚡' : classif === 'FRIO' ? '❄️' : '⬇️';
  const badgeClass = `badge-${classif.toLowerCase()}`;

  const handleAnalisar = async () => {
    setIsAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch('/api/leads/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          lead: {
            nome: lead.nome_empresa,
            rating: lead.rating_google || 0,
            total_avaliacoes: lead.total_avaliacoes || 0,
            tem_site: lead.tem_site || false,
            tem_instagram: lead.tem_instagram || false,
            google_maps_completo: lead.google_maps_completo || false,
            tem_whatsapp_business: lead.tem_whatsapp_business || false,
            observacoes: lead.observacoes_ia || lead.dor_identificada || '',
            telefone: lead.whatsapp_extraido || ''
          },
          nicho: lead.nicho,
          localizacao: lead.morada || 'Portugal'
        })
      });
      const data = await res.json();
      if (data.analysis) {
        const { ticket_estimado_mensal, dor_identificada, servico_primario, argumento_venda, copy_icebreaker } = data.analysis;
        const scraped = data.scraped || {};
        
        const updatePayload: any = { 
          ticket_estimado: ticket_estimado_mensal,
          dor_identificada,
          servico_primario,
          argumento_venda,
          copy_icebreaker
        };
        if (scraped.email) updatePayload.email_extraido = scraped.email;
        if (scraped.instagram) updatePayload.instagram = scraped.instagram;
        if (scraped.facebook) updatePayload.facebook = scraped.facebook;

        const { error } = await supabase
          .from('leads_prospeccao')
          .update(updatePayload)
          .eq('id', lead.id);

        if (!error) {
          setLead(prev => ({
            ...prev,
            ticket_estimado: ticket_estimado_mensal,
            dor_identificada,
            servico_primario,
            argumento_venda,
            copy_icebreaker,
            ...(scraped.email && { email_extraido: scraped.email }),
            ...(scraped.instagram && { instagram: scraped.instagram }),
            ...(scraped.facebook && { facebook: scraped.facebook }),
          }));
        }

        // Log AI analysis activity
        await supabase.from('atividade_log').insert({
          entidade_tipo: 'lead',
          entidade_id: lead.id,
          acao: `IA analisou Lead`,
          detalhes: `Score IA: ${data.analysis.score_ia || 'N/A'} | Serviço: ${servico_primario} | Ticket: €${ticket_estimado_mensal}`,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(lead.copy_icebreaker || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-dark-surface/95 border border-white/10 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 md:p-8 bg-gradient-to-br from-indigo-500/8 to-transparent border-b border-white/5 relative">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className={`px-3 py-1 rounded-lg text-xs font-bold ${badgeClass}`}>{emoji} {score}%</div>
            <span className="text-gray-500 text-sm">{lead.status_funil}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">{lead.nome_empresa}</h2>
          <p className="text-indigo-400 font-medium mt-1">{lead.nicho}</p>
          <p className="text-xs text-gray-500 mt-2">{getClassificacaoLabel(classif)}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 px-6 md:px-8">
          <button onClick={() => setActiveTab('detalhes')} className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'detalhes' ? 'text-indigo-400 border-indigo-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
            Detalhes
          </button>
          <button onClick={() => setActiveTab('timeline')} className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 ${activeTab === 'timeline' ? 'text-indigo-400 border-indigo-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
            <History size={13} /> Timeline
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-6">

          {activeTab === 'timeline' && (
            <div className="space-y-1">
              {timelineLoading ? (
                <p className="text-gray-500 text-sm text-center py-8 animate-pulse">A carregar histórico...</p>
              ) : timeline.length === 0 ? (
                <div className="text-center py-12">
                  <History size={32} className="text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">Sem atividade registada para este lead</p>
                  <p className="text-gray-700 text-xs mt-1">Mova o lead no Kanban ou analise com IA para gerar histórico</p>
                </div>
              ) : (
                timeline.map((entry, i) => (
                  <div key={entry.id || i} className="flex gap-3 py-3 border-b border-white/5 last:border-0">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1 ${entry.acao?.includes('Pipeline') ? 'bg-indigo-500' : entry.acao?.includes('IA') ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                      {i < timeline.length - 1 && <div className="w-px flex-1 bg-white/5 mt-1" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 font-medium">{entry.acao}</p>
                      {entry.detalhes && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{entry.detalhes}</p>}
                      <p className="text-[10px] text-gray-700 mt-1">{new Date(entry.created_at).toLocaleString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'detalhes' && (<>
          {/* Quick Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoBox icon={<Star size={16} className="text-yellow-400" />} label="Google Rating" value={`${lead.rating_google || 'N/A'} (${lead.total_avaliacoes || 0} reviews)`} />
            <InfoBox icon={<MapPin size={16} className="text-red-400" />} label="Localização" value={lead.morada || 'Desconhecida'} />
          </div>

          {/* Digital Presence */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Presença Digital</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <PresenceItem 
                label="Site" 
                has={lead.tem_site} 
                url={lead.website || (lead.tem_site ? `https://www.google.com/search?q=${encodeURIComponent(lead.nome_empresa)}` : undefined)}
                icon={Globe}
                onEdit={() => handleEditPresence('Site', lead.website)}
              />
              <PresenceItem 
                label="Maps" 
                has={lead.google_maps_completo} 
                url={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.nome_empresa + ' ' + (lead.morada || ''))}`}
                icon={MapPin}
                onEdit={() => handleEditPresence('Maps', '')}
              />
              <PresenceItem 
                label="Instagram" 
                has={lead.instagram_ativo} 
                url={lead.instagram || (lead.instagram_ativo ? `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(lead.nome_empresa)}` : undefined)}
                icon={Camera}
                onEdit={() => handleEditPresence('Instagram', lead.instagram)}
              />
              <PresenceItem 
                label="WhatsApp" 
                has={lead.tem_whatsapp_business} 
                url={lead.whatsapp_extraido ? `https://wa.me/${lead.whatsapp_extraido.replace(/\D/g, '').length === 9 ? '351' + lead.whatsapp_extraido.replace(/\D/g, '') : lead.whatsapp_extraido.replace(/\D/g, '')}` : undefined}
                icon={MessageCircle}
                onEdit={() => handleEditPresence('WhatsApp', lead.whatsapp_extraido)}
              />
              <PresenceItem 
                label="E-commerce" 
                has={lead.tem_ecommerce} 
                url={lead.website || (lead.tem_ecommerce ? `https://www.google.com/search?q=${encodeURIComponent(lead.nome_empresa + ' loja online')}` : undefined)}
                icon={ShoppingCart}
                onEdit={() => handleEditPresence('E-commerce', lead.website)}
              />
              <PresenceItem 
                label="Facebook" 
                has={!!lead.facebook} 
                url={lead.facebook || undefined}
                icon={Globe}
                onEdit={() => handleEditPresence('Facebook', lead.facebook)}
              />
            </div>
          </div>

          {/* AI Analysis */}
          <div className="bg-indigo-500/5 border border-indigo-500/10 p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><TrendingUp size={16} className="text-emerald-400" />Análise Estratégica</h3>
              <button 
                onClick={handleAnalisar} 
                disabled={isAnalyzing}
                className="btn-primary py-1.5 px-3 text-xs flex items-center gap-2"
              >
                {isAnalyzing ? <span className="animate-spin text-lg leading-none">⟳</span> : <Zap size={14} />}
                {isAnalyzing ? 'Analisando...' : 'Analisar Mercado com IA'}
              </button>
            </div>
            
            {lead.ticket_estimado && (
              <div className="bg-indigo-500/20 p-4 rounded-xl border border-indigo-500/30 shadow-[inset_0_0_20px_rgba(99,102,241,0.1)]">
                <p className="text-[10px] text-indigo-300 uppercase tracking-wider font-bold mb-1">Ticket Estimado de Mercado (MRR)</p>
                <div className="flex items-end gap-2">
                  <p className="text-2xl text-white font-extrabold flex items-center gap-1">
                    <DollarSign size={24} className="text-emerald-400"/>
                    {formatCurrency(lead.ticket_estimado)}
                  </p>
                  <span className="text-xs text-indigo-300 font-normal mb-1">/mês na região de {lead.morada ? lead.morada.split(',')[0] : 'Portugal'}</span>
                </div>
              </div>
            )}
            <div>
              <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider font-bold mb-1">Dor Identificada</p>
              <p className="text-sm text-gray-200">{lead.dor_identificada}</p>
            </div>
            <div>
              <p className="text-[10px] text-indigo-400/70 uppercase tracking-wider font-bold mb-1">Serviço Recomendado</p>
              <p className="text-lg text-indigo-300 font-bold flex items-center gap-2"><DollarSign size={18} />{lead.servico_primario}</p>
            </div>
            {lead.argumento_venda && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Argumento de Venda</p>
                <p className="text-sm text-gray-300 italic">&ldquo;{lead.argumento_venda}&rdquo;</p>
              </div>
            )}
          </div>

          {/* Services Recommended */}
          {(lead.servicos_recomendados && lead.servicos_recomendados.length > 0) || selectedServices.length > 0 ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pacotes Selecionados</h3>
              </div>
              <div className="space-y-2">
                {selectedServices.map((nome, i) => {
                  const s = catalogoServicos.find(sv => sv.nome.toLowerCase() === nome.toLowerCase() || sv.nome.toLowerCase().includes(nome.toLowerCase()));
                  return (
                    <div key={i} className="flex flex-col p-3 rounded-xl border bg-indigo-500/10 border-indigo-500/30 transition-all relative group">
                      <button onClick={() => toggleService(nome)} className="absolute top-2 right-2 p-1 bg-red-500/10 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"><X size={14} /></button>
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border border-indigo-400 bg-indigo-500 flex items-center justify-center">
                           <CheckCircle size={10} className="text-white" />
                        </div>
                        <span className="text-sm font-medium text-white">{nome}</span>
                      </div>
                      {s && (
                        <div className="mt-2 pl-7 flex flex-wrap gap-2 text-[10px] font-bold">
                          <span className="text-gray-400 bg-black/20 px-2 py-0.5 rounded border border-white/5">Setup: <span className="text-white">{formatCurrency(s.valor_setup)}</span></span>
                          {s.valor_mensal > 0 && <span className="text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Mensal: <span className="text-emerald-400">{formatCurrency(s.valor_mensal)}</span></span>}
                          {s.valor_anual > 0 && <span className="text-blue-400/80 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Anual (Licença): <span className="text-blue-400">{formatCurrency(s.valor_anual)}</span></span>}
                          {s.tempo_entrega && <span className="text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 flex items-center gap-1"><Calendar size={10} /> {s.tempo_entrega}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Extra Service Button */}
              <div className="relative">
                <button onClick={() => setShowServiceDropdown(!showServiceDropdown)} className="btn-secondary w-full border border-dashed border-white/20 flex items-center justify-center gap-2 text-sm text-indigo-300 hover:border-indigo-400/50">
                  <Plus size={16} /> Adicionar Serviço Extra
                </button>
                {showServiceDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-10 bg-dark-surface border border-white/10 rounded-xl shadow-2xl p-2 max-h-48 overflow-y-auto">
                    {catalogoServicos.filter(s => !selectedServices.includes(s.nome)).map(s => (
                      <div key={s.id} onClick={() => { toggleService(s.nome); setShowServiceDropdown(false); }} className="p-2 hover:bg-white/5 rounded-lg cursor-pointer text-sm text-gray-300 flex justify-between items-center">
                        <span>{s.nome}</span>
                        <span className="text-xs text-emerald-400 font-bold">+{formatCurrency(s.valor_setup)}</span>
                      </div>
                    ))}
                    {catalogoServicos.filter(s => !selectedServices.includes(s.nome)).length === 0 && <p className="text-xs text-gray-500 p-2 text-center">Todos os serviços já adicionados</p>}
                  </div>
                )}
              </div>
              
              {/* Calculator */}
              <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Total Setup:</span>
                  <span className="text-white font-medium">{formatCurrency(totalSetup)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Total Mensalidade:</span>
                  <span className="text-emerald-400 font-bold">{formatCurrency(totalMensal)}</span>
                </div>
                {totalAnual > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Total Anual (Licenças):</span>
                    <span className="text-blue-400 font-bold">{formatCurrency(totalAnual)}</span>
                  </div>
                )}
                
                <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block mb-1">Desconto (%) no Setup</label>
                    <input 
                      type="number" 
                      value={discountRate} 
                      onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block mb-1">Valor Final Setup (€)</label>
                    <input 
                      type="number" 
                      value={finalValue > 0 ? parseFloat(finalValue.toFixed(2)) : 0} 
                      onChange={(e) => handleFinalValueChange(parseFloat(e.target.value) || 0)}
                      className="w-full bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-indigo-500"
                      min="0"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider font-bold block mb-1">Data Prevista de Entrega</label>
                  <input 
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">Ao fechar negócio, será criada uma tarefa para esta data.</p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Contact Channels */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Canais de Contacto</h3>
            <div className="flex flex-wrap gap-2">
              {lead.website && <a href={lead.website} target="_blank" className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs transition-all"><Globe size={14} />Website <ExternalLink size={12} /></a>}
              {lead.whatsapp_extraido && <a href={`https://wa.me/${lead.whatsapp_extraido.replace(/\D/g, '').length === 9 ? '351' + lead.whatsapp_extraido.replace(/\D/g, '') : lead.whatsapp_extraido.replace(/\D/g, '')}`} target="_blank" className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 transition-all font-bold"><MessageCircle size={14} />WhatsApp</a>}
              {lead.email_extraido && <a href={`mailto:${lead.email_extraido}`} className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs transition-all"><Mail size={14} />E-mail</a>}
              {lead.instagram && <a href={lead.instagram} target="_blank" className="flex items-center gap-2 px-3 py-2 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 rounded-xl text-xs text-pink-400 transition-all"><Camera size={14} />Instagram</a>}
              {lead.facebook && <a href={lead.facebook} target="_blank" className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-xs text-blue-400 transition-all"><Globe size={14} />Facebook</a>}
            </div>
          </div>

          {/* Icebreaker Script */}
          {lead.copy_icebreaker && (
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Script de Abordagem</p>
              <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                <p className="text-sm text-gray-300 leading-relaxed">{lead.copy_icebreaker}</p>
                <button onClick={handleCopyScript} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1">
                  <Copy size={12} /> {copied ? '✅ Copiado!' : 'Copiar Script'}
                </button>
              </div>
            </div>
          )}
          </>)}
        </div>

        {/* Footer */}
        <div className="p-5 bg-white/[0.03] border-t border-white/5 flex gap-3 flex-wrap">
          <button onClick={onClose} className="btn-secondary text-sm">Fechar</button>
          <button onClick={() => { let num = lead.whatsapp_extraido?.replace(/\D/g, ''); if (num && num.length === 9) num = '351' + num; if (num) window.open(`https://wa.me/${num}`, '_blank'); }} className="btn-secondary flex items-center justify-center gap-2 text-sm">
            <MessageCircle size={16} />Iniciar Conversa
          </button>
          {lead.status_funil !== 'Fechado' && (
            <button 
              onClick={handleConfirmValores} 
              disabled={isConfirming}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {isConfirming ? <span className="animate-spin text-lg leading-none">⟳</span> : <CheckCircle size={18} />}
              {isConfirming ? 'A Fechar Negócio...' : 'Confirmar Valores e Fechar Negócio'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

function InfoBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl">
      {icon}
      <div><p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{label}</p><p className="text-sm text-gray-200 font-medium truncate">{value}</p></div>
    </div>
  );
}

function PresenceItem({ label, has, url, icon: Icon, onEdit }: { label: string; has?: boolean; url?: string; icon?: React.ComponentType<{ size?: number; className?: string }>; onEdit?: () => void }) {
  if (has === undefined) return <div className="text-center p-2 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center"><p className="text-sm text-gray-600">—</p><p className="text-[10px] text-gray-600">{label}</p></div>;

  const content = (
    <>
      {has ? (
        Icon ? <Icon size={16} className="text-emerald-400 mx-auto mb-0.5" /> : <CheckCircle size={16} className="text-emerald-400 mx-auto mb-0.5" />
      ) : (
        <XCircle size={16} className="text-red-400 mx-auto mb-0.5" />
      )}
      <p className="text-[10px] text-gray-500">{label}</p>
    </>
  );

  const baseClasses = "text-center p-2 rounded-lg border flex flex-col items-center justify-center transition-all duration-200";

  if (has && url) {
    return (
      <a
        href={url}
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
    <button 
      onClick={onEdit} 
      className={`${baseClasses} w-full ${has ? 'bg-emerald-500/10 border-emerald-500/15 cursor-pointer hover:bg-emerald-500/20' : 'bg-red-500/5 border-red-500/10 opacity-70 hover:opacity-100 hover:border-red-400/30 cursor-pointer'}`}
      title={!has ? `Adicionar link para ${label}` : `Editar link para ${label}`}
    >
      {content}
    </button>
  );
}
