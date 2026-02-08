'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, Search, Sparkles, MoreVertical, Trash2, GraduationCap, Edit3, XCircle, UserX, Loader2, Plus } from 'lucide-react';
import CSVImporter, { type ImportedStudent } from '@/components/CSVImporter';
import StudentForm from '@/components/StudentForm';

export default function GroupStudentsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [students, setStudents] = useState<any[]>([]);
    const [group, setGroup] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [importMode, setImportMode] = useState(false);
    const [manualMode, setManualMode] = useState(false);
    const [editingStudent, setEditingStudent] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const supabase = createClient();
    const router = useRouter();

    const fetchStudents = async () => {
        setLoading(true);
        const { data: groupData } = await supabase
            .from('groups')
            .select('*')
            .eq('id', id)
            .single();

        if (groupData) setGroup(groupData);

        const { data } = await supabase
            .from('group_students')
            .select('students(*)')
            .eq('group_id', id);

        if (data) {
            setStudents(data.map((d: any) => d.students).sort((a: any, b: any) => a.last_name.localeCompare(b.last_name)));
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchStudents();
    }, [id]);

    const handleImport = async (imported: ImportedStudent[]) => {
        try {
            if (!group) return;

            // 1. Fetch existing students in org
            const { data: existingOrgStudents } = await supabase
                .from('students')
                .select('*')
                .eq('org_id', group.org_id);

            const existingMapped = new Map();
            existingOrgStudents?.forEach(s => {
                if (s.doc_id) existingMapped.set(s.doc_id, s.id);
                existingMapped.set(`${s.first_name.toLowerCase().trim()}|${s.last_name.toLowerCase().trim()}`, s.id);
            });

            const studentsToCreate: any[] = [];
            const studentIdsToLink: string[] = [];

            imported.forEach(s => {
                const first = s.first_name;
                const last = s.last_name;
                const docValue = s.doc_id || null;
                const nameKey = `${first.toLowerCase().trim()}|${last.toLowerCase().trim()}`;

                let existingId = docValue ? existingMapped.get(docValue) : null;
                if (!existingId) existingId = existingMapped.get(nameKey);

                if (existingId) {
                    studentIdsToLink.push(existingId);
                } else {
                    studentsToCreate.push({
                        org_id: group.org_id,
                        first_name: first,
                        last_name: last,
                        doc_id: docValue,
                        dni: docValue
                    });
                }
            });

            // 2. Create new students
            if (studentsToCreate.length > 0) {
                const { data: newlyCreated, error: studError } = await supabase
                    .from('students')
                    .insert(studentsToCreate)
                    .select();

                if (studError) throw studError;
                if (newlyCreated) {
                    newlyCreated.forEach(s => studentIdsToLink.push(s.id));
                }
            }

            // 3. Link students (deduplicated)
            if (studentIdsToLink.length > 0) {
                const uniqueIds = Array.from(new Set(studentIdsToLink));
                const links = uniqueIds.map(sid => ({
                    group_id: id,
                    student_id: sid
                }));

                const { error: linkError } = await supabase
                    .from('group_students')
                    .upsert(links, { onConflict: 'group_id, student_id', ignoreDuplicates: true });

                if (linkError) throw linkError;
            }

            setImportMode(false);
            fetchStudents();

        } catch (err: any) {
            console.error(err);
            alert('Ocurrió un error al importar: ' + err.message);
        }
    };

    const handleManualSuccess = async (student: any, addAnother: boolean) => {
        // Link to group if it's a new student or updated but not linked?
        // Actually, the form saves to 'students' table. We need to ensure it's in 'group_students'.
        const { error: linkError } = await supabase
            .from('group_students')
            .upsert({
                group_id: id,
                student_id: student.id,
                org_id: group.org_id
            }, { onConflict: 'group_id, student_id', ignoreDuplicates: true });

        if (linkError) {
            alert('Error al vincular alumno al grupo: ' + linkError.message);
            return;
        }

        if (!addAnother) {
            setManualMode(false);
            setEditingStudent(null);
            fetchStudents();
        } else {
            // If addAnother is true, we just refresh the local list without closing the modal
            const { data: updatedLink } = await supabase
                .from('group_students')
                .select('students(*)')
                .eq('group_id', id)
                .eq('student_id', student.id)
                .single();

            if (updatedLink) {
                setStudents(prev => [...prev.filter(s => s.id !== student.id), updatedLink.students].sort((a: any, b: any) => a.last_name.localeCompare(b.last_name)));
            }
        }
    };

    const deleteStudentRelation = async (studentId: string) => {
        if (!confirm('¿Quitar a este alumno del grupo? El alumno seguirá existiendo en la institución.')) return;

        const { error } = await supabase
            .from('group_students')
            .delete()
            .eq('group_id', id)
            .eq('student_id', studentId);

        if (!error) fetchStudents();
        else alert('Error al quitar alumno');
    };

    const toggleStudentActive = async (student: any) => {
        const { error } = await supabase
            .from('students')
            .update({ is_active: !student.is_active })
            .eq('id', student.id);

        if (!error) fetchStudents();
        else alert('Error al cambiar estado');
    };

    const filteredStudents = students.filter(s =>
        s.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.doc_id && s.doc_id.includes(searchTerm))
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-12 pb-32 md:pb-12">
            <header className="max-w-4xl mx-auto mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-3 hover:bg-white rounded-2xl transition-all hover:shadow-sm text-slate-400 hover:text-slate-900"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 leading-tight">{group?.name}</h1>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Gestión de Alumnos</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => router.push(`/attendance/${id}`)}
                        className="px-6 py-3 bg-white border border-slate-100 text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                    >
                        Tomar Asistencia
                    </button>
                    <button
                        onClick={() => { setEditingStudent(null); setManualMode(true); }}
                        className="hidden md:flex brand-button-primary px-6 h-12 items-center gap-2 shadow-xl shadow-indigo-500/20"
                    >
                        <Plus className="w-5 h-5" />
                        Agregar Alumno
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto space-y-8">
                {/* Import Block */}
                <div className="brand-card overflow-hidden bg-white border-none shadow-sm ring-1 ring-slate-100">
                    <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Importar Estudiantes (CSV/Excel)</span>
                        </div>
                        {importMode && (
                            <button onClick={() => setImportMode(false)} className="text-slate-400 hover:text-slate-600">
                                <Plus className="w-4 h-4 rotate-45" />
                            </button>
                        )}
                    </div>

                    {!importMode ? (
                        <div className="p-6 text-center">
                            <p className="text-sm text-slate-500 mb-4">¿Tienes una lista preparada? Cárgala en segundos.</p>
                            <button
                                onClick={() => setImportMode(true)}
                                className="px-6 py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-black uppercase tracking-widest hover:border-indigo-400 hover:text-indigo-500 transition-all hover:bg-indigo-50/30"
                            >
                                Iniciar Importación
                            </button>
                        </div>
                    ) : (
                        <div className="p-6 animate-in slide-in-from-top-4">
                            <CSVImporter
                                onImport={handleImport}
                                onCancel={() => setImportMode(false)}
                            />
                        </div>
                    )}
                </div>

                {/* Search & List */}
                <div className="space-y-4">
                    <div className="relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, apellido o DNI..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-16 pl-14 pr-6 rounded-3xl border-none shadow-sm ring-1 ring-slate-100 focus:ring-4 focus:ring-indigo-500/10 focus:ring-offset-0 text-slate-900 font-bold placeholder:font-normal placeholder:text-slate-400 transition-all bg-white"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredStudents.map((student) => (
                            <div key={student.id}
                                className={`brand-card p-4 bg-white flex items-center justify-between group hover:border-indigo-200 transition-all shadow-sm ${!student.is_active ? 'opacity-60 bg-slate-50' : ''}`}
                            >
                                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => router.push(`/students/${student.id}`)}>
                                    <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black text-lg transition-colors ${!student.is_active ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-900 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                                        <span className="text-[10px] opacity-40 uppercase tracking-tighter leading-none mb-1">{student.first_name[0]}</span>
                                        {student.last_name[0]}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-black text-slate-900 leading-tight truncate">
                                            {student.last_name}, {student.first_name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            {student.doc_id ? (
                                                <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded leading-none italic">
                                                    {student.doc_id}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-slate-300 uppercase leading-none">Sin DNI</span>
                                            )}
                                            {!student.is_active && (
                                                <span className="text-[9px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded leading-none uppercase tracking-widest ring-1 ring-red-100">Inactivo</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => { setEditingStudent(student); setManualMode(true); }}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                        title="Editar"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => toggleStudentActive(student)}
                                        className={`p-2 transition-all rounded-xl ${student.is_active ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-amber-500 hover:bg-amber-100'}`}
                                        title={student.is_active ? "Desactivar" : "Activar"}
                                    >
                                        <UserX className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => deleteStudentRelation(student.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                        title="Quitar del curso"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {filteredStudents.length === 0 && !loading && (
                            <div className="col-span-full py-20 text-center text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-100">
                                <GraduationCap className="w-16 h-16 mx-auto mb-4 opacity-10" />
                                <p className="font-bold">No se encontraron alumnos.</p>
                                <p className="text-sm mt-1">Prueba con otro término o agrega uno nuevo.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Mobile FAB */}
            <button
                onClick={() => { setEditingStudent(null); setManualMode(true); }}
                className="md:hidden fixed bottom-28 right-6 w-16 h-16 bg-slate-900 text-white rounded-2xl shadow-2xl shadow-indigo-500/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 animate-in slide-in-from-bottom-20 zoom-in"
            >
                <Plus className="w-8 h-8" />
            </button>

            {/* Manual Form Modal */}
            {manualMode && group && (
                <StudentForm
                    orgId={group.org_id}
                    initialData={editingStudent}
                    existingStudents={students}
                    onClose={() => { setManualMode(false); setEditingStudent(null); }}
                    onSuccess={handleManualSuccess}
                />
            )}
        </div>
    );
}
