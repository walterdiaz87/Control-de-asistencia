-- Migration: Analytics Helpers & Updates

-- 1. Updates to Sessions & Records for Edit Mode
-- Ensure sessions are unique per group/date
ALTER TABLE public.sessions 
ADD CONSTRAINT unique_session_group_date UNIQUE (group_id, date);

-- Add tracking columns
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

ALTER TABLE public.attendance_records
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- 2. Analytics Functions

-- Function: Get Group Stats
CREATE OR REPLACE FUNCTION get_group_stats(
  p_group_id UUID, 
  p_start_date DATE, 
  p_end_date DATE
) 
RETURNS TABLE (
  total_sessions BIGINT,
  avg_attendance NUMERIC,
  total_present BIGINT,
  total_absent BIGINT,
  total_late BIGINT,
  total_justified BIGINT
) AS $$
DECLARE
  v_total_records BIGINT;
BEGIN
  RETURN QUERY
  WITH session_stats AS (
    SELECT 
      s.id,
      COUNT(ar.id) as session_records,
      COUNT(ar.id) FILTER (WHERE ar.status = 'present') as present,
      COUNT(ar.id) FILTER (WHERE ar.status = 'absent') as absent,
      COUNT(ar.id) FILTER (WHERE ar.status = 'late') as late,
      COUNT(ar.id) FILTER (WHERE ar.status = 'justified') as justified
    FROM sessions s
    JOIN attendance_records ar ON s.id = ar.session_id
    WHERE s.group_id = p_group_id
    AND s.date BETWEEN p_start_date AND p_end_date
    GROUP BY s.id
  )
  SELECT
    COUNT(s.id) as total_sessions,
    CASE 
      WHEN SUM(s.session_records) > 0 THEN 
        ROUND((SUM(s.present)::NUMERIC / SUM(s.session_records)::NUMERIC) * 100, 2)
      ELSE 0 
    END as avg_attendance,
    COALESCE(SUM(s.present), 0) as total_present,
    COALESCE(SUM(s.absent), 0) as total_absent,
    COALESCE(SUM(s.late), 0) as total_late,
    COALESCE(SUM(s.justified), 0) as total_justified
  FROM session_stats s;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get Student Stats
CREATE OR REPLACE FUNCTION get_student_stats(
  p_student_id UUID,
  p_group_id UUID
)
RETURNS TABLE (
  total_sessions BIGINT,
  attendance_percentage NUMERIC,
  history JSON
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'present') as present
    FROM attendance_records ar
    JOIN sessions s ON ar.session_id = s.id
    WHERE ar.student_id = p_student_id
    AND s.group_id = p_group_id
  ),
  recent AS (
    SELECT json_agg(t) as records
    FROM (
      SELECT s.date, ar.status
      FROM attendance_records ar
      JOIN sessions s ON ar.session_id = s.id
      WHERE ar.student_id = p_student_id AND s.group_id = p_group_id
      ORDER BY s.date DESC
      LIMIT 10
    ) t
  )
  SELECT
    stats.total,
    CASE WHEN stats.total > 0 THEN 
      ROUND((stats.present::NUMERIC / stats.total::NUMERIC) * 100, 2)
    ELSE 0 END,
    COALESCE(recent.records, '[]'::json)
  FROM stats, recent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
