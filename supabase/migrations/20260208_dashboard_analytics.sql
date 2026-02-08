-- Migration: Dashboard Analytics RPC
-- Returns global and per-group statistics in a single call

CREATE OR REPLACE FUNCTION get_org_analytics(
    p_org_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_teacher_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH filtered_sessions AS (
        SELECT s.id, s.group_id, s.date
        FROM sessions s
        JOIN groups g ON s.group_id = g.id
        WHERE s.org_id = p_org_id
        AND s.date BETWEEN p_start_date AND p_end_date
        AND (p_teacher_id IS NULL OR g.teacher_id = p_teacher_id)
    ),
    attendance_stats AS (
        SELECT 
            fs.group_id,
            COUNT(ar.id) as total_records,
            COUNT(ar.id) FILTER (WHERE ar.status = 'present') as present,
            COUNT(ar.id) FILTER (WHERE ar.status = 'late') as late,
            COUNT(ar.id) FILTER (WHERE ar.status = 'absent') as absent,
            COUNT(ar.id) FILTER (WHERE ar.status = 'justified') as justified
        FROM filtered_sessions fs
        LEFT JOIN attendance_records ar ON fs.id = ar.session_id
        GROUP BY fs.group_id
    ),
    group_info AS (
        SELECT 
            g.id,
            g.name,
            g.type,
            COALESCE(ast.total_records, 0) as total,
            COALESCE(ast.present, 0) as present,
            COALESCE(ast.late, 0) as late,
            COALESCE(ast.absent, 0) as absent,
            COALESCE(ast.justified, 0) as justified,
            CASE 
                WHEN COALESCE(ast.total_records, 0) > 0 THEN 
                    ROUND(((ast.present + ast.late * 0.5)::NUMERIC / ast.total_records) * 100)
                ELSE 0 
            END as percentage
        FROM groups g
        LEFT JOIN attendance_stats ast ON g.id = ast.group_id
        WHERE g.org_id = p_org_id
        AND (p_teacher_id IS NULL OR g.teacher_id = p_teacher_id)
    ),
    org_counts AS (
        SELECT 
            (SELECT COUNT(*) FROM students WHERE org_id = p_org_id) as total_students,
            (SELECT COUNT(*) FROM groups WHERE org_id = p_org_id AND (p_teacher_id IS NULL OR teacher_id = p_teacher_id)) as total_groups
    )
    SELECT jsonb_build_object(
        'global', jsonb_build_object(
            'total_students', oc.total_students,
            'total_groups', oc.total_groups,
            'avg_percentage', (SELECT ROUND(AVG(percentage)) FROM group_info WHERE total > 0),
            'present', (SELECT SUM(present) FROM group_info),
            'absent', (SELECT SUM(absent) FROM group_info),
            'late', (SELECT SUM(late) FROM group_info),
            'justified', (SELECT SUM(justified) FROM group_info)
        ),
        'groups', (SELECT jsonb_agg(gi) FROM group_info gi)
    ) INTO v_result
    FROM org_counts oc;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
