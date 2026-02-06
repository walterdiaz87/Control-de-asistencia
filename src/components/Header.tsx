'use client';

import { Bell, Search } from 'lucide-react';

export function Header() {
    return (
        <header className="sticky top-0 z-30 bg-slate-50/80 backdrop-blur-xl border-b border-slate-100/50 px-6 py-4 md:hidden">
            <div className="flex items-center justify-between">
                <h1 className="font-black text-lg text-slate-900">Asistencia Docente</h1>
                <button className="p-2 bg-white rounded-full shadow-sm text-slate-400">
                    <Bell className="w-5 h-5" />
                </button>
            </div>
        </header>
    );
}
