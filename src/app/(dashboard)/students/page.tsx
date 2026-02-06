'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Search, GraduationCap, UserPlus, Trash2, ArrowRight } from 'lucide-react';

export default function StudentsPage() {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const supabase = createClient();
    const router = useRouter();

    const fetchStudents = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: membership } = await supabase
            .from('organization_members')
            .select('org_id')
            .eq('user_id', session.user.id)
            .single();

        if (membership) {
            const { data } = await supabase
                .from('students')
                .select('*')
                .eq('org_id', membership.org_id)
                .order('last_name', { ascending: true });

            setStudents(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar alumno? Esto borrará su historial de asistencia.')) return;
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (!error) fetchStudents();
        else alert('Error: ' + error.message);
    };

    const filteredStudents = students.filter(s =>
        s.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.dni && s.dni.includes(searchTerm))
    );

    return (
        <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Directorio de Alumnos</h1>
                    <p className="text-slate-500">Todos los alumnos de tu institución.</p>
                </div>
            </header>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por nombre, apellido o DNI..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-14 pl-12 pr-4 rounded-2xl border-none shadow-sm ring-1 ring-slate-100 focus:ring-2 focus:ring-indigo-500 text-slate-900 font-bold placeholder:font-normal placeholder:text-slate-400 bg-white"
                />
            </div>

            {loading ? (
                <div className="py-20 text-center text-slate-400">Cargando...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStudents.map((student) => (
                        <div key={student.id}
                            onClick={() => router.push(`/students/${student.id}`)}
                            className="brand-card p-5 bg-white flex items-center justify-between group hover:border-indigo-200 transition-colors cursor-pointer hover:shadow-md"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 font-black text-lg border border-slate-100">
                                    {student.first_name[0]}{student.last_name[0]}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 leading-tight">
                                        {student.last_name}, {student.first_name}
                                    </h3>
                                    {student.dni && (
                                        <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 rounded text-[10px] font-mono text-slate-500">
                                            DNI {student.dni}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(student.id); }}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Eliminar Alumno"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}

                    {filteredStudents.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-400 border-dashed border-2 border-slate-100 rounded-3xl">
                            <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No se encontraron alumnos.</p>
                            <p className="text-sm mt-2">Agrega alumnos dentro de cada curso.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
