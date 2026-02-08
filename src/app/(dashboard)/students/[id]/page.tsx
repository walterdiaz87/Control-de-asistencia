'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Calendar, CheckCircle2, XCircle, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function StudentDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [student, setStudent] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        async function fetchData() {
            setLoading(true);

            // 1. Get Student Info
            const { data: studentData } = await supabase
                .from('students')
                .select('*')
                .eq('id', id)
                .single();

            if (studentData) setStudent(studentData);

            // 2. Get Attendance History
            // We join with sessions to get the date and group name
            const { data: records } = await supabase
                .from('attendance_records')
                .select(`
                    *,
                    sessions (
                        date,
                        groups (name)
                    )
                `)
                .eq('student_id', id)
                .order('sessions(date)', { ascending: false }); // Note: sorting by joined column might need precise syntax or js sort

            if (records) {
                // Sort by date JS side just to be sure
                const sorted = records.sort((a: any, b: any) =>
                    new Date(b.sessions.date).getTime() - new Date(a.sessions.date).getTime()
                );

                setHistory(sorted);

                // Group by Group ID for per-group stats
                const grouped: any = {};
                sorted.forEach((r: any) => {
                    const gId = r.sessions?.groups?.id || 'unknown';
                    const gName = r.sessions?.groups?.name || 'Otro';
                    if (!grouped[gId]) {
                        grouped[gId] = { id: gId, name: gName, records: [], stats: {} };
                    }
                    grouped[gId].records.push(r);
                });

                Object.keys(grouped).forEach(gId => {
                    const groupRecords = grouped[gId].records;
                    const total = groupRecords.length;
                    const present = groupRecords.filter((r: any) => r.status === 'present').length;
                    const late = groupRecords.filter((r: any) => r.status === 'late').length;
                    grouped[gId].stats = {
                        total,
                        present,
                        absent: groupRecords.filter((r: any) => r.status === 'absent').length,
                        late,
                        justified: groupRecords.filter((r: any) => r.status === 'justified').length,
                        percentage: total > 0 ? Math.round(((present + late * 0.5) / total) * 100) : 0
                    };
                });

                // Global Stats
                const total = sorted.length;
                const present = sorted.filter((r: any) => r.status === 'present').length;
                const late = sorted.filter((r: any) => r.status === 'late').length;

                setStats({
                    global: {
                        total,
                        present,
                        absent: sorted.filter((r: any) => r.status === 'absent').length,
                        late,
                        justified: sorted.filter((r: any) => r.status === 'justified').length,
                        percentage: total > 0 ? Math.round(((present + late * 0.5) / total) * 100) : 0
                    },
                    perGroup: Object.values(grouped)
                });
            }

            setLoading(false);
        }
        fetchData();
    }, [id]);

    const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

    if (loading) return <div className="p-12 text-center text-slate-400">Cargando perfil...</div>;

    const pieData = stats ? [
        { name: 'Presente', value: stats.present },
        { name: 'Ausente', value: stats.absent },
        { name: 'Tarde', value: stats.late },
        { name: 'Justificado', value: stats.justified },
    ].filter(d => d.value > 0) : [];

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-12">
            <header className="max-w-5xl mx-auto mb-8 flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-3 hover:bg-white rounded-2xl transition-all hover:shadow-sm text-slate-400 hover:text-slate-900"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Perfil de Estudiante</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 leading-tight">
                        {student?.last_name}, {student?.first_name}
                    </h1>
                    {student?.dni && <p className="text-slate-400 text-sm font-mono">DNI: {student.dni}</p>}
                </div>
            </header>

            <main className="max-w-5xl mx-auto space-y-8">
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Main Score (Global) */}
                    <div className="brand-card p-8 flex flex-col items-center justify-center text-center bg-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 bg-slate-50 text-slate-400 font-black text-[8px] uppercase tracking-tighter border-bl rounded-bl-xl">Global</div>
                        <div className="relative w-40 h-40 mb-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-4xl font-black text-slate-900">{stats?.global?.percentage}%</span>
                                <span className="text-[10px] uppercase font-bold text-slate-400">Asistencia</span>
                            </div>
                        </div>
                    </div>

                    {/* Breakdown by Group */}
                    <div className="md:col-span-2 brand-card p-8 bg-white overflow-hidden">
                        <div className="flex items-center gap-2 mb-6 text-slate-900">
                            <TrendingUp className="w-5 h-5 text-indigo-500" />
                            <h3 className="text-lg font-black tracking-tight">Promedio por Curso / Taller</h3>
                        </div>
                        <div className="space-y-4 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                            {stats?.perGroup?.map((group: any) => (
                                <div key={group.id} className="group flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50 hover:border-indigo-100 transition-all">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Grupo</span>
                                        <span className="font-bold text-slate-900 truncate max-w-[200px]">{group.name}</span>
                                    </div>
                                    <div className="text-right flex items-center gap-4">
                                        <div className="hidden sm:block">
                                            <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${group.stats.percentage > 80 ? 'bg-emerald-500' : group.stats.percentage > 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                    style={{ width: `${group.stats.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                        <span className={`text-2xl font-black tracking-tighter ${group.stats.percentage > 80 ? 'text-emerald-600' : group.stats.percentage > 60 ? 'text-amber-600' : 'text-red-600'}`}>
                                            {group.stats.percentage}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* History List */}
                <section className="brand-card p-8 bg-white">
                    <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-slate-400" />
                        Historial Completo
                    </h3>
                    <div className="space-y-4">
                        {history.map((record: any) => (
                            <div key={record.id} className="flex items-center justify-between p-4 border rounded-2xl hover:bg-slate-50 transition-colors">
                                <div>
                                    <p className="font-bold text-slate-900 text-lg capitalize">
                                        {format(new Date(record.sessions.date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                                    </p>
                                    <p className="text-xs text-slate-400 font-medium">
                                        {record.sessions.groups.name}
                                    </p>
                                </div>
                                <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border ${record.status === 'present' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                    record.status === 'absent' ? 'bg-red-50 text-red-600 border-red-100' :
                                        record.status === 'late' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                            'bg-blue-50 text-blue-600 border-blue-100'
                                    }`}>
                                    {record.status === 'present' ? 'Presente' :
                                        record.status === 'absent' ? 'Ausente' :
                                            record.status === 'late' ? 'Tarde' : 'Justificado'}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
