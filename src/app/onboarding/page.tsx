'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { User, School, ArrowRight, Check, Loader2, Sparkles, GraduationCap } from 'lucide-react';

export default function OnboardingPage() {
    const [mode, setMode] = useState<'individual' | 'org' | null>(null);
    const [orgName, setOrgName] = useState('');
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        async function checkUser() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            setUser(user);

            // Check if already has org
            const { data: membership } = await supabase
                .from('organization_members')
                .select('org_id')
                .limit(1)
                .single();

            if (membership) {
                router.push('/');
            }
        }
        checkUser();
    }, [router, supabase]);

    const handleOnboarding = async () => {
        if (!mode) return;
        setLoading(true);

        try {
            const name = mode === 'individual' ? `Espacio de ${user.email.split('@')[0]}` : orgName;
            const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-0-]/g, '') + '-' + Math.random().toString(36).substring(7);

            // 1. Create Org
            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert({ name, slug })
                .select()
                .single();

            if (orgError) throw orgError;

            // 2. Add Member
            const { error: memError } = await supabase
                .from('organization_members')
                .insert({
                    org_id: org.id,
                    user_id: user.id,
                    role: 'owner'
                });

            if (memError) throw memError;

            // 3. Create initial Academic Year
            await supabase
                .from('academic_years')
                .insert({
                    org_id: org.id,
                    year: new Date().getFullYear(),
                    is_active: true
                });

            router.push('/');
            router.refresh();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-48 -mt-48" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/5 rounded-full blur-3xl -ml-48 -mb-48" />

            <div className="w-full max-w-2xl space-y-10 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-slate-100 text-primary font-bold text-sm mb-2">
                        <Sparkles className="w-4 h-4" />
                        Paso 1: Configurar tu espacio
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
                        ¿Cómo vas a usar la app?
                    </h1>
                    <p className="text-slate-500 text-lg max-w-lg mx-auto">
                        Personalicemos tu experiencia para que se adapte a tu forma de trabajo.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Modo Individual */}
                    <button
                        onClick={() => setMode('individual')}
                        className={`brand-card p-10 flex flex-col items-center text-center gap-6 group relative ${mode === 'individual' ? 'ring-4 ring-primary ring-offset-4 border-primary/50' : 'bg-white hover:bg-slate-50'}`}
                    >
                        {mode === 'individual' && (
                            <div className="absolute top-4 right-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white">
                                <Check className="w-5 h-5" />
                            </div>
                        )}
                        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-500 ${mode === 'individual' ? 'bg-primary text-white scale-110 rotate-6 shadow-xl shadow-primary/30' : 'bg-slate-100 text-slate-400 group-hover:scale-110 group-hover:bg-primary/10 group-hover:text-primary'}`}>
                            <User className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-slate-900">Uso Personal</h3>
                            <p className="text-slate-500 leading-relaxed">
                                Para profes independientes que quieren llevar sus propios grupos.
                            </p>
                        </div>
                    </button>

                    {/* Modo Institución */}
                    <button
                        onClick={() => setMode('org')}
                        className={`brand-card p-10 flex flex-col items-center text-center gap-6 group relative ${mode === 'org' ? 'ring-4 ring-secondary ring-offset-4 border-secondary/50' : 'bg-white hover:bg-slate-50'}`}
                    >
                        {mode === 'org' && (
                            <div className="absolute top-4 right-4 w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-white">
                                <Check className="w-5 h-5" />
                            </div>
                        )}
                        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-500 ${mode === 'org' ? 'bg-secondary text-white scale-110 -rotate-6 shadow-xl shadow-secondary/30' : 'bg-slate-100 text-slate-400 group-hover:scale-110 group-hover:bg-secondary/10 group-hover:text-secondary'}`}>
                            <School className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-slate-900">Institución</h3>
                            <p className="text-slate-500 leading-relaxed">
                                Para escuelas o centros que gestionan múltiples docentes.
                            </p>
                        </div>
                    </button>
                </div>

                {mode === 'org' && (
                    <div className="brand-card p-8 bg-white space-y-4 animate-in zoom-in-95 duration-300">
                        <label className="text-sm font-bold text-slate-700 block ml-1">
                            Nombre de la Institución
                        </label>
                        <input
                            type="text"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            className="brand-input"
                            placeholder="Ej: Escuela Normal N°1"
                            autoFocus
                        />
                    </div>
                )}

                <div className="pt-8">
                    <button
                        onClick={handleOnboarding}
                        disabled={loading || !mode || (mode === 'org' && !orgName)}
                        className={`w-full h-16 rounded-2xl flex items-center justify-center gap-3 font-black text-xl transition-all duration-300 ${mode ? 'brand-button-primary bg-slate-900 text-white shadow-2xl' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                        {loading ? (
                            <Loader2 className="w-8 h-8 animate-spin" />
                        ) : (
                            <>
                                CONTINUAR
                                <ArrowRight className="w-6 h-6" />
                            </>
                        )}
                    </button>
                    <p className="text-center text-slate-400 text-sm mt-6 flex items-center justify-center gap-2">
                        <GraduationCap className="w-4 h-4" />
                        Puedes cambiar esto más tarde en la configuración.
                    </p>
                </div>
            </div>
        </div>
    );
}
