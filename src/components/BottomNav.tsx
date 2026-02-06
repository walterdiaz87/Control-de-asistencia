'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, BookOpen, Users, Menu, LogOut, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const [showMenu, setShowMenu] = useState(false);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.refresh();
        router.push('/login');
    };

    const navItems = [
        { href: '/', label: 'Inicio', icon: LayoutGrid },
        { href: '/courses', label: 'Cursos', icon: BookOpen },
        // Add more if needed
    ];

    return (
        <>
            <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 pb-safe z-50 px-6 py-2 flex justify-between items-center shadow-[0_-4px_20px_rgb(0,0,0,0.03)]">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-colors gap-1 ${isActive ? 'text-indigo-600' : 'text-slate-400'
                                }`}
                        >
                            <item.icon className={`w-6 h-6 ${isActive ? 'fill-current opacity-20' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] font-bold">{item.label}</span>
                        </Link>
                    );
                })}

                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl transition-colors gap-1 ${showMenu ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                >
                    <MoreHorizontal className="w-6 h-6" />
                    <span className="text-[10px] font-bold">Menú</span>
                </button>
            </nav>

            {/* Mobile Menu Overlay */}
            {showMenu && (
                <div className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setShowMenu(false)}>
                    <div className="absolute bottom-24 right-4 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-10 fade-in col-start-1" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-50">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cuenta</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 font-bold text-sm transition-colors text-left"
                        >
                            <LogOut className="w-4 h-4" />
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
