'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { X, Save, Loader2 } from 'lucide-react';

interface CourseFormProps {
    onClose: () => void;
    onSuccess: () => void;
    initialData?: any;
    orgId: string;
}

export default function CourseForm({ onClose, onSuccess, initialData, orgId }: CourseFormProps) {
    const [name, setName] = useState(initialData?.name || '');
    const [type, setType] = useState(initialData?.type || 'course');
    const [year, setYear] = useState(new Date().getFullYear()); // Default to current year, ideally select Academic Year ID
    // Note: Database uses academic_year_id. For simplicity we'll fetch the academic year for the selected number, or create it if missing?
    // Better: Select from existing academic years.

    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [selectedYearId, setSelectedYearId] = useState(initialData?.academic_year_id || '');

    const [loading, setLoading] = useState(false);
    const supabase = createClient();
    const queryClient = useQueryClient();

    useEffect(() => {
        const fetchYears = async () => {
            const { data } = await supabase.from('academic_years').select('*').eq('org_id', orgId).order('year', { ascending: false });
            if (data && data.length > 0) {
                setAcademicYears(data);
                if (!selectedYearId && !initialData) {
                    setSelectedYearId(data[0].id);
                }
            } else {
                // If no years, we might need to handle creation or prompt user
                // For now assuming onboarding created one.
            }
        };
        fetchYears();
    }, [orgId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert('Sesión expirada');
            setLoading(false);
            return;
        }

        const payload: any = {
            org_id: orgId,
            name,
            type,
            academic_year_id: selectedYearId,
            teacher_id: user.id // Always attribute to creator
        };

        let error;
        if (initialData) {
            const { error: err } = await supabase
                .from('groups')
                .update(payload)
                .eq('id', initialData.id);
            error = err;
        } else {
            const { error: err, data } = await supabase
                .from('groups')
                .insert(payload)
                .select()
                .single();
            error = err;
            if (data) {
                onSuccess();
            }
        }

        setLoading(false);

        if (error) {
            alert('Error al guardar: ' + error.message);
        } else {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            onSuccess();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="font-black text-lg text-slate-900">{initialData ? 'Editar Curso' : 'Nuevo Curso'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Nombre</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            placeholder="Ej. Matemática 4to Año"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 outline-none"
                            >
                                <option value="course">Curso</option>
                                <option value="workshop">Taller</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Año Lectivo</label>
                            <select
                                value={selectedYearId}
                                onChange={(e) => setSelectedYearId(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-900 outline-none"
                            >
                                {academicYears.map(ay => (
                                    <option key={ay.id} value={ay.id}>{ay.year}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !selectedYearId}
                            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
