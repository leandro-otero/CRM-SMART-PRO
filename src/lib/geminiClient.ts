// ═══════════════════════════════════════
// LeadFlow — Lead Search Client
// Uses real Google Places API when available,
// falls back to simulation when API key is missing
// ═══════════════════════════════════════

import { supabase } from '@/lib/supabaseClient';

export interface LeadBruto {
  place_id?: string;
  nome: string;
  endereco: string;
  bairro: string;
  telefone: string;
  avaliacao_google: number;
  total_avaliacoes: number;
  tem_site: boolean;
  website?: string | null;
  tem_instagram: boolean;
  instagram_ativo: boolean;
  google_maps_completo: boolean;
  tem_whatsapp_business: boolean;
  tem_ecommerce: boolean;
  tempo_mercado_estimado: string;
  observacoes: string;
}

export async function buscarLeads(
  segmento: string,
  cidade: string,
  quantidade: number = 10
): Promise<{ leads: LeadBruto[]; mode: 'api' | 'simulation' | 'error' | 'api_error' }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';

    // Call real API route (which uses Google Places API)
    const res = await fetch('/api/leads/search', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ segmento, cidade, quantidade }),
    });

    const data = await res.json();

    if (data.mode === 'api' && data.leads?.length > 0) {
      return { leads: data.leads, mode: 'api' };
    }

    if (data.mode === 'no_api_key') {
      // Fallback to simulation when no API key configured
      console.warn('Google Places API key not configured — using simulation mode');
      const leads = gerarLeadsSimulados(segmento, cidade);
      return { leads: leads.slice(0, quantidade), mode: 'simulation' };
    }

    if (data.mode === 'api_error') {
      console.error('API error:', data.error);
      const leads = gerarLeadsSimulados(segmento, cidade);
      return { leads: leads.slice(0, quantidade), mode: 'api_error' };
    }

    // Empty results from API
    if (data.leads?.length === 0) {
      return { leads: [], mode: 'api' };
    }

    return { leads: data.leads || [], mode: data.mode || 'api' };
  } catch (err) {
    console.error('Lead search error:', err);
    // Fallback to simulation on network/fetch errors
    const leads = gerarLeadsSimulados(segmento, cidade);
    return { leads: leads.slice(0, quantidade), mode: 'simulation' };
  }
}

// ═══════════════════════════════════════
// Fallback: Simulated leads (only when no API key)
// ═══════════════════════════════════════

function gerarLeadsSimulados(segmento: string, cidade: string): LeadBruto[] {
  const nomes: Record<string, string[]> = {
    restaurante: ['Tasca do Mário', 'Cantina da Sé', 'O Típico', 'Sabores do Norte', 'Adega Velha', 'Restaurante Sol Nascente', 'Taverna Medieval', 'Casa do Arco'],
    'salão de beleza': ['Studio Glamour', 'Beauty Lab', 'Salão Elegância', 'Hair Design Pro', 'Espaço Bela', 'Top Style Studio', 'Beleza Natural'],
    clínica: ['Clínica São Lucas', 'MedCenter Plus', 'Clínica da Saúde', 'Centro Médico Central', 'CliniVida', 'Saúde Total', 'Clínica do Bem'],
    oficina: ['Auto Mecânica Central', 'Garage Express', 'Oficina do Zé', 'Motor Técnico', 'AutoFix Pro', 'Garage Premium'],
    hotel: ['Hotel do Parque', 'Pousada Solar', 'Boutique Hotel', 'Residencial Central', 'Hotel Panorâmico'],
    default: ['Negócio Local Alpha', 'Empresa Beta', 'Loja Gamma', 'Serviços Delta', 'Comércio Epsilon', 'Negócio Zeta', 'Empresa Eta'],
  };

  const bairros = ['Centro Histórico', 'Zona Industrial', 'Bairro Alto', 'Ribeira', 'São João', 'Castelo', 'Sé', 'Mercado'];

  const key = Object.keys(nomes).find(k => segmento.toLowerCase().includes(k)) || 'default';
  const selectedNames = nomes[key] || nomes.default;

  return selectedNames.map((nome, i) => ({
    nome,
    endereco: `Rua ${['Principal', 'do Comércio', 'das Flores', 'Nova', 'Direita', 'de São João', 'do Mercado', 'da Estação'][i % 8]}, ${cidade}`,
    bairro: bairros[i % bairros.length],
    telefone: `+351 9${Math.floor(10000000 + Math.random() * 90000000)}`,
    avaliacao_google: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
    total_avaliacoes: Math.floor(10 + Math.random() * 200),
    tem_site: Math.random() > 0.6,
    tem_instagram: Math.random() > 0.4,
    instagram_ativo: Math.random() > 0.5,
    google_maps_completo: Math.random() > 0.5,
    tem_whatsapp_business: Math.random() > 0.6,
    tem_ecommerce: Math.random() > 0.8,
    tempo_mercado_estimado: `${Math.floor(1 + Math.random() * 15)} anos`,
    observacoes: [
      'Perfil Google com poucas fotos',
      'Sem horário de funcionamento publicado',
      'Avaliações recentes negativas sobre atendimento',
      'Concorrentes do mesmo bairro com forte presença digital',
      'Negócio bem estabelecido mas sem presença online',
      'Alto volume de buscas no segmento para esta região',
      'Potencial para automação de atendimento',
      'Oportunidade de gestão de reputação online',
    ][i % 8],
  }));
}
// Forcing TS update
