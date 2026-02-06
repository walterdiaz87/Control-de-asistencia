'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, use, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
    Calendar, Download, ChevronLeft, ArrowRight,
    User, CheckCircle2, XCircle, Clock, AlertCircle,
    Loader2, Sparkles, Filter, PieChart as PieIcon,
    LayoutGrid, List, Search, Edit3, MessageCircle,
    Check, Info, ArrowLeft, ArrowRight as ArrowRightIcon
} from 'lucide-react';
import {
    format, startOfWeek, endOfWeek, eachDayOfInterval,
    isSameDay, startOfMonth, endOfMonth, isWithinInterval,
    parseISO, subDays
} from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Student {
    id: string;
    first_name: string;
    last_name: string;
    doc_id?: string;
}

interface Session {
    id: string;
    date: string;
    class_index: number;
    attendance_records: any[];
}

export default function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [currentId, setCurrentId] = useState(resolvedParams.id);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [group, setGroup] = useState<any>(null);
    const [allGroups, setAllGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'reports'>('reports');

    // Reports State
    const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]);
    const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'justified' | 'unjustified'>('all');

    const supabase = createClient();
    const router = useRouter();

    // Fetch all groups for the dropdown once
    useEffect(() => {
        async function fetchAllGroups() {
            const { data } = await supabase.from('groups').select('*').order('name');
            if (data) setAllGroups(data);
        }
        fetchAllGroups();
    }, []);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                // 1. Get Group
                const { data: groupData } = await supabase.from('groups').select('*').eq('id', currentId).single();
                if (groupData) setGroup(groupData);

                // 2. Get Students for the group
                const { data: studentData } = await supabase
                    .from('group_students')
                    .select('students(id, first_name, last_name, doc_id)')
                    .eq('group_id', currentId);

                if (studentData) {
                    const list = studentData.map((s: any) => s.students)
                        .filter(Boolean)
                        .sort((a: any, b: any) => a.last_name.localeCompare(b.last_name));
                    setStudents(list);
                }

                // 3. Get Sessions and Records
                const { data: sessionData } = await supabase
                    .from('sessions')
                    .select(`*, attendance_records(*)`)
                    .eq('group_id', currentId)
                    .order('date', { ascending: false });

                if (sessionData) {
                    setSessions(sessionData);
                    // Update URL if user switched course via dropdown
                    if (currentId !== resolvedParams.id) {
                        router.push(`/history/${currentId}`, { scroll: false });
                    }

                    // Set default selected date if not already set or manually changed
                    if (sessionData.length > 0) {
                        // We check if the current selectedDateStr has a session, if not we pick the latest
                        if (!sessionData.some(s => s.date === selectedDateStr)) {
                            setSelectedDateStr(sessionData[0].date);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching history:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [currentId]);

    // --- Analytics Logic ---
    const stats = useMemo(() => {
        let totalPresent = 0, totalAbsent = 0, totalLate = 0;
        sessions.forEach(s => {
            s.attendance_records.forEach((r: any) => {
                if (r.status === 'present') totalPresent++;
                if (r.status === 'absent') totalAbsent++;
                if (r.status === 'late') totalLate++;
            });
        });
        const totalRecords = totalPresent + totalAbsent + totalLate || 1;
        const rate = Math.round(((totalPresent + totalLate * 0.5) / totalRecords) * 100);

        return { totalPresent, totalAbsent, totalLate, rate, totalSessions: sessions.length };
    }, [sessions]);

    const chartData = useMemo(() => {
        return sessions.slice(0, 7).reverse().map(s => ({
            date: format(parseISO(s.date), 'd MMM', { locale: es }),
            presentes: s.attendance_records.filter((r: any) => r.status === 'present').length,
            ausentes: s.attendance_records.filter((r: any) => r.status === 'absent').length
        }));
    }, [sessions]);

    // --- Detailed Report Logic ---
    const activeSession = useMemo(() => {
        return sessions.find(s => s.date === selectedDateStr);
    }, [sessions, selectedDateStr]);

    const filteredStudents = useMemo(() => {
        return students.filter(student => {
            if (statusFilter === 'all') return true;

            const record = activeSession?.attendance_records.find(r => r.student_id === student.id);
            if (!record) return false;

            if (statusFilter === 'present') return record.status === 'present';
            if (statusFilter === 'absent') return record.status === 'absent';
            if (statusFilter === 'justified') return record.status === 'absent' && record.justification === 'justified';
            if (statusFilter === 'unjustified') return record.status === 'absent' && record.justification === 'unjustified';

            return true;
        });
    }, [students, activeSession, statusFilter]);

    const activeStats = useMemo(() => {
        if (!activeSession) return null;
        const records = activeSession.attendance_records;
        return {
            total: students.length,
            present: records.filter(r => r.status === 'present').length,
            absent: records.filter(r => r.status === 'absent').length,
            justified: records.filter(r => r.status === 'absent' && r.justification === 'justified').length,
            unjustified: records.filter(r => r.status === 'absent' && r.justification === 'unjustified').length
        };
    }, [activeSession, students]);

    const exportDailyCSV = () => {
        const headers = ['Fecha', 'Curso', 'Apellido', 'Nombre', 'DNI', 'Estado', 'Justificación', 'Comentario'];
        const rows = filteredStudents.map(s => {
            const r = activeSession?.attendance_records.find(rec => rec.student_id === s.id);
            return [
                selectedDateStr,
                group?.name,
                s.last_name,
                s.first_name,
                s.doc_id || '',
                r?.status === 'present' ? 'Presente' : r?.status === 'absent' ? 'Ausente' : 'Sin Dato',
                r?.justification === 'justified' ? 'Justificada' : r?.justification === 'unjustified' ? 'No Justificada' : '',
                r?.comment || ''
            ].map(val => `"${val}"`).join(',');
        });

        const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `reporte_${group?.name}_${selectedDateStr}.csv`);
        link.click();
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Nav Header */}
            <header className="bg-white border-b border-slate-100 px-6 py-5 md:px-12 sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6 justify-between items-center">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button onClick={() => router.back()} className="p-3 hover:bg-slate-50 rounded-2xl transition-all">
                            <ChevronLeft className="w-6 h-6 text-slate-400" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 leading-tight">{group?.name}</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md">Historia & Reportes</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-2xl w-full md:w-auto shadow-inner">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`flex-1 md:w-40 py-3 rounded-[14px] text-xs font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'dashboard' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                            DASHBOARD
                        </button>
                        <button
                            onClick={() => setActiveTab('reports')}
                            className={`flex-1 md:w-40 py-3 rounded-[14px] text-xs font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'reports' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <List className="w-4 h-4" />
                            REPORTE DÍA
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6 md:p-12 space-y-8">
                {activeTab === 'dashboard' ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="brand-card p-8 bg-indigo-600 text-white border-none shadow-2xl shadow-indigo-200">
                                <PieIcon className="w-10 h-10 mb-4 opacity-50" />
                                <div className="text-4xl font-black mb-1">{stats.rate}%</div>
                                <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Asistencia Global</div>
                            </div>
                            <div className="brand-card p-8 bg-white border-slate-100">
                                <Calendar className="w-10 h-10 mb-4 text-slate-200" />
                                <div className="text-4xl font-black text-slate-900 mb-1">{stats.totalSessions}</div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sesiones registradas</div>
                            </div>
                            <div className="brand-card p-8 bg-white border-slate-100">
                                <div className="w-3 h-3 rounded-full bg-emerald-500 mb-6" />
                                <div className="text-4xl font-black text-emerald-600 mb-1">{stats.totalPresent}</div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Presentes históricos</div>
                            </div>
                            <div className="brand-card p-8 bg-white border-slate-100">
                                <div className="w-3 h-3 rounded-full bg-red-500 mb-6" />
                                <div className="text-4xl font-black text-red-500 mb-1">{stats.totalAbsent}</div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ausencias acumuladas</div>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="brand-card p-8 bg-white border-slate-100 overflow-hidden">
                            <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-indigo-500" />
                                Evolución de asistencia (Últimos días)
                            </h3>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                            dy={15}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#cdd5e0', fontSize: 10, fontWeight: 700 }}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{
                                                borderRadius: '20px',
                                                border: 'none',
                                                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                                fontWeight: 800,
                                                fontSize: '11px'
                                            }}
                                        />
                                        <Bar dataKey="presentes" name="Presentes" fill="#000000" radius={[6, 6, 0, 0]} barSize={40} />
                                        <Bar dataKey="ausentes" name="Ausentes" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Reports Search & Date Selection */}
                        <div className="flex flex-col xl:flex-row gap-6">
                            <div className="brand-card p-8 bg-white flex-1 space-y-6">
                                <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
                                    <div className="space-y-1">
                                        <h2 className="text-xl font-black text-slate-900">Configurar Informe</h2>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Selecciona una fecha para ver el detalle</p>
                                    </div>
                                    <button
                                        onClick={exportDailyCSV}
                                        disabled={!activeSession}
                                        className="h-12 px-6 bg-slate-900 text-white text-xs font-black rounded-2xl flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                    >
                                        <Download className="w-4 h-4" />
                                        EXPORTAR CSV DÍA
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                                    {/* Fecha del Informe */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center h-6 ml-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha del Informe</label>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setSelectedDateStr(new Date().toISOString().split('T')[0]);
                                                    }}
                                                    className="text-[9px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-tighter transition-colors"
                                                >
                                                    Hoy
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (sessions.length > 0) setSelectedDateStr(sessions[0].date);
                                                    }}
                                                    className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-tighter transition-colors"
                                                >
                                                    Último
                                                </button>
                                            </div>
                                        </div>
                                        <div className="relative group overflow-hidden rounded-2xl h-14">
                                            <div className="w-full bg-slate-50 h-full pl-12 pr-4 flex items-center transition-all group-hover:bg-slate-100 ring-1 ring-transparent group-hover:ring-indigo-100/50">
                                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                                <span className="text-sm font-black text-slate-900 truncate uppercase">
                                                    {format(parseISO(selectedDateStr), "EEEE d 'de' MMMM", { locale: es })}
                                                </span>
                                            </div>
                                            <input
                                                type="date"
                                                value={selectedDateStr}
                                                onChange={(e) => setSelectedDateStr(e.target.value)}
                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                            />
                                        </div>
                                    </div>

                                    {/* Seleccionar Curso */}
                                    <div className="flex flex-col gap-2">
                                        <div className="h-6 flex items-center ml-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seleccionar Curso</label>
                                        </div>
                                        <div className="relative group">
                                            <div className="w-full bg-slate-50 h-14 pl-12 pr-4 flex items-center rounded-2xl transition-all group-hover:bg-slate-100 ring-1 ring-transparent group-hover:ring-indigo-100/50">
                                                <LayoutGrid className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors pointer-events-none" />
                                                <select
                                                    value={currentId}
                                                    onChange={(e) => setCurrentId(e.target.value)}
                                                    className="w-full bg-transparent border-none text-sm font-black text-slate-900 outline-none h-full cursor-pointer appearance-none"
                                                >
                                                    {allGroups.length === 0 && <option value="">No hay cursos creados</option>}
                                                    {allGroups.map(g => (
                                                        <option key={g.id} value={g.id}>{g.name}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                                    <ChevronLeft className="w-4 h-4 rotate-[-90deg]" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Filtrar por Estado */}
                                    <div className="flex flex-col gap-2">
                                        <div className="h-6 flex items-center ml-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrar por Estado</label>
                                        </div>
                                        <div className="relative group">
                                            <div className="w-full bg-slate-50 h-14 pl-12 pr-4 flex items-center rounded-2xl transition-all group-hover:bg-slate-100 ring-1 ring-transparent group-hover:ring-indigo-100/50">
                                                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors pointer-events-none" />
                                                <select
                                                    value={statusFilter}
                                                    onChange={(e) => setStatusFilter(e.target.value as any)}
                                                    className="w-full bg-transparent border-none text-sm font-black text-slate-900 outline-none h-full cursor-pointer appearance-none"
                                                >
                                                    <option value="all">Ver Todos</option>
                                                    <option value="present">Solo Presentes</option>
                                                    <option value="absent">Solo Ausentes</option>
                                                    <option value="justified">Solo Justificados</option>
                                                    <option value="unjustified">Solo No Justificados</option>
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                                    <ChevronLeft className="w-4 h-4 rotate-[-90deg]" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Daily Summary Side Panel */}
                            {activeStats && (
                                <div className="brand-card p-8 bg-white md:w-80 space-y-6">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Resumen del Día</h3>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-400 font-bold">Asistencia</span>
                                            <span className="font-black text-indigo-600 px-2 py-1 bg-indigo-50 rounded-lg">
                                                {Math.round((activeStats.present / activeStats.total) * 100)}%
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 bg-emerald-50 rounded-xl">
                                                <div className="text-xl font-black text-emerald-600">{activeStats.present}</div>
                                                <div className="text-[9px] font-black text-emerald-400 uppercase">Presentes</div>
                                            </div>
                                            <div className="p-3 bg-rose-50 rounded-xl">
                                                <div className="text-xl font-black text-rose-600">{activeStats.absent}</div>
                                                <div className="text-[9px] font-black text-rose-400 uppercase">Ausentes</div>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-slate-50 space-y-3">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                                <span>Justificados</span>
                                                <span className="text-slate-600">{activeStats.justified}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                                                <span>No Justificados</span>
                                                <span className="text-rose-500">{activeStats.unjustified}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => router.push(`/attendance/${currentId}`)}
                                            className="w-full h-12 flex items-center justify-center gap-2 text-indigo-600 font-black text-xs hover:bg-indigo-50 rounded-xl transition-all border-2 border-indigo-100"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                            EDITAR DÍA
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Student Grid */}
                        <div className="space-y-4">
                            {!activeSession && !loading && (
                                <div className="brand-card p-20 bg-white text-center space-y-4 flex flex-col items-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center">
                                        <Calendar className="w-8 h-8 text-slate-200" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900">Sin datos registrados</h3>
                                        <p className="text-sm text-slate-400">No se ha tomado asistencia para este día.</p>
                                    </div>
                                    <button
                                        onClick={() => router.push(`/attendance/${currentId}`)}
                                        className="brand-button-primary px-8 h-12 text-sm mt-4"
                                    >
                                        Tomar Asistencia Hoy
                                    </button>
                                </div>
                            )}

                            {activeSession && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredStudents.length === 0 && (
                                        <div className="col-span-full py-20 text-center">
                                            <p className="font-black text-slate-400 uppercase tracking-widest text-xs">No se encontraron alumnos para ese filtro</p>
                                        </div>
                                    )}
                                    {filteredStudents.map((student) => {
                                        const record = activeSession.attendance_records.find(r => r.student_id === student.id);
                                        const isAbsent = record?.status === 'absent';

                                        return (
                                            <div key={student.id}
                                                className={`brand-card p-6 bg-white flex flex-col justify-between gap-6 hover:shadow-2xl hover:shadow-slate-200 transition-all border-none shadow-sm ring-1 ${isAbsent ? 'ring-red-100' : 'ring-slate-100'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5">{student.last_name}</p>
                                                        <h4 className="text-xl font-black text-slate-900 leading-tight">{student.first_name}</h4>
                                                        {student.doc_id && (
                                                            <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono font-bold text-slate-400 uppercase">
                                                                <Info className="w-3 h-3" />
                                                                DNI {student.doc_id}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {record ? (
                                                        <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${record.status === 'present'
                                                            ? 'bg-emerald-50 text-emerald-600'
                                                            : 'bg-red-50 text-red-600'
                                                            }`}>
                                                            {record.status === 'present' ? 'Presente' : 'Ausente'}
                                                        </div>
                                                    ) : (
                                                        <div className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-400">
                                                            Sin Registro
                                                        </div>
                                                    )}
                                                </div>

                                                {isAbsent && (
                                                    <div className="space-y-4 pt-4 border-t border-red-50">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md ${record.justification === 'justified'
                                                                ? 'bg-indigo-50 text-indigo-600'
                                                                : 'bg-slate-100 text-slate-400'
                                                                }`}>
                                                                {record.justification === 'justified' ? 'JUSTIFICADO' : 'NO JUSTIFICADO'}
                                                            </span>
                                                        </div>
                                                        {record.comment && (
                                                            <div className="bg-slate-50 p-3 rounded-2xl flex gap-3 items-start">
                                                                <MessageCircle className="w-3 h-3 text-slate-300 mt-1 shrink-0" />
                                                                <p className="text-[11px] font-bold text-slate-600 leading-relaxed italic line-clamp-2">
                                                                    "{record.comment}"
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
