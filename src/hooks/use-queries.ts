import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// --- Query Keys ---
export const QUERY_KEYS = {
    groups: (filters?: { orgId?: string; teacherId?: string }) => ['groups', filters] as const,
    group: (id: string) => ['groups', id] as const,
    students: (groupId: string) => ['students', groupId] as const,
    sessions: (groupId: string) => ['sessions', groupId] as const,
    dailySummary: (groupId: string, date: string) => ['daily-summary', groupId, date] as const,
    todaySession: (groupId: string, date: string) => ['today-session', groupId, date] as const,
    analytics: (orgId: string, start: string, end: string, teacherId?: string) => ['analytics', orgId, start, end, teacherId] as const,
};

// --- Hooks ---

const DEFAULT_STALE_TIME = 1000 * 60 * 5; // 5 minutes for catalogs

/**
 * Fetch all groups for the sidebar/dropdowns.
 */
export function useGroups(orgId?: string, teacherId?: string) {
    return useQuery({
        queryKey: QUERY_KEYS.groups({ orgId, teacherId }),
        queryFn: async () => {
            if (!orgId) return [];
            let query = supabase
                .from('groups')
                .select('id, name, org_id, teacher_id')
                .eq('org_id', orgId);

            if (teacherId) {
                query = query.eq('teacher_id', teacherId);
            }

            const { data, error } = await query.order('name');
            if (error) throw error;
            return data;
        },
        enabled: !!orgId,
        staleTime: DEFAULT_STALE_TIME,
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
        staleTime: DEFAULT_STALE_TIME,
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
        staleTime: 1000 * 30, // 30 seconds for live summary
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
        staleTime: 1000 * 60, // 1 minute
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
                .select('id, group_id, date, class_index, attendance_records(id, student_id, status, justification, comment)')
                .eq('group_id', groupId)
                .eq('date', dateStr)
                .maybeSingle();
            if (error) throw error;
            return data;
        },
        enabled: !!groupId && !!dateStr,
        staleTime: 1000 * 10, // 10 seconds (frequent updates possible while taking attendance)
    });
}
/**
 * Fetch organization-wide analytics.
 */
export function useOrgAnalytics(orgId: string, startDate: string, endDate: string, teacherId?: string) {
    return useQuery({
        queryKey: QUERY_KEYS.analytics(orgId, startDate, endDate, teacherId),
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_org_analytics', {
                p_org_id: orgId,
                p_start_date: startDate,
                p_end_date: endDate,
                p_teacher_id: teacherId || null
            });
            if (error) throw error;
            return data;
        },
        enabled: !!orgId && !!startDate && !!endDate,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
/**
 * Assign a student to a group.
 */
export function useAssignStudentToGroup() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ studentId, groupId, orgId }: { studentId: string; groupId: string; orgId: string }) => {
            const { error } = await supabase
                .from('group_students')
                .upsert({
                    student_id: studentId,
                    group_id: groupId,
                    org_id: orgId
                }, { onConflict: 'student_id,group_id' });

            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.students(variables.groupId) });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.group(variables.groupId) });
            // Also invalidate general students list if needed
            queryClient.invalidateQueries({ queryKey: ['students'] });
        },
    });
}
