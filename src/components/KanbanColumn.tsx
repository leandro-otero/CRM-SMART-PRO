'use client';

import { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  children?: ReactNode;
}

export const KanbanColumn = ({ id, title, count, children }: KanbanColumnProps) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  const isOverClass = isOver
    ? 'bg-indigo-500/5 border-indigo-400/20'
    : 'bg-white/[0.02] border-white/[0.04]';

  return (
    <div className="flex flex-col min-w-[290px] w-[290px] h-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</h2>
        <span className="bg-white/5 border border-white/10 text-[11px] text-gray-300 font-bold px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl p-3 overflow-y-auto backdrop-blur-sm transition-colors flex flex-col gap-3 custom-scrollbar border ${isOverClass}`}
      >
        {children}
        {count === 0 && (
          <div className="text-center p-6 text-gray-600 text-xs border-2 border-dashed border-white/5 rounded-lg">
            Arraste leads para aqui
          </div>
        )}
      </div>
    </div>
  );
};
