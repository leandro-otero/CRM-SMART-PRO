'use client';

import { X, MessageCircle, MapPin, Star, Globe, Camera, TrendingUp, DollarSign, Copy, ExternalLink, Mail, Zap, CheckCircle, XCircle, ShoppingCart } from 'lucide-react';
import { LeadData } from './LeadCard';
import { useState, useEffect } from 'react';
import { formatCurrency, SERVICOS } from '@/lib/servicePortfolio';
import { getClassificacaoLabel } from '@/lib/leadScoring';

interface LeadDetailModalProps { lead: LeadData; onClose: () => void; }

export const LeadDetailModal = ({ lead, onClose }: LeadDetailModalProps) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const score = lead.score_aceitacao || 0;
  const classif = lead.classificacao || 'FRIO';
  const emoji = classif === 'QUENTE' ? '🔥' : classif === 'MORNO' ? '⚡' : classif === 'FRIO' ? '❄️' : '⬇️';
  const badgeClass = `badge-${classif.toLowerCase()}`;

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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-6">
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
              />
              <PresenceItem 
                label="Maps" 
                has={lead.google_maps_completo} 
                url={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.nome_empresa + ' ' + (lead.morada || ''))}`}
                icon={MapPin}
              />
              <PresenceItem 
                label="Instagram" 
                has={lead.instagram_ativo} 
                url={lead.instagram || (lead.instagram_ativo ? `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(lead.nome_empresa)}` : undefined)}
                icon={Camera}
              />
              <PresenceItem 
                label="WhatsApp" 
                has={lead.tem_whatsapp_business} 
                url={lead.whatsapp_extraido ? `https://wa.me/${lead.whatsapp_extraido.replace(/\D/g, '')}` : undefined}
                icon={MessageCircle}
              />
              <PresenceItem 
                label="E-commerce" 
                has={lead.tem_ecommerce} 
                url={lead.website || (lead.tem_ecommerce ? `https://www.google.com/search?q=${encodeURIComponent(lead.nome_empresa + ' loja online')}` : undefined)}
                icon={ShoppingCart}
              />
              <PresenceItem 
                label="Facebook" 
                has={!!lead.facebook} 
                url={lead.facebook || undefined}
                icon={Globe}
              />
            </div>
          </div>

          {/* AI Analysis */}
          <div className="bg-indigo-500/5 border border-indigo-500/10 p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><TrendingUp size={16} className="text-emerald-400" />Análise Estratégica</h3>
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
          {lead.servicos_recomendados && lead.servicos_recomendados.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Pacote Recomendado</h3>
              <div className="space-y-2">
                {lead.servicos_recomendados.map((nome, i) => {
                  const s = SERVICOS.find(sv => sv.nome === nome);
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <span className="text-sm text-gray-200 font-medium">{nome}</span>
                      {s && <span className="text-sm text-emerald-400 font-bold">{formatCurrency(s.setup)} + {formatCurrency(s.mensal)}/mês</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contact Channels */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Canais de Contacto</h3>
            <div className="flex flex-wrap gap-2">
              {lead.website && <a href={lead.website} target="_blank" className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs transition-all"><Globe size={14} />Website <ExternalLink size={12} /></a>}
              {lead.whatsapp_extraido && <a href={`https://wa.me/${lead.whatsapp_extraido.replace(/\D/g, '')}`} target="_blank" className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 transition-all font-bold"><MessageCircle size={14} />WhatsApp</a>}
              {lead.email_extraido && <a href={`mailto:${lead.email_extraido}`} className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs transition-all"><Mail size={14} />E-mail</a>}
              {lead.instagram && <a href={lead.instagram} target="_blank" className="flex items-center gap-2 px-3 py-2 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 rounded-xl text-xs text-pink-400 transition-all"><Camera size={14} />Instagram</a>}
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
        </div>

        {/* Footer */}
        <div className="p-5 bg-white/[0.03] border-t border-white/5 flex gap-3">
          <button onClick={onClose} className="btn-secondary text-sm">Fechar</button>
          <button onClick={() => { const num = lead.whatsapp_extraido?.replace(/\D/g, ''); if (num) window.open(`https://wa.me/${num}`, '_blank'); }} className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm">
            <MessageCircle size={16} />Iniciar Conversa
          </button>
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

function PresenceItem({ label, has, url, icon: Icon }: { label: string; has?: boolean; url?: string; icon?: React.ComponentType<{ size?: number; className?: string }> }) {
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
    <div className={`${baseClasses} ${has ? 'bg-emerald-500/10 border-emerald-500/15' : 'bg-red-500/5 border-red-500/10 opacity-70'}`}>
      {content}
    </div>
  );
}
