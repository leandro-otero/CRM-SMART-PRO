import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

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

    const { servicosAtuais } = await request.json();

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Chave API do Gemini não configurada.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 500,
        temperature: 0.4
      }
    });

    const servicosLista = servicosAtuais.map((s: any) => `${s.nome}(${s.categoria})`).join(',');

    const prompt = `Agência digital pt-PT. Portfólio:${servicosLista||'vazio'}. Sugere 1 novo serviço rentável em falta. JSON:{"rank":1,"motivo":"str","potencial_receita_adicional":"str","servico_sugerido":{"nome":"str","categoria":"Web|Social Media|Automação|Tráfego Pago|Consultoria|Outro","descricao":"str","entregaveis":["str"],"tempo_entrega":"str","valor_setup":num,"valor_mensal":num,"valor_anual":0,"margem_estimada":num,"dificuldade":"Básico|Intermediário|Avançado","tempo_execucao_mensal":num,"ferramentas":["str"],"segmentos_ideais":["str"],"ativo":true}}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const suggestion = JSON.parse(text);

    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error('[Gemini Services Suggest Error]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
