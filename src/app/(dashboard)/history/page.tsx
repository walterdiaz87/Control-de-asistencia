'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export default function HistoryLanding() {
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        async function redirectToFirstGroup() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }

            const { data: membership } = await supabase
                .from('organization_members')
                .select('org_id, role')
                .eq('user_id', session.user.id)
                .limit(1)
                .maybeSingle();

            if (membership) {
                let query = supabase
                    .from('groups')
                    .select('id')
                    .eq('org_id', membership.org_id)
                    .order('name')
                    .limit(1);

                if (membership.role !== 'admin') {
                    query = query.eq('teacher_id', session.user.id);
                }

                const { data: groups } = await query;

                if (groups && groups.length > 0) {
                    router.replace(`/history/${groups[0].id}`);
                } else {
                    router.replace('/courses'); // No groups to show history for
                }
            } else {
                router.replace('/onboarding');
            }
        }

        redirectToFirstGroup();
    }, [router, supabase]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
            <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Cargando Historial...</p>
        </div>
    );
}
