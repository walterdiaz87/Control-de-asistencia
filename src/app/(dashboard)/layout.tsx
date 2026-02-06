import { Sidebar } from '@/components/Sidebar';
import { BottomNav } from '@/components/BottomNav';
import { Header } from '@/components/Header';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-slate-50 md:pl-64">
            <Sidebar />
            <Header />
            <main className="pb-24 md:pb-8 min-h-screen">
                {children}
            </main>
            <BottomNav />
        </div>
    );
}
