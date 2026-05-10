import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Google Places API (Text Search) — same approach as the existing Google Apps Script
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  types?: string[];
  geometry?: {
    location: { lat: number; lng: number };
  };
  opening_hours?: { open_now?: boolean };
}

interface PlacesApiResponse {
  status: string;
  results: PlaceResult[];
  next_page_token?: string;
  error_message?: string;
}

// Coordinates for Portuguese cities
const CITY_COORDS: Record<string, string> = {
  porto: '41.1579,-8.6291',
  lisboa: '38.7223,-9.1393',
  braga: '41.5454,-8.4265',
  coimbra: '40.2033,-8.4103',
  faro: '37.0194,-7.9304',
  aveiro: '40.6405,-8.6538',
  viseu: '40.6566,-7.9125',
  leiria: '39.7437,-8.8071',
  guimaraes: '41.4425,-8.2918',
  'vila real': '41.3006,-7.7441',
  braganca: '41.8061,-6.7567',
  setubal: '38.5244,-8.8882',
  funchal: '32.6669,-16.9241',
  evora: '38.5719,-7.9097',
  viana: '41.6918,-8.8345',
};

function getCityCoords(cidade: string): string | null {
  const normalized = cidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (normalized.includes(key)) return coords;
  }
  return null;
}

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_MAX = 20; // max requests
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// In-memory cache to prevent duplicate Google API calls
const searchCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function POST(request: Request) {
  try {
    // Apply basic IP-based rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    const now = Date.now();
    const rateData = rateLimitMap.get(ip) || { count: 0, lastReset: now };
    
    if (now - rateData.lastReset > RATE_LIMIT_WINDOW_MS) {
      rateData.count = 1;
      rateData.lastReset = now;
    } else {
      rateData.count++;
      if (rateData.count > RATE_LIMIT_MAX) {
        return NextResponse.json({ error: 'Muitos pedidos. Tente novamente em alguns minutos.' }, { status: 429 });
      }
    }
    rateLimitMap.set(ip, rateData);

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

    // 2. Process Request
    const { segmento, cidade, quantidade = 10 } = await request.json();

    if (!segmento || !cidade) {
      return NextResponse.json({ error: 'Segmento e cidade são obrigatórios' }, { status: 400 });
    }

    // 3. Check Cache
    const cacheKey = `${segmento.toLowerCase().trim()}-${cidade.toLowerCase().trim()}-${quantidade}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[Cache Hit] Returning cached results for: ${cacheKey}`);
      return NextResponse.json(cached.data);
    }

    if (!GOOGLE_API_KEY) {
      return NextResponse.json({
        error: 'GOOGLE_PLACES_API_KEY não configurada',
        leads: [],
        mode: 'no_api_key',
      }, { status: 200 });
    }

    const coords = getCityCoords(cidade);
    const query = encodeURIComponent(`${segmento} em ${cidade}, Portugal`);

    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_API_KEY}&language=pt-PT`;
    if (coords) {
      url += `&location=${coords}&radius=15000`;
    }

    const response = await fetch(url);
    const data: PlacesApiResponse = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[Places API Error]', data.status, data.error_message);
      return NextResponse.json({
        error: `Google Places API: ${data.status} — ${data.error_message || 'Erro desconhecido'}`,
        leads: [],
        mode: 'api_error',
      }, { status: 200 });
    }

    const results = (data.results || [])
      .filter(p => p.business_status === 'OPERATIONAL' || !p.business_status)
      .slice(0, quantidade);

    // Now enrich each result with Place Details (phone, website, etc.)
    const enrichedLeads = await Promise.all(
      results.map(async (place) => {
        const details = await fetchPlaceDetails(place.place_id);
        return {
          place_id: place.place_id,
          nome: place.name,
          endereco: place.formatted_address,
          bairro: extractBairro(place.formatted_address),
          telefone: details?.formatted_phone_number || details?.international_phone_number || '',
          avaliacao_google: place.rating || 0,
          total_avaliacoes: place.user_ratings_total || 0,
          tem_site: !!details?.website,
          website: details?.website || null,
          tem_instagram: false, // Cannot determine from Places API alone
          instagram_ativo: false,
          google_maps_completo: !!(
            place.rating &&
            details?.formatted_phone_number &&
            details?.opening_hours
          ),
          tem_whatsapp_business: false, // Would need manual/scraping check
          tem_ecommerce: false, // Would need website analysis
          tempo_mercado_estimado: estimateAge(details),
          observacoes: generateObservation(place, details),
          tipos: place.types || [],
        };
      })
    );

    const responseData = {
      leads: enrichedLeads,
      mode: 'api',
      total: enrichedLeads.length,
      query: `${segmento} em ${cidade}`,
    };

    // Save to cache
    searchCache.set(cacheKey, { timestamp: Date.now(), data: responseData });

    return NextResponse.json(responseData);
  } catch (err) {
    console.error('[API Route Error]', err);
    return NextResponse.json({ error: 'Erro interno do servidor', leads: [], mode: 'error' }, { status: 500 });
  }
}

// ─── Place Details ───────────────────────────────────────

interface PlaceDetails {
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  opening_hours?: { open_now?: boolean; weekday_text?: string[] };
  reviews?: { rating: number; text: string; time: number }[];
  url?: string; // Google Maps URL
}

async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!GOOGLE_API_KEY) return null;
  try {
    const fields = 'formatted_phone_number,international_phone_number,website,opening_hours,reviews,url';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}&language=pt-PT`;
    const res = await fetch(url);
    const data = await res.json();
    return data.status === 'OK' ? data.result : null;
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────

function extractBairro(address: string): string {
  const parts = address.split(',').map(p => p.trim());
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
}

function estimateAge(details: PlaceDetails | null): string {
  if (!details?.reviews?.length) return '1 ano';
  const oldestReview = details.reviews.reduce((oldest, r) => r.time < oldest.time ? r : oldest, details.reviews[0]);
  const yearsSinceOldest = Math.floor((Date.now() / 1000 - oldestReview.time) / (365 * 24 * 3600));
  return `${Math.max(1, yearsSinceOldest)} anos`;
}

function generateObservation(place: PlaceResult, details: PlaceDetails | null): string {
  const obs: string[] = [];
  if (!details?.website) obs.push('Sem website — invisível online para novos clientes');
  if (!details?.formatted_phone_number) obs.push('Sem telefone publicado no Google');
  if (place.rating && place.rating < 4.0) obs.push(`Rating baixo (${place.rating}) — risco de reputação`);
  if (place.rating && place.rating >= 4.5 && (place.user_ratings_total || 0) > 50) obs.push('Excelente reputação — potencial para escalar digitalmente');
  if (!details?.opening_hours) obs.push('Horário de funcionamento não publicado');
  if (details?.reviews && details.reviews.length < 10) obs.push('Poucas avaliações — concorrentes podem estar à frente');
  if (obs.length === 0) obs.push('Negócio com boa presença básica — oportunidade em serviços avançados');
  return obs.join('. ');
}
