'use client';

import { useState, useEffect } from 'react';
import { X, Save, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export interface ServiceData {
  id?: string;
  nome: string;
  categoria: string;
  descricao: string;
  entregaveis: string[];
  tempo_entrega: string;
  valor_setup: number;
  valor_mensal: number;
  valor_anual: number;
  valor_hora: number;
  margem_estimada: number;
  dificuldade: string;
  tempo_execucao_mensal: number;
  ferramentas: string[];
  segmentos_ideais: string[];
  ativo: boolean;
  notas_internas: string;
}

interface ServiceModalProps {
  service: Partial<ServiceData> | null;
  onClose: () => void;
  onSave: () => void;
  isSuggestion?: boolean;
  suggestionReason?: string;
  suggestionRevenue?: string;
}

export const ServiceModal = ({ service, onClose, onSave, isSuggestion, suggestionReason, suggestionRevenue }: ServiceModalProps) => {
  const [formData, setFormData] = useState<Partial<ServiceData>>({
    nome: '', categoria: 'Web', descricao: '', entregaveis: [], tempo_entrega: '',
    valor_setup: 0, valor_mensal: 0, valor_anual: 0, valor_hora: 0,
    margem_estimada: 50, dificuldade: 'Intermediário', tempo_execucao_mensal: 0,
    ferramentas: [], segmentos_ideais: [], ativo: true, notas_internas: '',
    ...service
  });
  
  const [entregaveisText, setEntregaveisText] = useState('');
  const [ferramentasText, setFerramentasText] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (service) {
      setFormData(prev => ({ ...prev, ...service }));
      setEntregaveisText(service.entregaveis?.join(', ') || '');
      setFerramentasText(service.ferramentas?.join(', ') || '');
    }
  }, [service]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const finalData = {
        ...formData,
        entregaveis: entregaveisText.split(',').map(item => item.trim()).filter(item => item !== ''),
        ferramentas: ferramentasText.split(',').map(item => item.trim()).filter(item => item !== '')
      };

      if (finalData.id) {
        // Update
        const { error: dbError } = await supabase
          .from('catalogo_servicos')
          .update(finalData)
          .eq('id', finalData.id);
        if (dbError) throw dbError;
      } else {
        // Insert
        const { error: dbError } = await supabase
          .from('catalogo_servicos')
          .insert([finalData]);
        if (dbError) throw dbError;
      }
      onSave();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao salvar serviço.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-dark-surface border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-500/10 to-transparent border-b border-white/5 flex justify-between items-center relative">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {isSuggestion && <Zap size={20} className="text-emerald-400" />}
              {isSuggestion ? 'Sugestão da IA' : formData.id ? 'Editar Serviço' : 'Novo Serviço'}
            </h2>
            {isSuggestion && (
              <p className="text-xs text-emerald-400 mt-1">{suggestionReason}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">{error}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nome do Serviço</label>
              <input type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm text-white" placeholder="Ex: Gestão de Instagram" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Categoria</label>
              <select name="categoria" value={formData.categoria} onChange={handleChange} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm text-white">
                <option className="bg-gray-900 text-white">Web</option>
                <option className="bg-gray-900 text-white">Social Media</option>
                <option className="bg-gray-900 text-white">Automação</option>
                <option className="bg-gray-900 text-white">Tráfego Pago</option>
                <option className="bg-gray-900 text-white">Consultoria</option>
                <option className="bg-gray-900 text-white">E-commerce</option>
                <option className="bg-gray-900 text-white">Google e Reputação</option>
                <option className="bg-gray-900 text-white">Design e Identidade</option>
                <option className="bg-gray-900 text-white">Outro</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Descrição</label>
              <textarea name="descricao" value={formData.descricao} onChange={handleChange} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm text-white min-h-[60px]" />
            </div>
            
            {/* Valores */}
            <div>
              <label className="block text-xs text-emerald-400/70 mb-1">Valor Setup (€)</label>
              <input type="number" name="valor_setup" value={formData.valor_setup} onChange={handleChange} className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2 text-sm text-emerald-400 font-bold" />
            </div>
            <div>
              <label className="block text-xs text-indigo-400/70 mb-1">Valor Mensal (€)</label>
              <input type="number" name="valor_mensal" value={formData.valor_mensal} onChange={handleChange} className="w-full bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-2 text-sm text-indigo-400 font-bold" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Valor Anual (Licenças) (€)</label>
              <input type="number" name="valor_anual" value={formData.valor_anual} onChange={handleChange} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Margem Estimada (%)</label>
              <input type="number" name="margem_estimada" value={formData.margem_estimada} onChange={handleChange} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm text-white" />
            </div>
            
            {/* Operational */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Dificuldade</label>
              <select name="dificuldade" value={formData.dificuldade} onChange={handleChange} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm text-white">
                <option className="bg-gray-900 text-white">Básico</option>
                <option className="bg-gray-900 text-white">Intermediário</option>
                <option className="bg-gray-900 text-white">Avançado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Horas Mensais (manutenção)</label>
              <input type="number" name="tempo_execucao_mensal" value={formData.tempo_execucao_mensal} onChange={handleChange} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Prazo Setup (ex: 5 dias)</label>
              <input type="text" name="tempo_entrega" value={formData.tempo_entrega} onChange={handleChange} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm text-white" />
            </div>
            <div className="flex items-center mt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.ativo} onChange={(e) => setFormData(p => ({ ...p, ativo: e.target.checked }))} className="w-4 h-4 rounded border-gray-600 bg-black/50" />
                <span className="text-sm text-gray-300">Serviço Ativo</span>
              </label>
            </div>

            {/* Arrays */}
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Entregáveis (separados por vírgula)</label>
              <textarea value={entregaveisText} onChange={(e) => setEntregaveisText(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm text-white min-h-[60px]" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Ferramentas Usadas (separadas por vírgula)</label>
              <input type="text" value={ferramentasText} onChange={(e) => setFerramentasText(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm text-white" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 flex justify-end gap-3 bg-black/20">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={loading} className="btn-primary py-2 px-6 flex items-center gap-2">
            {loading ? <span className="animate-spin">⌛</span> : <Save size={16} />}
            {isSuggestion ? 'Guardar Sugestão' : 'Guardar Serviço'}
          </button>
        </div>
      </div>
    </div>
  );
};
