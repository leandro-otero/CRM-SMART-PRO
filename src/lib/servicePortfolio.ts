// ═══════════════════════════════════════
// LeadFlow — Service Portfolio & Pricing
// ═══════════════════════════════════════

export const CURRENCY = '€';

export interface Servico {
  id: string;
  nome: string;
  setup: number;
  mensal: number;
  anual: number;
  descricao: string;
  inclui: string[];
}

export const SERVICOS: Servico[] = [
  {
    id: 'landing-page',
    nome: 'Landing Page',
    setup: 1800,
    mensal: 120,
    anual: 240,
    descricao: 'Página de destino profissional e otimizada',
    inclui: ['Design responsivo', 'Mobile-first', 'SEO básico', 'Formulário de contacto'],
  },
  {
    id: 'ecommerce',
    nome: 'E-Commerce',
    setup: 4500,
    mensal: 350,
    anual: 480,
    descricao: 'Loja online completa com gestão de produtos',
    inclui: ['Catálogo de produtos', 'Pagamentos integrados', 'Gestão de stock', 'Relatórios de vendas'],
  },
  {
    id: 'google-maps',
    nome: 'Google Maps / Perfil Local',
    setup: 450,
    mensal: 80,
    anual: 0,
    descricao: 'Otimização e gestão do perfil Google Business',
    inclui: ['Fotos profissionais', 'Posts regulares', 'Gestão de reviews', 'Dados completos'],
  },
  {
    id: 'instagram',
    nome: 'Gestão de Instagram',
    setup: 600,
    mensal: 480,
    anual: 0,
    descricao: 'Gestão completa de conteúdo para Instagram',
    inclui: ['12 posts/mês', 'Stories + Reels', 'Legendas + Hashtags', 'Relatório mensal'],
  },
  {
    id: 'automacao',
    nome: 'Automação WhatsApp',
    setup: 800,
    mensal: 220,
    anual: 0,
    descricao: 'Chatbot e automação de atendimento via WhatsApp',
    inclui: ['Chatbot inteligente', 'Respostas automáticas', 'Agendamentos', 'Lembretes automáticos'],
  },
  {
    id: 'trafego',
    nome: 'Tráfego Pago',
    setup: 700,
    mensal: 550,
    anual: 0,
    descricao: 'Gestão de campanhas Google Ads + Meta Ads',
    inclui: ['Criação de campanhas', 'Testes A/B', 'Relatório semanal', 'Remarketing'],
  },
];

export interface Pacote {
  id: string;
  nome: string;
  servicos: string[];
  setupTotal: number;
  mensalTotal: number;
  anualTotal: number;
  desconto: number; // percentage
}

export const PACOTES: Pacote[] = [
  {
    id: 'basico',
    nome: 'Pacote Básico',
    servicos: ['landing-page', 'google-maps', 'instagram'],
    setupTotal: 2850,
    mensalTotal: 680,
    anualTotal: 240,
    desconto: 0,
  },
  {
    id: 'intermediario',
    nome: 'Pacote Intermédio',
    servicos: ['landing-page', 'google-maps', 'instagram', 'automacao'],
    setupTotal: 3650,
    mensalTotal: 900,
    anualTotal: 240,
    desconto: 5,
  },
  {
    id: 'completo',
    nome: 'Pacote Digital Completo',
    servicos: ['landing-page', 'ecommerce', 'google-maps', 'instagram', 'automacao', 'trafego'],
    setupTotal: 8850,
    mensalTotal: 1800,
    anualTotal: 720,
    desconto: 10,
  },
];

export function calcularSetupTotal(servicoIds: string[]): number {
  return SERVICOS
    .filter(s => servicoIds.includes(s.id))
    .reduce((sum, s) => sum + s.setup, 0);
}

export function calcularMensalTotal(servicoIds: string[]): number {
  return SERVICOS
    .filter(s => servicoIds.includes(s.id))
    .reduce((sum, s) => sum + s.mensal, 0);
}

export function calcularAnualTotal(servicoIds: string[]): number {
  return SERVICOS
    .filter(s => servicoIds.includes(s.id))
    .reduce((sum, s) => sum + s.anual, 0);
}

export function formatCurrency(value: number): string {
  return `${CURRENCY}${value.toLocaleString('pt-PT')}`;
}
