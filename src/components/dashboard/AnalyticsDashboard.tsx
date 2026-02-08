'use client';

import { useState } from 'react';
import { useOrgAnalytics } from '@/hooks/use-queries';
import {
    Users,
    BookOpen,
    TrendingUp,
    Calendar,
    Loader2,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Clock,
    ChevronDown
} from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip
} from 'recharts';
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
    membership: {
        org_id: string;
        role: string;
    };
    userId: string;
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

export default function AnalyticsDashboard({ membership, userId }: Props) {
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');

    // Calculate dates
    const now = new Date();
    const end = format(now, 'yyyy-MM-dd');
    let start = format(now, 'yyyy-MM-dd');

    if (period === 'week') start = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    if (period === 'month') start = format(startOfMonth(now), 'yyyy-MM-dd');

    const teacherId = membership.role === 'admin' ? undefined : userId;
    const { data: analytics, isLoading } = useOrgAnalytics(membership.org_id, start, end, teacherId);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando estadísticas...</p>
            </div>
        );
    }

    const global = analytics?.global || { total_students: 0, total_groups: 0, avg_percentage: 0, present: 0, absent: 0, late: 0, justified: 0 };
    const pieData = [
        { name: 'Presentes', value: global.present },
        { name: 'Ausentes', value: global.absent },
        { name: 'Tardes', value: global.late },
        { name: 'Justificados', value: global.justified },
    ].filter(d => d.value > 0);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header & Filters */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="space-y-1">
                    <h2 className="text-2xl font-black text-slate-900 leading-tight">Resumen General</h2>
                    <p className="text-slate-500 text-sm">Estado de asistencia de tu institución.</p>
                </div>

                <div className="inline-flex p-1 bg-slate-50 rounded-2xl border border-slate-100 self-start">
                    {(['today', 'week', 'month'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${period === p
                                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            {p === 'today' ? 'Hoy' : p === 'week' ? 'Semana' : 'Mes'}
                        </button>
                    ))}
                </div>
            </header>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="brand-card p-6 bg-white flex flex-col justify-between hover:border-indigo-100 transition-all">
                    <div className="p-3 bg-indigo-50 w-fit rounded-xl text-indigo-600 mb-4">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-3xl font-black text-slate-900 leading-none">{global.total_students}</span>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Alumnos</p>
                    </div>
                </div>

                <div className="brand-card p-6 bg-white flex flex-col justify-between hover:border-emerald-100 transition-all">
                    <div className="p-3 bg-emerald-50 w-fit rounded-xl text-emerald-600 mb-4">
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-3xl font-black text-slate-900 leading-none">{global.total_groups}</span>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Grupos</p>
                    </div>
                </div>

                <div className={`brand-card p-6 flex flex-col justify-between transition-all ${global.avg_percentage > 85 ? 'bg-emerald-50 border-emerald-100' :
                    global.avg_percentage > 70 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
                    }`}>
                    <div className="p-3 bg-white w-fit rounded-xl text-slate-800 mb-4 shadow-sm">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-3xl font-black text-slate-900 leading-none">{global.avg_percentage}%</span>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Asistencia</p>
                    </div>
                </div>

                <div className="brand-card p-6 bg-indigo-600 flex flex-col justify-between text-white shadow-xl shadow-indigo-100">
                    <div className="p-3 bg-white/20 w-fit rounded-xl mb-4">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-lg font-bold leading-tight uppercase text-indigo-100">
                            {period === 'today' ? 'Reporte' : period === 'week' ? 'Semanal' : 'Mensual'}
                        </span >
                        <p className="text-[10px] font-black text-white uppercase tracking-widest">Activo</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart Section */}
                <div className="brand-card p-8 bg-white lg:col-span-1">
                    <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                        Distribución
                    </h3>
                    <div className="relative h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ fontWeight: 'bold' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                            <span className="text-3xl font-black text-slate-900">{global.avg_percentage}%</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Promedio</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-6">
                        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-bold text-slate-600">{global.present} Pres.</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-xs font-bold text-slate-600">{global.absent} Aus.</span>
                        </div>
                    </div>
                </div>

                {/* Per-Group Breakdown */}
                <div className="brand-card p-8 bg-white lg:col-span-2 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-indigo-500" />
                            Rendimiento por Grupo
                        </h3>
                    </div>

                    <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 max-h-[400px]">
                        {analytics?.groups?.map((group: any) => (
                            <div key={group.id} className="group p-4 bg-slate-50 rounded-2xl border border-slate-100/50 hover:border-indigo-100 transition-all">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                                            {group.type === 'course' ? 'Curso' : 'Taller'}
                                        </span>
                                        <span className="font-bold text-slate-900">{group.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-xl font-black tracking-tighter ${group.percentage > 85 ? 'text-emerald-600' :
                                            group.percentage > 70 ? 'text-amber-600' : 'text-red-600'
                                            }`}>
                                            {group.percentage}%
                                        </span>
                                    </div>
                                </div>
                                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${group.percentage > 85 ? 'bg-emerald-500' :
                                            group.percentage > 70 ? 'bg-amber-500' : 'bg-red-500'
                                            }`}
                                        style={{ width: `${group.percentage}%` }}
                                    />
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-[10px] font-bold text-slate-400">Total: {group.total} alumnos</span>
                                    <a
                                        href={`/history/${group.id}`}
                                        className="text-[10px] font-black text-indigo-500 uppercase flex items-center gap-1 hover:underline"
                                    >
                                        Detalle <ChevronDown className="w-3 h-3 rotate-270" />
                                    </a>
                                </div>
                            </div>
                        ))}

                        {(!analytics?.groups || analytics.groups.length === 0) && (
                            <div className="h-full flex flex-col items-center justify-center py-10 text-slate-300">
                                <AlertCircle className="w-12 h-12 mb-3 opacity-20" />
                                <p className="font-bold text-sm tracking-widest uppercase">Sin datos en este período</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
