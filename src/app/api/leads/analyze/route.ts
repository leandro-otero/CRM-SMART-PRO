import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

interface LeadParaAnalise {
  nome: string;
  nicho: string;
  rating: number;
  total_avaliacoes: number;
  tem_site: boolean;
  tem_instagram: boolean;
  google_maps_completo: boolean;
  tem_whatsapp_business: boolean;
  observacoes: string;
  telefone: string;
}

export async function POST(request: Request) {
  try {
    const { lead, nicho }: { lead: LeadParaAnalise; nicho: string } = await request.json();

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ mode: 'no_api_key', analysis: null });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `És o Motor de Inteligência Comercial de uma agência de Transformação Digital portuguesa.

Analisa este negócio local e devolve APENAS um JSON válido com a estrutura abaixo.

DADOS DO NEGÓCIO:
- Nome: ${lead.nome}
- Nicho: ${nicho}
- Rating Google: ${lead.rating} (${lead.total_avaliacoes} avaliações)
- Tem website: ${lead.tem_site ? 'Sim' : 'Não'}
- Instagram ativo: ${lead.tem_instagram ? 'Sim' : 'Não'}
- Google Maps completo: ${lead.google_maps_completo ? 'Sim' : 'Não'}
- WhatsApp Business: ${lead.tem_whatsapp_business ? 'Sim' : 'Não'}
- Observações: ${lead.observacoes}

REGRAS DE SCORING (soma, máx 100):
- Sem website: +25pts
- Rating < 4.0: +20pts  
- Instagram inativo/ausente: +15pts
- Google Maps incompleto: +15pts
- Sem WhatsApp Business: +10pts
- Nicho alta procura (saúde/restaurante/officina/hotel): +15pts

SERVIÇOS DISPONÍVEIS (escolhe o mais urgente):
- "Landing Page" (sem site)
- "Gestão de Instagram" (sem presença social)
- "Google Maps" (perfil incompleto)
- "Automação WhatsApp" (sem WA Business, nicho atendimento)
- "E-Commerce" (comércio sem loja online)
- "SEO Local" (rating baixo, poucas reviews)

Responde APENAS com este JSON (sem markdown, sem código):
{
  "dor_identificada": "frase curta e impactante da principal dor digital",
  "servico_primario": "nome exato do serviço mais urgente",
  "argumento_venda": "argumento focado na DOR, não na funcionalidade (máx 2 frases)",
  "copy_icebreaker": "mensagem WhatsApp profissional de 3-4 parágrafos curtos para abordar o decisor. Tom: consultor sénior. Menciona dado real (rating/nicho). Aponta dor com elegância. CTA: pedir 1 minuto de áudio. Proibido: palavra 'comprar', 'preço', 'vender'.",
  "temperatura": "QUENTE|MORNO|FRIO",
  "score_ia": número entre 0 e 100,
  "urgencia": "ALTA|MEDIA|BAIXA",
  "setor": "Saúde|Turismo|Comércio|Indústria|Serviços B2B|Gastronomia|Automóvel|Outros"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON from response (handle possible markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid JSON from Gemini');

    const analysis = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ mode: 'ai', analysis });
  } catch (err) {
    console.error('[Gemini Analysis Error]', err);
    return NextResponse.json({ mode: 'error', analysis: null, error: String(err) });
  }
}
