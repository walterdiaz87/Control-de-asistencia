import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Calendar, GraduationCap } from 'lucide-react';
import AnalyticsDashboard from '@/components/dashboard/AnalyticsDashboard';

export default async function Home() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Check if user has an organization and role
  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', session.user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect('/onboarding');
  }

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black tracking-widest uppercase border border-indigo-100 shadow-sm">
            <Calendar className="w-3.5 h-3.5" />
            Ciclo Lectivo 2026
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-slate-500 text-lg font-medium">
            Panel de control y estadísticas institucionales.
          </p>
        </div>
      </header>

      <AnalyticsDashboard membership={membership} userId={session.user.id} />

      <footer className="pt-12 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400 text-sm">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 opacity-50" />
          <span className="font-bold tracking-tight">Asistencia Docente v1.5</span>
        </div>
        <div className="flex gap-8 font-bold">
          <a href="#" className="hover:text-indigo-600 transition-colors">Centro de Ayuda</a>
          <a href="#" className="hover:text-indigo-600 transition-colors">Privacidad</a>
        </div>
      </footer>
    </main>
  );
}
