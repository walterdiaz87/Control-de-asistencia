export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Plus, GraduationCap, Users, Calendar, ArrowRight, BookOpen, Clock } from 'lucide-react';

export default async function Home() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Check if user has an organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id')
    .limit(1)
    .single();

  if (!membership) {
    redirect('/onboarding');
  }

  // Fetch groups
  const { data: groups } = await supabase
    .from('groups')
    .select('*, academic_years(year)')
    .eq('org_id', membership.org_id)
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-1000">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wider uppercase">
            <Calendar className="w-3 h-3" />
            Ciclo Lectivo 2026
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
            Mis Grupos
          </h1>
          <p className="text-slate-500 text-lg">
            Selecciona un curso para comenzar a tomar asistencia.
          </p>
        </div>
        <a
          href="/groups/new"
          className="brand-button-primary w-full md:w-auto px-6"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Grupo
        </a>
      </header>

      {!groups || groups.length === 0 ? (
        <div className="brand-card p-16 text-center space-y-6 bg-white border-dashed border-2 border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
            <BookOpen className="w-10 h-10 text-slate-300" />
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-slate-900">¿Listo para empezar?</p>
            <p className="text-slate-500 max-w-xs mx-auto">
              Crea tu primer curso o taller para organizar a tus alumnos.
            </p>
          </div>
          <a href="/groups/new" className="text-primary font-bold inline-flex items-center gap-1 hover:gap-2 transition-all">
            Crear mi primer grupo <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {groups.map((group) => (
            <div
              key={group.id}
              className="brand-card group relative p-0 overflow-hidden flex flex-col h-full hover:-translate-y-1"
            >
              {/* Accent line based on type */}
              <div className={`h-2 w-full ${group.type === 'course' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />

              <div className="p-8 flex flex-col flex-1">
                <a href={`/attendance/${group.id}`} className="block flex-1 group/content">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-2xl ${group.type === 'course' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {group.type === 'course' ? <BookOpen className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                    </div>
                    <span className="text-slate-400 text-sm font-bold">
                      Año {group.academic_years?.year}
                    </span>
                  </div>

                  <h3 className="text-2xl font-black text-slate-900 mb-2 leading-tight group-hover/content:text-primary transition-colors">
                    {group.name}
                  </h3>
                </a>

                <div className="mt-auto pt-6 flex items-center justify-between border-t border-slate-50">
                  <div className="flex items-center text-slate-500 text-sm font-medium gap-1.5">
                    <Clock className="w-4 h-4" />
                    Última vez: Hoy
                  </div>
                  <div className="flex items-center gap-3">
                    <a href={`/history/${group.id}`} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ver Historial">
                      <BookOpen className="w-4 h-4" />
                    </a>
                    <a href={`/groups/${group.id}/students`} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Gestionar Alumnos">
                      <Users className="w-4 h-4" />
                    </a>
                    <a href={`/attendance/${group.id}`} className="flex items-center text-primary font-bold text-sm tracking-tight hover:gap-2 gap-1 transition-all">
                      TOMAR LISTA
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <footer className="pt-12 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400 text-sm">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5" />
          <span>Asistencia Docente v1.2</span>
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-slate-600 transition-colors">Ayuda</a>
          <a href="#" className="hover:text-slate-600 transition-colors">Ajustes</a>
        </div>
      </footer>
    </main>
  );
}
