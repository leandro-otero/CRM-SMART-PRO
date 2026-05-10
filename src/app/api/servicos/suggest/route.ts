import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export async function POST(request: Request) {
  try {
    const { servicosAtuais } = await request.json();

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Chave API do Gemini não configurada.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const servicosLista = servicosAtuais.map((s: any) => `${s.nome} (${s.categoria})`).join(', ');

    const prompt = `És o Motor de Inteligência Comercial de uma agência de Transformação Digital.
O utilizador pediu sugestões de novos serviços para adicionar ao seu portfólio.

Portfólio Atual da Agência:
${servicosLista || 'Nenhum serviço registado.'}

Analisa o portfólio e sugere APENAS UM (1) novo serviço altamente rentável que falte no catálogo, baseado nas tendências de mercado para agências digitais (ex: automação de email, CRM, SEO, TikTok Ads, etc.).

Retorna EXATAMENTE e APENAS este formato JSON:
{
  "rank": 1,
  "motivo": "frase curta explicando porque este serviço é uma boa adição",
  "potencial_receita_adicional": "estimativa em Euros. Ex: € 800/mês com 3 clientes",
  "servico_sugerido": {
    "nome": "nome comercial atraente",
    "categoria": "Web ou Social Media ou Automação ou Tráfego Pago ou Consultoria ou Outro",
    "descricao": "descrição completa do que está incluso",
    "entregaveis": ["item 1", "item 2", "item 3"],
    "tempo_entrega": "prazo estimado, ex: 5 dias",
    "valor_setup": numero inteiro (em euros, ex: 1000. Pode ser 0),
    "valor_mensal": numero inteiro (em euros, ex: 200. Pode ser 0),
    "valor_anual": numero inteiro (em euros, ex: 0),
    "margem_estimada": percentagem inteira (ex: 70),
    "dificuldade": "Básico ou Intermediário ou Avançado",
    "tempo_execucao_mensal": numero inteiro de horas,
    "ferramentas": ["ferramenta 1", "ferramenta 2"],
    "segmentos_ideais": ["nicho 1", "nicho 2"],
    "ativo": true
  }
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid JSON from Gemini');

    const suggestion = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error('[Gemini Services Suggest Error]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
