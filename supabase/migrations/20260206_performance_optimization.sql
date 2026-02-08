-- # Migration: Performance and Consistency Optimizations
-- Objective: Reduce Supabase queries and payload by using indices and RPCs.

-- 1. Optimized Indices for Lookups
CREATE INDEX IF NOT EXISTS idx_sessions_group_id_date ON public.sessions (group_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_id_student_id ON public.attendance_records (session_id, student_id);
CREATE INDEX IF NOT EXISTS idx_group_students_lookup ON public.group_students (group_id, student_id);

-- 2. Consistency Constraints
-- Ensure no duplicate records for the same student in the same session
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_attendance_record') THEN
        ALTER TABLE public.attendance_records ADD CONSTRAINT unique_attendance_record UNIQUE (session_id, student_id);
    END IF;
END $$;

-- 3. Optimized Aggregation RPC
-- This RPC calculates daily statistics in ONE query on the server.
-- Returns: total, present, absent, justified, unjustified
CREATE OR REPLACE FUNCTION get_daily_attendance_summary(
    p_group_id UUID,
    p_date DATE
)
RETURNS TABLE (
    total_students BIGINT,
    present_count BIGINT,
    absent_count BIGINT,
    justified_count BIGINT,
    unjustified_count BIGINT,
    session_id UUID
) AS $$
BEGIN
    RETURN QUERY
    WITH target_session AS (
        SELECT id FROM public.sessions 
        WHERE group_id = p_group_id AND date = p_date
        LIMIT 1
    )
    SELECT 
        COUNT(ar.id)::BIGINT as total_students,
        COUNT(ar.id) FILTER (WHERE ar.status = 'present')::BIGINT as present_count,
        COUNT(ar.id) FILTER (WHERE ar.status = 'absent')::BIGINT as absent_count,
        COUNT(ar.id) FILTER (WHERE ar.status = 'absent' AND ar.justification = 'justified')::BIGINT as justified_count,
        COUNT(ar.id) FILTER (WHERE ar.status = 'absent' AND ar.justification != 'justified')::BIGINT as unjustified_count,
        (SELECT id FROM target_session) as session_id
    FROM public.attendance_records ar
    WHERE ar.session_id = (SELECT id FROM target_session);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
