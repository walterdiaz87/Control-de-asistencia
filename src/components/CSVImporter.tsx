'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, X, Check, AlertCircle, FileText, Table as TableIcon, Info, Loader2, CheckCircle2 } from 'lucide-react';

export interface ImportedStudent {
    first_name: string;
    last_name: string;
    doc_id?: string;
    status: 'valid' | 'invalid' | 'duplicate';
    message?: string;
}

interface CsvImporterProps {
    onImport: (students: ImportedStudent[]) => void;
    onCancel: () => void;
}

export default function CsvImporter({ onImport, onCancel }: CsvImporterProps) {
    const [preview, setPreview] = useState<ImportedStudent[]>([]);
    const [stats, setStats] = useState({ total: 0, valid: 0, invalid: 0, duplicate: 0 });
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const normalize = (str: string) => str.toLowerCase().trim().replace(/[áéíóú]/g, (c) => 'aeiou'['áéíóú'.indexOf(c)]);

    const processFile = (file: File) => {
        setIsProcessing(true);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => normalize(h),
            complete: (results) => {
                const uniqueDnis = new Set<string>();
                const uniqueNames = new Set<string>();

                const processed = results.data.map((row: any) => {
                    // Try to map fields
                    const firstName = row.nombre || row.name || row.nombres || '';
                    const lastName = row.apellido || row.apellidos || row.last_name || '';
                    const doc_id = row.dni || row.documento || row.id || row.doc_id || '';

                    let status: 'valid' | 'invalid' | 'duplicate' = 'valid';
                    let message = '';

                    // 1. Validation
                    if (!firstName || !lastName) {
                        status = 'invalid';
                        message = 'Falta nombre o apellido';
                    }

                    // 2. Duplicates
                    if (status === 'valid') {
                        if (doc_id) {
                            if (uniqueDnis.has(doc_id)) {
                                status = 'duplicate';
                                message = 'DNI duplicado en archivo';
                            } else {
                                uniqueDnis.add(doc_id);
                            }
                        } else {
                            // Dedupe by name if no DNI
                            const fullNameKey = normalize(`${firstName} ${lastName}`);
                            if (uniqueNames.has(fullNameKey)) {
                                status = 'duplicate';
                                message = 'Nombre duplicado en archivo';
                            } else {
                                uniqueNames.add(fullNameKey);
                            }
                        }
                    }

                    return {
                        first_name: firstName,
                        last_name: lastName,
                        doc_id,
                        status,
                        message
                    };
                });

                setPreview(processed);
                setStats({
                    total: processed.length,
                    valid: processed.filter(p => p.status === 'valid').length,
                    invalid: processed.filter(p => p.status === 'invalid').length,
                    duplicate: processed.filter(p => p.status === 'duplicate').length
                });
                setIsProcessing(false);
            },
            error: (err) => {
                console.error(err);
                setIsProcessing(false);
                alert('Error al procesar el archivo CSV.');
            }
        });
    };

    const handleImport = () => {
        // Return only valid ones
        onImport(preview.filter(p => p.status === 'valid'));
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-900">Importar Estudiantes</h3>
                        <p className="text-slate-400 text-xs font-medium">Desde archivo CSV / Excel</p>
                    </div>
                </div>
                <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                </button>
            </div>

            {preview.length === 0 ? (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-3xl p-12 flex flex-col items-center gap-4 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                >
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-primary transition-all">
                        {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                    </div>
                    <div className="text-center">
                        <p className="text-slate-900 font-bold">Haz clic o arrastra tu archivo CSV</p>
                        <p className="text-slate-400 text-sm mt-1">
                            Columnas: <span className="font-mono bg-slate-100 px-1 rounded">Nombre</span>, <span className="font-mono bg-slate-100 px-1 rounded">Apellido</span>, <span className="font-mono bg-slate-100 px-1 rounded">DNI</span>
                        </p>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                        accept=".csv"
                        className="hidden"
                    />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-2">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                            <span className="text-[10px] uppercase font-black text-slate-400">Total</span>
                            <div className="text-lg font-black text-slate-900">{stats.total}</div>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                            <span className="text-[10px] uppercase font-black text-emerald-500">Válidos</span>
                            <div className="text-lg font-black text-emerald-700">{stats.valid}</div>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center">
                            <span className="text-[10px] uppercase font-black text-amber-500">Duplicados</span>
                            <div className="text-lg font-black text-amber-700">{stats.duplicate}</div>
                        </div>
                        <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-center">
                            <span className="text-[10px] uppercase font-black text-red-500">Inválidos</span>
                            <div className="text-lg font-black text-red-700">{stats.invalid}</div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[300px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs font-bold text-slate-500 sticky top-0 uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-2 text-left">Estado</th>
                                    <th className="px-4 py-2 text-left">Nombre</th>
                                    <th className="px-4 py-2 text-left">DNI</th>
                                    <th className="px-4 py-2 text-left">Nota</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {preview.slice(0, 50).map((p, i) => (
                                    <tr key={i} className={p.status !== 'valid' ? 'bg-slate-50/50' : ''}>
                                        <td className="px-4 py-2">
                                            {p.status === 'valid' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                            {p.status === 'duplicate' && <Info className="w-4 h-4 text-amber-500" />}
                                            {p.status === 'invalid' && <X className="w-4 h-4 text-red-500" />}
                                        </td>
                                        <td className="px-4 py-2 font-medium text-slate-900">
                                            {p.last_name}, {p.first_name}
                                        </td>
                                        <td className="px-4 py-2 font-mono text-xs">{p.doc_id || '-'}</td>
                                        <td className="px-4 py-2 text-xs text-slate-500">{p.message}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {preview.length > 50 && (
                            <div className="p-2 text-center text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
                                ... y {preview.length - 50} más
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => { setPreview([]); setStats({ total: 0, valid: 0, invalid: 0, duplicate: 0 }); }}
                            className="flex-1 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 text-sm hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={stats.valid === 0}
                            className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 disabled:opacity-50 disabled:shadow-none"
                        >
                            Importar {stats.valid} Estudiantes
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
