'use client';

import { Copy, MessageCircle, AlertCircle, Zap, Clock, Flame } from 'lucide-react';
import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';

export interface LeadData {
  id: string;
  nome_empresa: string;
  nicho: string;
  dor_identificada: string;
  servico_primario: string;
  score_aceitacao: number;
  whatsapp_extraido: string;
  copy_icebreaker: string;
  status_funil: string;
  classificacao?: string;
  potencial_receita_mensal?: number;
  data_entrada_etapa?: string;
  urgencia?: string;
  // Extra fields
  morada?: string;
  rating_google?: number;
  total_avaliacoes?: number;
  website?: string;
  email_extraido?: string;
  instagram?: string;
  argumento_venda?: string;
  ticket_estimado?: number;
  temperatura?: string;
  servicos_recomendados?: string[];
  problemas_digitais?: string[];
  observacoes_ia?: string;
  tem_site?: boolean;
  tem_google_maps?: boolean;
  google_maps_completo?: boolean;
  tem_instagram?: boolean;
  instagram_ativo?: boolean;
  tem_ecommerce?: boolean;
  tem_whatsapp_business?: boolean;
  melhor_abordagem?: string;
  facebook?: string;
}

interface LeadCardProps {
  lead: LeadData;
  onSelect: (lead: LeadData) => void;
}

export const LeadCard = ({ lead, onSelect }: LeadCardProps) => {
  const [copiado, setCopiado] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(lead.copy_icebreaker || '');
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) { console.error('Copy error:', err); }
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const num = lead.whatsapp_extraido?.replace(/\D/g, '');
    if (num) window.open(`https://wa.me/${num}`, '_blank');
  };

  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50, boxShadow: '0 30px 60px -15px rgba(0,0,0,0.8)', opacity: 0.9 } : undefined;

  const score = lead.score_aceitacao || 0;
  const classif = lead.classificacao || (score >= 80 ? 'QUENTE' : score >= 60 ? 'MORNO' : score >= 40 ? 'FRIO' : 'BAIXO');
  const badgeClass = `badge-${classif.toLowerCase()}`;
  const emoji = classif === 'QUENTE' ? '🔥' : classif === 'MORNO' ? '⚡' : classif === 'FRIO' ? '❄️' : '⬇️';

  // Days in stage
  const diasNaEtapa = lead.data_entrada_etapa
    ? Math.floor((Date.now() - new Date(lead.data_entrada_etapa).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(lead)}
      className="group relative p-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl backdrop-blur-md shadow-lg transition-all hover:bg-white/[0.07] hover:border-indigo-500/20 cursor-grab active:cursor-grabbing flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-gray-100 leading-tight truncate">{lead.nome_empresa}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">{lead.nicho}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${badgeClass}`}>
            {emoji} {score}%
          </div>
          <div className="w-16 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${classif === 'QUENTE' ? 'bg-emerald-400' : classif === 'MORNO' ? 'bg-amber-400' : classif === 'FRIO' ? 'bg-blue-400' : 'bg-gray-400'}`} 
              style={{ width: `${score}%` }} 
            />
          </div>
        </div>
      </div>

      {/* Diagnosis */}
      <div className="bg-dark-bg/50 p-2.5 rounded-xl border border-white/5 space-y-1.5">
        <div className="flex items-start gap-2">
          <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-gray-400 leading-snug line-clamp-2">{lead.dor_identificada}</p>
        </div>
        <div className="flex items-start gap-2">
          <Zap size={12} className="text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-indigo-300 leading-snug font-medium">{lead.servico_primario}</p>
        </div>
      </div>

      {/* Footer: days + urgency */}
      <div className="flex items-center justify-between">
        {diasNaEtapa > 0 && (
          <span className={`text-[10px] font-semibold flex items-center gap-1 ${diasNaEtapa >= 5 ? 'text-amber-400' : 'text-gray-600'}`}>
            <Clock size={10} /> {diasNaEtapa}d nesta etapa
          </span>
        )}
        {lead.potencial_receita_mensal && (
          <span className="text-[10px] font-bold text-emerald-400">€{lead.potencial_receita_mensal}/mês</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[11px] py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
        >
          <Copy size={12} />
          {copiado ? 'Copiado!' : 'Copy'}
        </button>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={handleWhatsApp}
          className="flex-[1.2] flex items-center justify-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-[11px] py-1.5 rounded-lg transition-colors font-bold cursor-pointer"
        >
          <MessageCircle size={12} />
          WhatsApp
        </button>
      </div>
    </div>
  );
};
