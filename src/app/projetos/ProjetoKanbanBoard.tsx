'use client';

import { useState, useEffect, memo } from 'react';
import { DndContext, DragEndEvent, closestCorners, useSensor, useSensors, PointerSensor, useDraggable } from '@dnd-kit/core';
import { KanbanColumn } from '@/components/KanbanColumn';
import { supabase } from '@/lib/supabaseClient';
import { ProjetoData } from './page';
import { Users, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

const COLUNAS_PRODUCAO = ['Briefing', 'Execução', 'Aprovação', 'Concluído'];

// --- Projeto Card Component ---
const ProjetoCard = memo(({ projeto }: { projeto: ProjetoData }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: projeto.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50, boxShadow: '0 30px 60px -15px rgba(0,0,0,0.8)', opacity: 0.9 } : undefined;

  const isPago = projeto.status_pagamento === 'pago';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group relative p-4 border rounded-2xl backdrop-blur-md shadow-lg transition-all hover:bg-white/[0.07] hover:border-indigo-500/20 cursor-grab active:cursor-grabbing flex flex-col gap-3 bg-white/[0.03] border-white/[0.08]`}
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-gray-100 leading-tight truncate">{projeto.nome_servico}</h3>
          <p className="text-[11px] text-indigo-400 font-semibold mt-0.5 flex items-center gap-1">
            <Users size={10} /> {projeto.cliente_nome}
          </p>
        </div>
        <span className="bg-white/5 px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-wider text-gray-400 font-bold shrink-0 ml-2">
          {projeto.tipo}
        </span>
      </div>

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5">
          {isPago ? (
            <span className="text-[10px] flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded"><CheckCircle2 size={10} /> PAGO</span>
          ) : (
            <span className="text-[10px] flex items-center gap-1 text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded"><AlertCircle size={10} /> PENDENTE</span>
          )}
        </div>
        {projeto.data_vencimento && (
          <span className="text-[10px] text-gray-500 flex items-center gap-1 font-medium">
            <Clock size={10} /> {new Date(projeto.data_vencimento).toLocaleDateString('pt-PT')}
          </span>
        )}
      </div>
    </div>
  );
});
ProjetoCard.displayName = 'ProjetoCard';


// --- Kanban Board Component ---
export const ProjetoKanbanBoard = ({ initialProjetos, isLoading }: { initialProjetos: ProjetoData[], isLoading: boolean }) => {
  const [projetos, setProjetos] = useState<ProjetoData[]>(initialProjetos);

  useEffect(() => {
    if (initialProjetos.length > 0) setProjetos(initialProjetos);
  }, [initialProjetos]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const cardId = active.id as string;
    const novaColuna = over.id as string;
    const projeto = projetos.find(p => p.id === cardId);

    if (projeto && projeto.fase_producao !== novaColuna) {
      setProjetos(prev => prev.map(p => p.id === cardId ? { ...p, fase_producao: novaColuna } : p));
      await supabase.from('servicos_contratados').update({ fase_producao: novaColuna }).eq('id', cardId);
      
      await supabase.from('atividade_log').insert({
        entidade_tipo: 'tarefa',
        entidade_id: cardId,
        acao: `Produção: Movido para ${novaColuna}`,
        detalhes: `Projeto "${projeto.nome_servico}" do cliente ${projeto.cliente_nome} movido para "${novaColuna}"`,
      });
    }
  };

  if (isLoading && initialProjetos.length === 0) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-indigo-400 font-bold animate-pulse">A carregar projetos... ⚡</div>
    </div>
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex overflow-x-auto gap-4 pb-8 pt-2 w-full custom-scrollbar h-full items-start px-1">
        {COLUNAS_PRODUCAO.map(coluna => {
          const projetosNaColuna = projetos.filter(p => (p.fase_producao || 'Briefing') === coluna);
          return (
            <KanbanColumn key={coluna} id={coluna} title={coluna} count={projetosNaColuna.length}>
              {projetosNaColuna.map(projeto => (<ProjetoCard key={projeto.id} projeto={projeto} />))}
            </KanbanColumn>
          );
        })}
      </div>
    </DndContext>
  );
};
