import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// --- Query Keys ---
export const QUERY_KEYS = {
    groups: ['groups'] as const,
    group: (id: string) => ['groups', id] as const,
    students: (groupId: string) => ['students', groupId] as const,
    sessions: (groupId: string) => ['sessions', groupId] as const,
    dailySummary: (groupId: string, date: string) => ['daily-summary', groupId, date] as const,
    todaySession: (groupId: string, date: string) => ['today-session', groupId, date] as const,
};

// --- Hooks ---

/**
 * Fetch all groups for the sidebar/dropdowns.
 */
export function useGroups() {
    return useQuery({
        queryKey: QUERY_KEYS.groups,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('groups')
                .select('id, name, org_id')
                .order('name');
            if (error) throw error;
            return data;
        },
    });
}

/**
 * Fetch basic group info and its students in one go.
 */
export function useGroupWithStudents(groupId: string) {
    return useQuery({
        queryKey: QUERY_KEYS.group(groupId),
        queryFn: async () => {
            const { data: group, error: groupError } = await supabase
                .from('groups')
                .select('id, name, org_id')
                .eq('id', groupId)
                .single();
            if (groupError) throw groupError;

            const { data: studentData, error: studentError } = await supabase
                .from('group_students')
                .select('students(id, first_name, last_name, doc_id)')
                .eq('group_id', groupId);
            if (studentError) throw studentError;

            const students = studentData.map((s: any) => s.students)
                .filter(Boolean)
                .sort((a: any, b: any) => a.last_name.localeCompare(b.last_name));

            return { group, students };
        },
        enabled: !!groupId,
    });
}

/**
 * Fetch daily summary using the optimized RPC.
 */
export function useDailySummary(groupId: string, date: string) {
    return useQuery({
        queryKey: QUERY_KEYS.dailySummary(groupId, date),
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_daily_attendance_summary', {
                p_group_id: groupId,
                p_date: date
            });
            if (error) throw error;
            return data[0] || null;
        },
        enabled: !!groupId && !!date,
    });
}

/**
 * Fetch all sessions for a group.
 */
export function useGroupSessions(groupId: string) {
    return useQuery({
        queryKey: QUERY_KEYS.sessions(groupId),
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sessions')
                .select('id, date, attendance_records(student_id, status, justification, comment)')
                .eq('group_id', groupId)
                .order('date', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!groupId,
    });
}

/**
 * Fetch today's session and records for a group.
 */
export function useTodaySession(groupId: string, dateStr: string) {
    return useQuery({
        queryKey: QUERY_KEYS.todaySession(groupId, dateStr),
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sessions')
                .select('*, attendance_records(*)')
                .eq('group_id', groupId)
                .eq('date', dateStr)
                .maybeSingle();
            if (error) throw error;
            return data;
        },
        enabled: !!groupId && !!dateStr,
    });
}
