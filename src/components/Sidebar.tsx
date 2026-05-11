'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  LayoutDashboard,
  Search,
  Kanban,
  Users,
  DollarSign,
  Zap,
  Activity,
  CheckSquare,
  Menu,
  X,
  Briefcase,
  ShieldAlert,
  LogOut
} from 'lucide-react';

import { supabase } from '@/lib/supabaseClient';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/prospeccao', label: 'Prospecção', icon: Search },
  { href: '/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/tarefas', label: 'Tarefas', icon: CheckSquare },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/servicos', label: 'Catálogo', icon: Briefcase },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign },
];

export const Sidebar = () => {
  const pathname = usePathname();
  const { session, userProfile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    const fetchOverdue = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('pipeline_tarefas')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente')
        .lt('data_vencimento', today);
      
      if (!error && count !== null) {
        setOverdueCount(count);
      }
    };

    fetchOverdue();
    
    const channel = supabase
      .channel('sidebar_tarefas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_tarefas' }, fetchOverdue)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (pathname === '/login') return null;

  const navContent = (
    <>
      {/* Brand */}
      <div className="p-6 pb-4 flex items-center gap-3 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Zap size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-extrabold text-white tracking-tight">LeadFlow</h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-semibold">ERP &amp; CRM Pro</p>
        </div>
        {/* Close button only on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-gray-400"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
        <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold px-6 mb-2">Menu Principal</p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`sidebar-link relative ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
              <span>{label}</span>
              {label === 'Tarefas' && overdueCount > 0 && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[20px] text-center">
                  {overdueCount}
                </span>
              )}
              {isActive && label !== 'Tarefas' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-light animate-pulse" />
              )}
            </Link>
          );
        })}
        
        {userProfile?.role === 'admin' && (
          <>
            <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold px-6 mb-2 mt-4">Administração</p>
            <Link
              href="/equipa"
              onClick={() => setMobileOpen(false)}
              className={`sidebar-link relative ${pathname === '/equipa' ? 'active' : ''}`}
            >
              <ShieldAlert size={18} strokeWidth={pathname === '/equipa' ? 2.5 : 1.5} />
              <span>Equipa</span>
              {pathname === '/equipa' && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-light animate-pulse" />
              )}
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 flex flex-col gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
          <Activity size={14} className="text-emerald-400 shrink-0" />
          <div className="flex-1 overflow-hidden">
            <p className="text-[10px] text-gray-500 font-semibold truncate">{userProfile?.nome || 'Sistema'}</p>
            <p className="text-xs text-emerald-400 font-bold capitalize">{userProfile?.role || 'Online'}</p>
          </div>
        </div>
        
        <button 
          onClick={signOut}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors w-full text-left"
        >
          <LogOut size={16} />
          <span className="text-sm font-semibold">Sair da Conta</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-[60] p-2.5 rounded-xl bg-dark-surface/90 border border-white/10 backdrop-blur-xl shadow-lg text-gray-300 hover:text-white transition-colors"
        aria-label="Abrir menu"
      >
        <Menu size={22} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="sidebar hidden lg:flex flex-col h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile sidebar drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-[80] w-[280px] backdrop-blur-xl bg-dark-surface/95 border-r border-white/[0.06] flex flex-col h-screen transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </aside>
    </>
  );
};
