'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Save, UserPlus, Loader2, AlertCircle } from 'lucide-react';

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

    const firstNameRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();

    useEffect(() => {
        firstNameRef.current?.focus();
    }, []);

    const validateDuplicates = () => {
        // 1. Check DNI duplication in local list (if provided)
        if (docId) {
            const dniExists = existingStudents.some(s => s.doc_id === docId && s.id !== initialData?.id);
            if (dniExists) {
                setError('Este DNI ya está registrado en este curso.');
                return false;
            }
        }

        // 2. Check Name + LastName duplication in local list
        const nameExists = existingStudents.some(s =>
            s.first_name.toLowerCase().trim() === firstName.toLowerCase().trim() &&
            s.last_name.toLowerCase().trim() === lastName.toLowerCase().trim() &&
            s.id !== initialData?.id
        );

        if (nameExists) {
            setWarning('Ya existe un alumno con este nombre y apellido en el curso.');
        } else {
            setWarning(null);
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent, addAnother: boolean = false) => {
        e.preventDefault();
        setError(null);

        if (!firstName || !lastName) {
            setError('Nombre y Apellido son requeridos.');
            return;
        }

        if (!validateDuplicates()) return;

        setLoading(true);

        const payload = {
            org_id: orgId,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            doc_id: docId.trim() || null,
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
                firstNameRef.current?.focus();
                onSuccess(result.data, true);
            } else {
                onSuccess(result.data, false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="font-black text-xl text-slate-900">
                            {initialData ? 'Editar Alumno' : 'Agregar Alumno'}
                        </h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Carga Manual</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-all text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={(e) => handleSubmit(e, false)} className="p-8 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-3 text-red-600 animate-in shake-1">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-bold">{error}</p>
                        </div>
                    )}

                    {warning && !error && (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3 text-amber-600 animate-in slide-in-from-top-1">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-bold">{warning}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre *</label>
                            <input
                                ref={firstNameRef}
                                type="text"
                                required
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                                placeholder="Ej. Juan"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Apellido *</label>
                            <input
                                type="text"
                                required
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                                placeholder="Ej. Pérez"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">DNI (Opcional)</label>
                        <input
                            type="text"
                            value={docId}
                            onChange={(e) => setDocId(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-mono font-bold text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                            placeholder="Ej. 40123456"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observaciones</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 font-medium text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 resize-none"
                            placeholder="Alguna nota relevante..."
                        />
                    </div>

                    <div className="pt-4 flex flex-col md:flex-row gap-3 text-sm">
                        <button
                            type="button"
                            onClick={onClose}
                            className="order-3 md:order-1 px-6 py-4 rounded-2xl font-black text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest"
                        >
                            Cancelar
                        </button>

                        {!initialData && (
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e as any, true)}
                                disabled={loading}
                                className="order-2 px-6 py-4 rounded-2xl border-2 border-slate-100 font-black text-slate-600 hover:border-indigo-100 hover:text-indigo-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                                <span className="hidden md:inline">Guardar y Agregar Otro</span>
                                <span className="md:hidden">Guardar y Otro</span>
                            </button>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="order-1 md:order-3 flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-indigo-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 hover:shadow-indigo-500/20"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
