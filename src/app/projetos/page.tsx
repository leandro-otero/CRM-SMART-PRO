'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { AlertTriangle, Briefcase, RefreshCw } from 'lucide-react';
import { ProjetoKanbanBoard } from './ProjetoKanbanBoard';

export interface ProjetoData {
  id: string;
  cliente_id: string;
  nome_servico: string;
  tipo: string;
  fase_producao: string;
  data_vencimento: string | null;
  status_pagamento: string;
  cliente_nome?: string;
}

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<ProjetoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjetos = async () => {
    setLoading(true);
    setError(null);
    try {
      const [servicosRes, clientesRes] = await Promise.all([
        supabase.from('servicos_contratados').select('*').eq('status', 'ativo'),
        supabase.from('clientes').select('id, nome_empresa')
      ]);

      if (servicosRes.error) throw servicosRes.error;
      if (clientesRes.error) throw clientesRes.error;

      const merged = (servicosRes.data || []).map(s => ({
        ...s,
        cliente_nome: clientesRes.data?.find(c => c.id === s.cliente_id)?.nome_empresa || 'Cliente Desconhecido'
      }));

      setProjetos(merged);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjetos();
    
    let debounceTimer: NodeJS.Timeout;
    const channel = supabase
      .channel('projetos_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servicos_contratados' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fetchProjetos, 400);
      })
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] md:h-screen p-4 md:p-8 max-w-[1600px] mx-auto overflow-hidden">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Briefcase size={28} className="text-indigo-400" />
            Produção & Entregas
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gira o estado dos serviços contratados ativos.</p>
        </div>
        <button onClick={fetchProjetos} className="btn-secondary flex items-center gap-2 text-sm p-2.5">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </header>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6 shrink-0">
          <AlertTriangle size={18} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">✕</button>
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        <ProjetoKanbanBoard initialProjetos={projetos} isLoading={loading} />
      </div>
    </div>
  );
}
