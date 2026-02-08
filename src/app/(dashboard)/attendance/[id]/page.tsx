'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, use, memo, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
    Users, Save, Check, X, Clock, HelpCircle,
    Loader2, ChevronLeft, Calendar, Download,
    AlertTriangle, Edit3, MessageSquare,
    ArrowRight, GraduationCap, Info, UserPlus
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useGroupWithStudents, useTodaySession } from '@/hooks/use-queries';

interface Student {
    id: string;
    first_name: string;
    last_name: string;
    doc_id?: string;
}

interface AttendanceRecord {
    status: 'present' | 'absent';
    justification?: 'justified' | 'unjustified' | null;
    comment?: string;
    record_id?: string;
}

interface AttendanceState {
    [studentId: string]: AttendanceRecord;
}

export default function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
    const { id: groupId } = use(params);
    const [attendance, setAttendance] = useState<AttendanceState>({});
    const [saving, setSaving] = useState(false);
    const [mode, setMode] = useState<'create' | 'edit'>('create');
    const [error, setError] = useState<string | null>(null);

    const supabase = createClient();
    const router = useRouter();
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // --- Optimized Data Fetching ---
    const { data: groupData, isLoading: loadingGroup, error: groupError } = useGroupWithStudents(groupId);
    const { group, students = [] } = groupData || {};

    const { data: session, isLoading: loadingSession } = useTodaySession(groupId, dateStr);

    // Initial load sync
    useEffect(() => {
        if (!loadingGroup && !loadingSession && groupData) {
            if (session) {
                setMode('edit');
                const initialState: AttendanceState = {};
                session.attendance_records.forEach((r: any) => {
                    initialState[r.student_id] = {
                        status: r.status,
                        justification: r.justification,
                        comment: r.comment,
                        record_id: r.id
                    };
                });
                // Fill missing
                students.forEach(s => {
                    if (!initialState[s.id]) initialState[s.id] = { status: 'present' };
                });
                setAttendance(initialState);
            } else {
                setMode('create');
                const initialState: AttendanceState = {};
                students.forEach(s => {
                    initialState[s.id] = { status: 'present' };
                });
                setAttendance(initialState);
            }
        }
    }, [loadingGroup, loadingSession, groupData, session, students]);

    const loading = loadingGroup || loadingSession;

    const updateStatus = (studentId: string, status: 'present' | 'absent') => {
        setAttendance(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                status,
                // Reset justification if turning present
                justification: status === 'present' ? null : (prev[studentId].justification || 'unjustified')
            }
        }));
    };

    const updateJustification = (studentId: string, justification: 'justified' | 'unjustified') => {
        setAttendance(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], justification }
        }));
    };

    const updateComment = (studentId: string, comment: string) => {
        setAttendance(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], comment }
        }));
    };

    const handleSave = async () => {
        // Validate justifications
        const missingJustification = Object.entries(attendance).some(([_, rec]) =>
            rec.status === 'absent' && !rec.justification
        );

        if (missingJustification) {
            alert('Por favor, indica si las inasistencias son justificadas o no.');
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado');

            let currentSessionId = session?.id;

            // 1. Ensure Session exists / Upsert safely to avoid "duplicate key" error
            const { data: finalSession, error: sessError } = await supabase
                .from('sessions')
                .upsert({
                    id: currentSessionId || undefined,
                    group_id: groupId,
                    date: dateStr,
                    class_index: 1, // Defaulting to 1 as per unique constraint
                    org_id: group?.org_id,
                    created_by: user.id,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'group_id, date, class_index'
                })
                .select()
                .single();

            if (sessError) throw sessError;
            currentSessionId = finalSession.id;

            // 2. Prepare Records (Upsert) - Don't pass id: undefined/null to avoid constraint error
            const records = Object.entries(attendance).map(([studentId, rec]) => ({
                session_id: currentSessionId,
                student_id: studentId,
                status: rec.status,
                justification: rec.status === 'absent' ? rec.justification : null,
                comment: rec.comment || null,
                org_id: group?.org_id,
                updated_by: user.id
            }));

            const { error: recError } = await supabase
                .from('attendance_records')
                .upsert(records, { onConflict: 'session_id, student_id' });

            if (recError) throw recError;

            router.push(`/history/${groupId}`);
            router.refresh();
        } catch (err: any) {
            console.error('[Save Error]', err);
            alert('Error al guardar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const stats = {
        present: Object.values(attendance).filter(r => r.status === 'present').length,
        absent: Object.values(attendance).filter(r => r.status === 'absent').length
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                <p className="text-slate-400 font-black tracking-widest text-[10px] uppercase">Cargando Alumnos...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 max-w-sm w-full text-center space-y-6">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-slate-900">Algo salió mal</h2>
                <p className="text-slate-500 text-sm">{error}</p>
                <button onClick={() => window.location.reload()} className="brand-button-primary w-full h-12">
                    Reintentar
                </button>
            </div>
        </div>
    );

    if (students.length === 0) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
            <header className="fixed top-0 left-0 w-full p-6 flex items-center gap-4">
                <button onClick={() => router.back()} className="p-3 hover:bg-slate-200 rounded-2xl transition-all">
                    <ChevronLeft className="w-6 h-6 text-slate-400" />
                </button>
            </header>
            <div className="text-center space-y-6 max-w-sm">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <Users className="w-12 h-12 text-slate-200" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">Este curso está vacío</h2>
                <p className="text-slate-500">Para tomar asistencia, primero debes agregar alumnos al curso.</p>
                <button onClick={() => router.push(`/groups/${groupId}/students`)} className="brand-button-primary w-full h-14 flex items-center justify-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Cargar Alumnos
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between px-6 py-4 gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-slate-100 rounded-xl transition-all">
                        <ChevronLeft className="w-6 h-6 text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 leading-tight">{group?.name}</h1>
                        <p className="text-indigo-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {format(today, "eeee d 'de' MMMM", { locale: es })}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-black text-slate-600">{students.length} Total</span>
                    </div>
                </div>
            </header>

            {mode === 'edit' && (
                <div className="bg-amber-50 px-6 py-3 border-b border-amber-100 flex items-center gap-3">
                    <Info className="w-4 h-4 text-amber-500" />
                    <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Ya existe asistencia para hoy. Editando registros...</p>
                </div>
            )}

            <main className="p-4 md:max-w-3xl md:mx-auto space-y-4 pt-6">
                {students.map((student) => (
                    <StudentRow
                        key={student.id}
                        student={student}
                        record={attendance[student.id]}
                        updateStatus={updateStatus}
                        updateJustification={updateJustification}
                        updateComment={updateComment}
                    />
                ))}
            </main>

            {/* Sticky Bottom Bar */}
            <div className="fixed bottom-0 left-0 w-full p-4 md:p-6 bg-white/80 backdrop-blur-2xl border-t border-slate-100 z-50">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-6">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-sm font-black text-slate-900">{stats.present}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-sm font-black text-slate-900">{stats.absent}</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Resumen de Hoy</span>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`px-10 h-16 rounded-3xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95 ${mode === 'edit'
                            ? 'bg-amber-500 text-white shadow-amber-500/20 hover:bg-amber-600'
                            : 'bg-slate-900 text-white shadow-slate-900/20 hover:bg-slate-800'
                            } disabled:opacity-50`}
                    >
                        {saving ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                <span>{mode === 'edit' ? 'GUARDAR CAMBIOS' : 'FINALIZAR CARGA'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
// --- Memoized Row Component ---
const StudentRow = memo(({ student, record, updateStatus, updateJustification, updateComment }: any) => {
    if (!record) return null;

    return (
        <div className={`brand-card p-0 overflow-hidden ring-1 transition-all duration-300 ${record.status === 'present'
            ? 'bg-white ring-slate-100'
            : 'bg-red-50/30 ring-red-100 shadow-lg shadow-red-500/5'
            }`}
        >
            <div className="p-5 flex flex-col gap-5">
                <div className="flex justify-between items-start">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-0.5">{student.last_name}</p>
                        <h3 className="text-xl font-black text-slate-900 truncate">{student.first_name}</h3>
                        {student.doc_id && (
                            <p className="text-[10px] font-mono font-bold text-slate-400 mt-1 uppercase">DNI {student.doc_id}</p>
                        )}
                    </div>

                    <div className="flex p-1 bg-slate-100 rounded-2xl w-44 shrink-0 shadow-inner">
                        <button
                            onClick={() => updateStatus(student.id, 'present')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black transition-all ${record.status === 'present'
                                ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200/50'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <Check className={`w-3.5 h-3.5 ${record.status === 'present' ? 'animate-in zoom-in' : ''}`} />
                            PRESENTE
                        </button>
                        <button
                            onClick={() => updateStatus(student.id, 'absent')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black transition-all ${record.status === 'absent'
                                ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <X className={`w-3.5 h-3.5 ${record.status === 'absent' ? 'animate-in zoom-in' : ''}`} />
                            AUSENTE
                        </button>
                    </div>
                </div>

                {record.status === 'absent' && (
                    <div className="pt-4 border-t border-red-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black text-red-400 uppercase tracking-widest ml-1">Justificación *</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => updateJustification(student.id, 'justified')}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all border-2 ${record.justification === 'justified'
                                        ? 'bg-red-100 border-red-200 text-red-800'
                                        : 'bg-white border-red-50 text-red-300 hover:border-red-100'
                                        }`}
                                >
                                    JUSTIFICADA
                                </button>
                                <button
                                    onClick={() => updateJustification(student.id, 'unjustified')}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all border-2 ${record.justification === 'unjustified'
                                        ? 'bg-red-600 border-red-700 text-white shadow-lg shadow-red-500/20'
                                        : 'bg-white border-red-50 text-red-300 hover:border-red-100'
                                        }`}
                                >
                                    NO JUSTIFICADA
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 ml-1">
                                <MessageSquare className="w-3 h-3 text-red-300" />
                                <label className="text-[9px] font-black text-red-400 uppercase tracking-widest">Comentario</label>
                            </div>
                            <input
                                type="text"
                                placeholder="Ej. Avisó por cuaderno"
                                value={record.comment || ''}
                                onChange={(e) => updateComment(student.id, e.target.value)}
                                className="bg-white/50 border border-red-100 p-3 rounded-xl text-xs font-bold text-red-900 placeholder:text-red-200 focus:ring-2 focus:ring-red-200 outline-none transition-all"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

StudentRow.displayName = 'StudentRow';
