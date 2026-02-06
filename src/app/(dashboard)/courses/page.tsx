'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, BookOpen, Users, MoreVertical, Edit2, Trash2, ArrowRight } from 'lucide-react';
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

    const fetchGroups = async () => {
        setLoading(true);
        // Get user session to know generic info if needed, but primarily we need org_id
        // Ideally we assume user has one organization active or we get it from their membership
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            router.push('/login');
            return;
        }
        setCurrentUserId(session.user.id);

        const { data: membership } = await supabase
            .from('organization_members')
            .select('org_id')
            .eq('user_id', session.user.id)
            .single();

        if (membership) {
            setOrgId(membership.org_id);
            const { data } = await supabase
                .from('groups')
                .select('*, academic_years(year)')
                .eq('org_id', membership.org_id)
                .order('created_at', { ascending: false });

            // Fetch student counts - simple approach for now, or use a view/rpc
            // Doing a separate query or using .select('*, students(count)') would be better but simple works
            setGroups(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este curso? Se perderá el historial.')) return;
        const { error } = await supabase.from('groups').delete().eq('id', id);
        if (!error) fetchGroups();
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
                                    <a href={`/groups/${group.id}/students`} className="flex-1 py-2 text-center text-xs font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center gap-2">
                                        <Users className="w-4 h-4" />
                                        Alumnos
                                    </a>
                                    <a href={`/attendance/${group.id}`} className="flex-1 py-2 text-center text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20">
                                        Asistencia
                                        <ArrowRight className="w-3 h-3" />
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
