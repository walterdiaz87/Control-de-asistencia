'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { GraduationCap, Loader2, Mail, Lock, ArrowRight } from 'lucide-react';

export default function AuthPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const supabase = createClient();
    const router = useRouter();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                    },
                });
                if (error) throw error;
                alert('Revisa tu email para confirmar el registro');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                router.push('/');
                router.refresh();
            }
        } catch (err: any) {
            setError(err.message === 'Invalid login credentials' ? 'Credenciales inválidas' : err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            {/* Background decorative elements */}
            <div className="absolute top-0 left-0 w-full h-64 bg-primary/10 -skew-y-6 transform origin-top-left -z-10" />

            <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center space-y-6">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white shadow-xl shadow-primary/10 mb-2">
                        <GraduationCap className="w-10 h-10 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight text-slate-900">Asistencia Docente</h1>
                        <p className="text-slate-500 mt-2 text-lg">
                            {isSignUp ? 'Comienza tu gestión hoy mismo' : '¡Hola de nuevo, profe!'}
                        </p>
                    </div>
                </div>

                <div className="brand-card p-10 bg-white shadow-2xl shadow-slate-200/50">
                    <form onSubmit={handleAuth} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 ml-1">
                                Correo Electrónico
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="brand-input pl-12"
                                    placeholder="ejemplo@escuela.com"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 ml-1">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="brand-input pl-12"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 text-sm font-medium text-red-600 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-2 animate-in shake duration-300">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="brand-button-primary w-full group"
                        >
                            {loading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
                                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-primary font-bold hover:text-primary/80 transition-colors text-sm"
                        >
                            {isSignUp ? '¿Ya tienes cuenta? Ingresa aquí' : '¿Aún no tienes cuenta? Regístrate gratis'}
                        </button>
                    </div>
                </div>

                <p className="text-center text-slate-400 text-xs mt-8">
                    &copy; 2026 Asistencia Docente. Diseñado para educadores.
                </p>
            </div>
        </div>
    );
}
