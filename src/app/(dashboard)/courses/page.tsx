'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/hooks/use-queries';
import { createClient } from '@/lib/supabase/client';
import { Plus, BookOpen, Users, MoreVertical, Edit2, Trash2, ArrowRight, FileBarChart } from 'lucide-react';
import CourseForm from '@/components/CourseForm';
import { useRouter } from 'next/navigation';

export default function CoursesPage() {
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState<any>(null);
    const [orgId, setOrgId] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const supabase = createClient();
    const router = useRouter();
    const queryClient = useQueryClient();

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }
            setCurrentUserId(session.user.id);

            // Fetch membership with role
            const { data: membership, error: memError } = await supabase
                .from('organization_members')
                .select('org_id, role')
                .eq('user_id', session.user.id)
                .limit(1)
                .maybeSingle();

            if (memError) throw memError;

            if (membership) {
                setOrgId(membership.org_id);

                let query = supabase
                    .from('groups')
                    .select('*, academic_years(year)')
                    .eq('org_id', membership.org_id);

                // Role-based filtering (Same as Dashboard)
                if (membership.role !== 'admin') {
                    query = query.eq('teacher_id', session.user.id);
                }

                const { data, error: groupError } = await query.order('created_at', { ascending: false });
                if (groupError) throw groupError;

                setGroups(data || []);
            }
        } catch (err: any) {
            console.error('[FetchGroups Error]', err);
            // alert('Error al cargar grupos: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este curso? Se perderá el historial.')) return;
        const { error } = await supabase.from('groups').delete().eq('id', id);
        if (!error) {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            fetchGroups();
        }
        else alert('Error: ' + error.message);
    };

    return (
        <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Cursos y Talleres</h1>
                    <p className="text-slate-500">Gestiona tus espacios curriculares.</p>
                </div>
                <button
                    onClick={() => { setEditingGroup(null); setShowModal(true); }}
                    className="brand-button-primary px-6 flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Nuevo Curso
                </button>
            </header>

            {loading ? (
                <div className="py-20 text-center text-slate-400">Cargando...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map(group => (
                        <div key={group.id} className="brand-card p-0 bg-white group flex flex-col h-full hover:-translate-y-1 transition-transform duration-300">
                            <div className={`h-2 w-full ${group.type === 'course' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                            <div className="p-6 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${group.type === 'course' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {group.type === 'course' ? 'Curso' : 'Taller'}
                                    </span>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setEditingGroup(group); setShowModal(true); }} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(group.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-1">{group.name}</h3>
                                <p className="text-xs font-bold text-slate-400 mb-6">Año {group.academic_years?.year}</p>

                                <div className="mt-auto flex items-center gap-2 pt-6 border-t border-slate-50">
                                    <a href={`/groups/${group.id}/students`} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Alumnos">
                                        <Users className="w-5 h-5" />
                                    </a>
                                    <a href={`/history/${group.id}`} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Historial y Reportes">
                                        <FileBarChart className="w-5 h-5" />
                                    </a>
                                    <a href={`/attendance/${group.id}`} className="flex-1 py-3 text-center text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20">
                                        Captura
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}

                    {groups.length === 0 && (
                        <div className="col-span-full py-20 text-center border-dashed border-2 border-slate-200 rounded-3xl">
                            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 font-medium">No has creado cursos todavía.</p>
                        </div>
                    )}
                </div>
            )}

            {showModal && orgId && (
                <CourseForm
                    orgId={orgId}
                    initialData={editingGroup}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        setShowModal(false);
                        fetchGroups();
                        // If it was a new creation, you might want to redirect.
                        // Ideally we detect if created vs updated. 
                        // For now staying here is fine or user can click 'Alumnos'.
                    }}
                />
            )}
        </div>
    );
}
