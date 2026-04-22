// ═══════════════════════════════════════
// LeadFlow — Lead Scoring Engine
// ═══════════════════════════════════════

export interface LeadScoringInput {
  tem_site: boolean;
  tem_google_maps: boolean;
  google_maps_completo: boolean;
  tem_instagram: boolean;
  instagram_ativo: boolean;
  tem_ecommerce: boolean;
  segmento_alta_demanda: boolean;
  concorrentes_com_presenca: boolean;
  negocio_estabelecido: boolean;
  ticket_medio_alto: boolean;
}

export interface ScoreResult {
  score: number;
  classificacao: 'QUENTE' | 'MORNO' | 'FRIO' | 'BAIXO';
  emoji: string;
  cor: string;
  detalhes: string[];
}

const SEGMENTOS_ALTA_DEMANDA = [
  'restaurante', 'gastronomia', 'saúde', 'clínica', 'dentista',
  'beleza', 'cabeleireiro', 'estética', 'fitness', 'ginásio',
  'padaria', 'café', 'hotel', 'alojamento', 'oficina',
  'imobiliária', 'farmácia', 'veterinário',
];

export function isSegmentoAltaDemanda(nicho: string): boolean {
  const lower = nicho.toLowerCase();
  return SEGMENTOS_ALTA_DEMANDA.some(s => lower.includes(s));
}

export function calcularScore(input: LeadScoringInput): ScoreResult {
  let score = 0;
  const detalhes: string[] = [];

  // Sem site próprio: +20
  if (!input.tem_site) {
    score += 20;
    detalhes.push('+20: Sem website próprio');
  }

  // Sem Google Maps ou incompleto: +15
  if (!input.tem_google_maps || !input.google_maps_completo) {
    score += 15;
    detalhes.push('+15: Google Maps ausente ou incompleto');
  }

  // Sem Instagram ou desatualizado: +15
  if (!input.tem_instagram || !input.instagram_ativo) {
    score += 15;
    detalhes.push('+15: Instagram ausente ou inativo');
  }

  // Segmento de alta demanda: +10
  if (input.segmento_alta_demanda) {
    score += 10;
    detalhes.push('+10: Segmento de alta demanda local');
  }

  // Concorrentes com boa presença: +10
  if (input.concorrentes_com_presenca) {
    score += 10;
    detalhes.push('+10: Concorrentes com forte presença digital');
  }

  // Negócio estabelecido (>1 ano): +10
  if (input.negocio_estabelecido) {
    score += 10;
    detalhes.push('+10: Negócio estabelecido (>1 ano)');
  }

  // Sem e-commerce em segmento aplicável: +10
  if (!input.tem_ecommerce) {
    score += 10;
    detalhes.push('+10: Sem e-commerce (potencial de venda online)');
  }

  // Ticket médio alto (>€1.000/mês): +10
  if (input.ticket_medio_alto) {
    score += 10;
    detalhes.push('+10: Ticket médio do segmento elevado');
  }

  // Cap at 100
  score = Math.min(score, 100);

  return {
    score,
    ...getClassificacao(score),
    detalhes,
  };
}

export function getClassificacao(score: number): { classificacao: 'QUENTE' | 'MORNO' | 'FRIO' | 'BAIXO'; emoji: string; cor: string } {
  if (score >= 80) return { classificacao: 'QUENTE', emoji: '🔥', cor: '#10b981' };
  if (score >= 60) return { classificacao: 'MORNO', emoji: '⚡', cor: '#f59e0b' };
  if (score >= 40) return { classificacao: 'FRIO', emoji: '❄️', cor: '#3b82f6' };
  return { classificacao: 'BAIXO', emoji: '⬇️', cor: '#6b7280' };
}

export function getClassificacaoLabel(classificacao: string): string {
  switch (classificacao) {
    case 'QUENTE': return '🔥 QUENTE — Abordagem imediata';
    case 'MORNO': return '⚡ MORNO — Requer 2-3 touchpoints';
    case 'FRIO': return '❄️ FRIO — Nutrição de longo prazo';
    case 'BAIXO': return '⬇️ BAIXO — Fila secundária';
    default: return classificacao;
  }
}
