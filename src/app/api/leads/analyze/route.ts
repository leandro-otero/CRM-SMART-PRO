import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// In-memory cache to prevent duplicate Gemini API calls for the same lead
const analyzeCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

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

    // 2. Check Cache
    const cacheKey = `${lead.nome.toLowerCase().trim()}-${localizacao.toLowerCase().trim()}`;
    const cached = analyzeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[Cache Hit] Returning cached analysis for: ${cacheKey}`);
      return NextResponse.json(cached.data);
    }

    // Tentar encontrar links de redes sociais, emails e telefones no website
    let scrapedData: { email?: string; instagram?: string; facebook?: string; telefone?: string } = {};
    if (lead.tem_site && lead.website) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const html = await res.text();
          const htmlLower = html.toLowerCase();
          if (htmlLower.includes('instagram.com/')) lead.tem_instagram = true;
          if (htmlLower.includes('facebook.com/')) (lead as any).facebook = true;

          // Extract Instagram URL
          const igMatch = html.match(/https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?/i);
          if (igMatch) scrapedData.instagram = igMatch[0];

          // Extract Facebook URL
          const fbMatch = html.match(/https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.]+\/?/i);
          if (fbMatch) scrapedData.facebook = fbMatch[0];

          // Extract Email
          const emailMatch = html.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/i);
          if (emailMatch && !emailMatch[1].endsWith('.png') && !emailMatch[1].endsWith('.jpg')) {
            scrapedData.email = emailMatch[1].toLowerCase();
          }

          // Extract Portuguese phone numbers
          const phoneMatch = html.replace(/\s/g, '').match(/(?:00351|\+351)?[\s-]?(9[1236]\d{7})/);
          if (phoneMatch) scrapedData.telefone = phoneMatch[1];
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

    const responseData = { mode: 'ai', analysis, scraped: scrapedData };
    
    // Save to cache
    analyzeCache.set(cacheKey, { timestamp: Date.now(), data: responseData });

    return NextResponse.json(responseData);
  } catch (err) {
    console.error('[Gemini Analysis Error]', err);
    return NextResponse.json({ mode: 'error', analysis: null, error: String(err) });
  }
}
