import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

interface LeadParaAnalise {
  nome: string;
  nicho: string;
  rating: number;
  total_avaliacoes: number;
  tem_site: boolean;
  website?: string;
  tem_instagram: boolean;
  google_maps_completo: boolean;
  tem_whatsapp_business: boolean;
  observacoes: string;
  telefone: string;
}

export async function POST(request: Request) {
  try {
    const { lead, nicho, localizacao }: { lead: LeadParaAnalise; nicho: string; localizacao: string } = await request.json();

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ mode: 'no_api_key', analysis: null });
    }

    // Tentar encontrar links de redes sociais no website se houver
    if (lead.tem_site && lead.website) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos max
        const res = await fetch(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const html = await res.text();
          const htmlLower = html.toLowerCase();
          if (htmlLower.includes('instagram.com/')) lead.tem_instagram = true;
          if (htmlLower.includes('facebook.com/')) (lead as any).facebook = true;
        }
      } catch (e) {
        console.log('Timeout ou erro ao verificar site:', e);
      }
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `És o Motor de Inteligência Comercial de uma agência de Transformação Digital portuguesa.

Analisa este negócio local e devolve APENAS um JSON válido com a estrutura abaixo.

DADOS DO NEGÓCIO:
- Nome: ${lead.nome}
- Nicho: ${nicho}
- Localização/Região: ${localizacao}
- Rating Google: ${lead.rating} (${lead.total_avaliacoes} avaliações)
- Tem website: ${lead.tem_site ? 'Sim' : 'Não'}
- Instagram detetado: ${lead.tem_instagram ? 'Sim' : 'Não'}
- Google Maps completo: ${lead.google_maps_completo ? 'Sim' : 'Não'}
- WhatsApp Business: ${lead.tem_whatsapp_business ? 'Sim' : 'Não'}
- Observações: ${lead.observacoes}

REGRAS DE SCORING E ABORDAGEM:
1. O texto DEVE estar em Português de Portugal (pt-PT).
2. Sem erros ortográficos.
3. Não escrevas "Script de Abordagem:" ou qualquer título antes do texto, apenas o corpo da mensagem.
4. O Icebreaker deve ser profissional, direto e elegante, sem usar as palavras "comprar", "preço" ou "vender".

Responde APENAS com este JSON (sem markdown, sem código):
{
  "dor_identificada": "frase curta e impactante da principal dor digital",
  "servico_primario": "nome exato do serviço mais urgente",
  "argumento_venda": "argumento focado na DOR, não na funcionalidade (máx 2 frases)",
  "copy_icebreaker": "Apenas o texto da mensagem pronta a enviar no WhatsApp. 3 parágrafos curtos. Tom consultor. Menciona dado real. CTA para áudio.",
  "temperatura": "QUENTE|MORNO|FRIO",
  "score_ia": número entre 0 e 100,
  "urgencia": "ALTA|MEDIA|BAIXA",
  "setor": "Saúde|Turismo|Comércio|Indústria|Serviços B2B|Gastronomia|Automóvel|Outros",
  "ticket_estimado_mensal": numero inteiro estimado em euros (MRR realista)
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
