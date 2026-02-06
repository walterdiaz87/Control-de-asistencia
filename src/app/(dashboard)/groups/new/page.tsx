'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Users, BookOpen, GraduationCap, ArrowLeft, ArrowRight, Loader2, Sparkles, UserPlus, Info } from 'lucide-react';

import CSVImporter, { type ImportedStudent } from '@/components/CSVImporter';

export default function NewGroupPage() {
    const [name, setName] = useState('');
    const [type, setType] = useState<'course' | 'workshop'>('course');
    const [studentsText, setStudentsText] = useState('');
    const [importMode, setImportMode] = useState(false);
    const [academicYear, setAcademicYear] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        async function fetchAcademicYear() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: membership } = await supabase
                .from('organization_members')
                .select('org_id')
                .limit(1)
                .single();

            if (membership) {
                const { data: year } = await supabase
                    .from('academic_years')
                    .select('*')
                    .eq('org_id', membership.org_id)
                    .eq('is_active', true)
                    .single();
                setAcademicYear(year);
            }
        }
        fetchAcademicYear();
    }, [supabase]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!academicYear) return;
        setLoading(true);

        try {
            // 1. Create Group
            const { data: group, error: groupError } = await supabase
                .from('groups')
                .insert({
                    org_id: academicYear.org_id,
                    academic_year_id: academicYear.id,
                    name,
                    type
                })
                .select()
                .single();

            if (groupError) throw groupError;

            // 2. Parse and Create Students
            const studentLines = studentsText.split('\n').filter(line => line.trim());
            const studentsToInsert = studentLines.map(line => {
                const parts = line.split(',').map(p => p.trim());
                return {
                    org_id: academicYear.org_id,
                    first_name: parts[0] || 'Alumno',
                    last_name: parts[1] || '.',
                    doc_id: parts[2] || null
                };
            });

            const { data: createdStudents, error: studError } = await supabase
                .from('students')
                .insert(studentsToInsert)
                .select();

            if (studError) throw studError;

            // 3. Link students to group
            const groupStudents = createdStudents.map(s => ({
                group_id: group.id,
                student_id: s.id
            }));

            const { error: linkError } = await supabase
                .from('group_students')
                .insert(groupStudents);

            if (linkError) throw linkError;

            router.push('/');
            router.refresh();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-12">
            <header className="max-w-3xl mx-auto mb-10 flex items-center justify-between">
                <button
                    onClick={() => router.back()}
                    className="p-3 hover:bg-white rounded-2xl transition-all hover:shadow-sm text-slate-400 hover:text-slate-900 group flex items-center gap-2"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="font-bold text-sm">Volver</span>
                </button>
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-full border border-indigo-100 text-indigo-600 font-bold text-xs">
                    <Sparkles className="w-4 h-4" />
                    Asistente de Configuración
                </div>
            </header>

            <main className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="space-y-2 mb-10 text-center md:text-left">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Nuevo Grupo</h1>
                    <p className="text-slate-500 text-lg">Crea un espacio para tus alumnos en segundos.</p>
                </div>

                <form onSubmit={handleCreate} className="space-y-10">
                    <section className="brand-card p-10 bg-white space-y-8">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-6 mb-2">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                                <GraduationCap className="w-7 h-7" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 leading-tight">Detalles del Grupo</h2>
                                <p className="text-slate-400 text-sm font-medium">Define el nombre y el tipo de cursada.</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">Nombre del Curso / Taller</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="brand-input text-lg font-bold"
                                    placeholder="Ej: 5to Grado 'B' - Matemáticas"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">Tipo de Grupo</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setType('course')}
                                        className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${type === 'course' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 text-slate-400'}`}
                                    >
                                        <BookOpen className={`w-8 h-8 ${type === 'course' ? 'text-indigo-600' : 'text-slate-300'}`} />
                                        <span className="font-black text-xs uppercase tracking-widest">CURSO REGULAR</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType('workshop')}
                                        className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${type === 'workshop' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-100' : 'bg-white border-slate-100 text-slate-400'}`}
                                    >
                                        <Users className={`w-8 h-8 ${type === 'workshop' ? 'text-emerald-600' : 'text-slate-300'}`} />
                                        <span className="font-black text-xs uppercase tracking-widest">TALLER / EXTRA</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Student Input Section */}
                    <section className="brand-card p-10 bg-white space-y-8">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-6 mb-2">
                            <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary">
                                <UserPlus className="w-7 h-7" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 leading-tight">Carga de Alumnos</h2>
                                <p className="text-slate-400 text-sm font-medium">Agrega alumnos manualmente o impórtalos.</p>
                            </div>
                        </div>

                        {!importMode ? (
                            <div className="space-y-4">
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setImportMode(true)}
                                        className="text-sm font-bold text-primary flex items-center gap-1 hover:underline"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        Importar desde CSV
                                    </button>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-4 mb-4">
                                    <Info className="w-6 h-6 text-slate-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Pega una lista con el formato: <br />
                                        <strong className="text-slate-700">Nombre, Apellido</strong> (uno por línea).
                                    </p>
                                </div>

                                <textarea
                                    value={studentsText}
                                    onChange={(e) => setStudentsText(e.target.value)}
                                    className="brand-input min-h-[200px] font-mono text-sm py-4 resize-none"
                                    placeholder="Juan, Perez&#10;Maria, Garcia&#10;Carlos, Rodriguez..."
                                />

                                <div className="flex justify-between items-center px-2">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                        Detectados: {studentsText.split('\n').filter(l => l.trim()).length} alumnos
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <CSVImporter
                                onCancel={() => setImportMode(false)}
                                onImport={(imported: ImportedStudent[]) => {
                                    // Convert imported to text format for simplicity or store in state
                                    const text = imported.map((s: ImportedStudent) => `${s.first_name}, ${s.last_name}${s.doc_id ? ', ' + s.doc_id : ''}`).join('\n');
                                    setStudentsText(prev => prev ? prev + '\n' + text : text);
                                    setImportMode(false);
                                }}
                            />
                        )}
                    </section>

                    <div className="pt-6">
                        <button
                            type="submit"
                            disabled={loading || !name || !studentsText}
                            className={`brand-button-primary w-full h-16 text-xl font-black rounded-2xl flex items-center justify-center gap-3 transition-all ${loading || !name || !studentsText ? 'opacity-50 cursor-not-allowed shadow-none' : 'hover:scale-[1.02] active:scale-95 shadow-2xl shadow-primary/30'}`}
                        >
                            {loading ? (
                                <Loader2 className="w-8 h-8 animate-spin" />
                            ) : (
                                <>
                                    CREAR GRUPO AHORA
                                    <ArrowRight className="w-6 h-6" />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
