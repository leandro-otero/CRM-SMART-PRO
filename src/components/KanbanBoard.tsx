'use client';

import { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, closestCorners, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { LeadCard, LeadData } from './LeadCard';
import { LeadDetailModal } from './LeadDetailModal';
import { supabase } from '@/lib/supabaseClient';

const COLUNAS_OFICIAIS = ['Prospecção', 'Contato', 'Qualificado', 'Proposta Enviada', 'Negociação', 'Fechado'];

interface KanbanBoardProps {
  initialLeads: LeadData[];
  isLoading: boolean;
}

export const KanbanBoard = ({ initialLeads, isLoading }: KanbanBoardProps) => {
  const [leads, setLeads] = useState<LeadData[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);

  useEffect(() => {
    if (initialLeads.length > 0) setLeads(initialLeads);
  }, [initialLeads]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const cardId = active.id as string;
    const novaColuna = over.id as string;
    const lead = leads.find(l => l.id === cardId);

    if (lead && lead.status_funil !== novaColuna) {
      setLeads(prev => prev.map(l => l.id === cardId ? { ...l, status_funil: novaColuna } : l));
      await supabase.from('leads_prospeccao').update({ status_funil: novaColuna, data_entrada_etapa: new Date().toISOString() }).eq('id', cardId);
    }
  };

  if (isLoading && initialLeads.length === 0) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-indigo-400 font-bold animate-pulse">A carregar pipeline... ⚡</div>
    </div>
  );

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex overflow-x-auto gap-4 pb-8 pt-2 w-full custom-scrollbar h-full items-start px-1">
          {COLUNAS_OFICIAIS.map(coluna => {
            const leadsNaColuna = leads.filter(l => l.status_funil === coluna);
            return (
              <KanbanColumn key={coluna} id={coluna} title={coluna} count={leadsNaColuna.length}>
                {leadsNaColuna.map(lead => (<LeadCard key={lead.id} lead={lead} onSelect={setSelectedLead} />))}
              </KanbanColumn>
            );
          })}
        </div>
      </DndContext>
      {selectedLead && <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />}
    </>
  );
};
