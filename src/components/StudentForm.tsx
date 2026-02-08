'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Save, UserPlus, Loader2, AlertCircle, Sparkles, CheckCircle2, Plus } from 'lucide-react';

interface StudentFormProps {
    onClose: () => void;
    onSuccess: (student: any, addAnother: boolean) => void;
    initialData?: any;
    orgId: string;
    existingStudents?: any[];
}

export default function StudentForm({ onClose, onSuccess, initialData, orgId, existingStudents = [] }: StudentFormProps) {
    const [firstName, setFirstName] = useState(initialData?.first_name || '');
    const [lastName, setLastName] = useState(initialData?.last_name || '');
    const [docId, setDocId] = useState(initialData?.doc_id || '');
    const [notes, setNotes] = useState(initialData?.notes || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [existingStudentFound, setExistingStudentFound] = useState<any>(null);

    const firstNameRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    useEffect(() => {
        firstNameRef.current?.focus();
    }, []);

    // Debounced search while typing
    useEffect(() => {
        if (!firstName || !lastName || initialData) return;

        const timer = setTimeout(() => {
            findExistingInOrg();
        }, 500);

        return () => clearTimeout(timer);
    }, [firstName, lastName]);

    const findExistingInOrg = async () => {
        if (!firstName || !lastName) return null;

        setError(null);
        // Don't clear warning immediately to avoid flickering while typing
        setExistingStudentFound(null);

        // 1. Check if already in this group (local state)
        const inThisGroup = existingStudents.find(s =>
            s.first_name.toLowerCase().trim() === firstName.toLowerCase().trim() &&
            s.last_name.toLowerCase().trim() === lastName.toLowerCase().trim()
        );

        if (inThisGroup && !initialData) {
            setError('Este alumno ya está en este curso.');
            setWarning(null);
            return null;
        }

        // 2. Search in the whole organization
        // Use .select().limit(1) instead of maybeSingle() to be robust against already existing duplicates
        const { data: nameMatches, error: searchError } = await supabase
            .from('students')
            .select('*')
            .eq('org_id', orgId)
            .ilike('first_name', firstName.trim())
            .ilike('last_name', lastName.trim())
            .limit(1);

        if (nameMatches && nameMatches.length > 0) {
            const match = nameMatches[0];
            if (!initialData || match.id !== initialData.id) {
                setExistingStudentFound(match);
                setWarning('Este alumno ya existe en la institución pero no está en este curso.');
                return match;
            }
        }

        // 3. Check DNI if provided
        if (docId) {
            const { data: dniMatch } = await supabase
                .from('students')
                .select('*')
                .eq('org_id', orgId)
                .eq('doc_id', docId.trim())
                .limit(1);

            if (dniMatch && dniMatch.length > 0) {
                const match = dniMatch[0];
                if (!initialData || match.id !== initialData.id) {
                    setExistingStudentFound(match);
                    setWarning('Un alumno con este DNI ya existe en la institución.');
                    return match;
                }
            }
        }

        setWarning(null);
        return null;
    };

    const handleLinkExisting = async () => {
        if (!existingStudentFound) return;
        setLoading(true);
        // Link to group logic is handled by onSuccess in page.tsx
        onSuccess(existingStudentFound, false);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent, addAnother: boolean = false) => {
        e.preventDefault();
        setError(null);

        if (!firstName || !lastName) {
            setError('Nombre y Apellido son requeridos.');
            return;
        }

        // CRITICAL: Always check for duplicates before creating, even if debounce hasn't fired yet
        if (!initialData) {
            const existing = await findExistingInOrg();
            if (existing) {
                // Duplicate found, stop here and show the link option
                return;
            }
        }

        setLoading(true);

        const payload = {
            org_id: orgId,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            doc_id: docId.trim() || null,
            dni: docId.trim() || null,
            notes: notes.trim() || null,
            updated_at: new Date().toISOString()
        };

        let result;
        if (initialData) {
            const { data, error: err } = await supabase
                .from('students')
                .update(payload)
                .eq('id', initialData.id)
                .select()
                .single();
            result = { data, error: err };
        } else {
            const { data, error: err } = await supabase
                .from('students')
                .insert([{ ...payload, is_active: true }])
                .select()
                .single();
            result = { data, error: err };
        }

        setLoading(false);

        if (result.error) {
            if (result.error.code === '23505') {
                setError('El DNI ya existe en la institución.');
            } else {
                setError('Error al guardar: ' + result.error.message);
            }
        } else {
            if (addAnother) {
                setFirstName('');
                setLastName('');
                setDocId('');
                setNotes('');
                setWarning(null);
                setExistingStudentFound(null);
                firstNameRef.current?.focus();
                onSuccess(result.data, true);
            } else {
                onSuccess(result.data, false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 border border-slate-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/30">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-black text-xl text-slate-900 leading-none">
                                {initialData ? 'Editar Alumno' : 'Agregar Alumno'}
                            </h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Carga de Estudiante</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-all text-slate-300 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={(e) => handleSubmit(e, false)} className="p-8 space-y-6">
                    {error && (
                        <div className="p-5 bg-red-50 border-2 border-red-100 rounded-[28px] flex gap-4 text-red-600 animate-in shake-1">
                            <AlertCircle className="w-6 h-6 shrink-0" />
                            <div>
                                <p className="text-sm font-black uppercase tracking-wider mb-1">Error de validación</p>
                                <p className="text-sm font-bold opacity-80">{error}</p>
                            </div>
                        </div>
                    )}

                    {warning && (
                        <div className="p-6 bg-amber-50 border-2 border-amber-100 rounded-[32px] space-y-4 animate-in slide-in-from-top-4">
                            <div className="flex gap-4 text-amber-600">
                                <Sparkles className="w-6 h-6 shrink-0" />
                                <div>
                                    <p className="text-sm font-black uppercase tracking-wider mb-1">¡Alumno Encontrado!</p>
                                    <p className="text-sm font-bold opacity-80">{warning}</p>
                                </div>
                            </div>

                            {existingStudentFound && (
                                <div className="bg-white/80 p-4 rounded-2xl flex items-center justify-between ring-1 ring-amber-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center font-black text-amber-700">
                                            {existingStudentFound.first_name[0]}{existingStudentFound.last_name[0]}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-900 text-sm">
                                                {existingStudentFound.last_name}, {existingStudentFound.first_name}
                                            </p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Registrado en la institución</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleLinkExisting}
                                        disabled={loading}
                                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-amber-500/20 flex items-center gap-2"
                                    >
                                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                        Vincular
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nombre *</label>
                            <input
                                ref={firstNameRef}
                                type="text"
                                required
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-900 font-bold placeholder:text-slate-300 outline-none"
                                placeholder="Ej. Sofia"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Apellido *</label>
                            <input
                                type="text"
                                required
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-900 font-bold placeholder:text-slate-300 outline-none"
                                placeholder="Ej. Micheloud"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Documento / DNI</label>
                        <input
                            type="text"
                            value={docId}
                            onChange={(e) => setDocId(e.target.value.replace(/\D/g, ''))}
                            className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-900 font-mono font-bold placeholder:text-slate-300 outline-none"
                            placeholder="Ej. 40123456"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Observaciones</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full p-6 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-900 font-bold placeholder:text-slate-300 outline-none resize-none"
                            placeholder="Escribe algo aquí..."
                        />
                    </div>

                    <div className="pt-6 flex flex-col md:flex-row gap-3">
                        {!initialData && !warning && !error && (
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e as any, true)}
                                disabled={loading}
                                className="order-2 md:order-1 px-8 h-14 rounded-2xl bg-white border-2 border-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 hover:border-slate-200 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> : <Plus className="w-4 h-4 text-indigo-600" />}
                                Guardar y Otro
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={loading || !!warning || !!error}
                            className={`order-1 md:order-2 flex-1 h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl ${(!!warning || !!error) ? 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none' : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-slate-900/10 hover:shadow-indigo-500/30'}`}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Crear Estudiante
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
