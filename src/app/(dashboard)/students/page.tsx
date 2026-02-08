'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Search, GraduationCap, UserPlus, Trash2, BookPlus, Loader2 } from 'lucide-react';
import { useGroups, useAssignStudentToGroup } from '@/hooks/use-queries';

export default function StudentsPage() {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [membership, setMembership] = useState<{ org_id: string; role: string } | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    const supabase = createClient();
    const router = useRouter();
    const assignmentMutation = useAssignStudentToGroup();

    const fetchContext = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        setUserId(session.user.id);

        const { data: member } = await supabase
            .from('organization_members')
            .select('org_id, role')
            .eq('user_id', session.user.id)
            .single();

        if (member) setMembership(member);
    };

    const fetchStudents = async () => {
        if (!membership?.org_id) return;
        setLoading(true);

        // Query students directly (unique by ID) and count their group assignments
        const { data } = await supabase
            .from('students')
            .select(`
                *,
                group_students!inner(group_id)
            `)
            .eq('org_id', membership.org_id)
            .order('last_name', { ascending: true });

        // Deduplicate students and count unique groups
        const studentMap = new Map();
        (data || []).forEach(student => {
            if (!studentMap.has(student.id)) {
                studentMap.set(student.id, {
                    ...student,
                    groupCount: 0,
                    groupIds: new Set()
                });
            }
            const existing = studentMap.get(student.id);
            if (student.group_students && Array.isArray(student.group_students)) {
                student.group_students.forEach((gs: any) => {
                    if (gs.group_id) existing.groupIds.add(gs.group_id);
                });
            }
        });

        // Convert to array and calculate final group counts
        const processed = Array.from(studentMap.values()).map(s => ({
            ...s,
            groupCount: s.groupIds.size,
            group_students: undefined, // Remove the raw data
            groupIds: undefined // Remove the Set
        }));

        setStudents(processed);
        setLoading(false);
    };

    useEffect(() => {
        fetchContext();
    }, []);

    useEffect(() => {
        if (membership?.org_id) {
            fetchStudents();
        }
    }, [membership]);

    const { data: availableGroups = [] } = useGroups(
        membership?.org_id,
        membership?.role !== 'admin' ? userId || undefined : undefined
    );

    const handleAssign = async (studentId: string, groupId: string) => {
        if (!groupId || !membership?.org_id) return;

        try {
            await assignmentMutation.mutateAsync({
                studentId,
                groupId,
                orgId: membership.org_id
            });
            fetchStudents(); // Refresh list to update counts
        } catch (err: any) {
            alert('Error al asignar: ' + err.message);
        }
    };

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
                <div className="py-20 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
                    Cargando...
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredStudents.map((student) => (
                        <div key={student.id}
                            className="brand-card p-6 bg-white flex flex-col gap-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all border-none ring-1 ring-slate-100"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xl">
                                        {student.first_name[0]}{student.last_name[0]}
                                    </div>
                                    <div onClick={() => router.push(`/students/${student.id}`)} className="cursor-pointer">
                                        <h3 className="font-black text-slate-900 text-lg leading-tight group-hover:text-indigo-600 transition-colors">
                                            {student.last_name}, {student.first_name}
                                        </h3>
                                        {student.dni && (
                                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                                                DNI {student.dni}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(student.id); }}
                                    className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                    title="Eliminar Alumno"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="pt-4 border-t border-slate-50 flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asignación</span>
                                    {student.groupCount > 0 ? (
                                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                            {student.groupCount} {student.groupCount === 1 ? 'CURSO' : 'CURSOS'}
                                        </span>
                                    ) : (
                                        <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse">
                                            SIN CURSO
                                        </span>
                                    )}
                                </div>

                                <div className="relative group">
                                    <BookPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors pointer-events-none" />
                                    <select
                                        onChange={(e) => handleAssign(student.id, e.target.value)}
                                        value=""
                                        className="w-full h-11 pl-10 pr-4 bg-slate-50 hover:bg-slate-100 border-none rounded-xl text-xs font-bold text-slate-600 outline-none cursor-pointer appearance-none transition-all"
                                    >
                                        <option value="" disabled>Asignar a un curso...</option>
                                        {availableGroups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredStudents.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-white border-2 border-dashed border-slate-100 rounded-[32px]">
                            <GraduationCap className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                            <h3 className="text-xl font-black text-slate-900 mb-2">No se encontraron alumnos</h3>
                            <p className="text-slate-400 text-sm max-w-xs mx-auto">Prueba con otro término de búsqueda o agrega alumnos desde la vista de cursos.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
