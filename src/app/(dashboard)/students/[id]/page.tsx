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

                // 3. Compute Stats
                const total = sorted.length;
                const present = sorted.filter((r: any) => r.status === 'present').length;
                const absent = sorted.filter((r: any) => r.status === 'absent').length;
                const late = sorted.filter((r: any) => r.status === 'late').length;
                const justified = sorted.filter((r: any) => r.status === 'justified').length;

                setStats({
                    total,
                    present,
                    absent,
                    late,
                    justified,
                    percentage: total > 0 ? Math.round(((present + late * 0.5) / total) * 100) : 0
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
                    {/* Main Score */}
                    <div className="brand-card p-8 flex flex-col items-center justify-center text-center bg-white">
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
                                <span className="text-4xl font-black text-slate-900">{stats?.percentage}%</span>
                                <span className="text-[10px] uppercase font-bold text-slate-400">Asistencia</span>
                            </div>
                        </div>
                    </div>

                    {/* Breakdown */}
                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                        <div className="brand-card p-6 bg-emerald-50 border-emerald-100 flex flex-col justify-between">
                            <div className="p-3 bg-white w-fit rounded-xl text-emerald-600 mb-2">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="text-3xl font-black text-emerald-800">{stats?.present}</span>
                                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Presentes</p>
                            </div>
                        </div>
                        <div className="brand-card p-6 bg-red-50 border-red-100 flex flex-col justify-between">
                            <div className="p-3 bg-white w-fit rounded-xl text-red-600 mb-2">
                                <XCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="text-3xl font-black text-red-800">{stats?.absent}</span>
                                <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Ausencias</p>
                            </div>
                        </div>
                        <div className="brand-card p-6 bg-amber-50 border-amber-100 flex flex-col justify-between">
                            <div className="p-3 bg-white w-fit rounded-xl text-amber-600 mb-2">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="text-3xl font-black text-amber-800">{stats?.late}</span>
                                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Llegadas Tarde</p>
                            </div>
                        </div>
                        <div className="brand-card p-6 bg-blue-50 border-blue-100 flex flex-col justify-between">
                            <div className="p-3 bg-white w-fit rounded-xl text-blue-600 mb-2">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="text-3xl font-black text-blue-800">{stats?.justified}</span>
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Justificadas</p>
                            </div>
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
                                        {format(new Date(record.sessions.date), "EEEE d 'de' MMMM", { locale: es })}
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
