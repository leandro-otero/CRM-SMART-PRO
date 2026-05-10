import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

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
    // 1. Verify Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const token = authHeader.split(' ')[1];
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Analisa este negócio local e gera os outputs estruturados.
Nicho: ${nicho}. Local: ${localizacao}.
DADOS: Nome: ${lead.nome}, Rating: ${lead.rating} (${lead.total_avaliacoes} aval), Site: ${lead.tem_site ? 'Sim' : 'Não'}, Insta: ${lead.tem_instagram ? 'Sim' : 'Não'}, Maps completo: ${lead.google_maps_completo ? 'Sim' : 'Não'}, Wpp: ${lead.tem_whatsapp_business ? 'Sim' : 'Não'}, Obs: ${lead.observacoes}.

REGRAS: pt-PT rigoroso, zero erros. Icebreaker sem "comprar", "preço" ou "vender".

JSON:
{
  "dor_identificada": "frase da dor",
  "servico_primario": "serviço urgente",
  "argumento_venda": "argumento focado na dor",
  "copy_icebreaker": "mensagem Wpp",
  "temperatura": "QUENTE|MORNO|FRIO",
  "score_ia": numero,
  "urgencia": "ALTA|MEDIA|BAIXA",
  "setor": "Saúde|Turismo|Comércio|Indústria|Serviços B2B|Gastronomia|Automóvel|Outros",
  "ticket_estimado_mensal": numero inteiro estimado em euros (MRR realista)
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON
    const analysis = JSON.parse(text);

    return NextResponse.json({ mode: 'ai', analysis });
  } catch (err) {
    console.error('[Gemini Analysis Error]', err);
    return NextResponse.json({ mode: 'error', analysis: null, error: String(err) });
  }
}
