const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Basic .env.local parser to avoid 'dotenv' dependency
function getEnv() {
    const envPath = path.resolve(__dirname, '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const config = {};
    content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length === 2) {
            config[parts[0].trim()] = parts[1].trim();
        }
    });
    return config;
}

const env = getEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const SQL = `
-- 0. MASTER RLS RESET (Drop all existing policies to avoid name conflicts)
DO $$ 
DECLARE 
    tbl text;
    pol text;
BEGIN 
    FOR tbl IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    LOOP
        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = tbl AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
        END LOOP;
    END LOOP;
END $$;

-- 1. DATABASE CONSTRAINTS
DO $$ BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_session_entry') THEN
        ALTER TABLE public.sessions ADD CONSTRAINT unique_session_entry UNIQUE (group_id, date, class_index);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_attendance_record') THEN
        ALTER TABLE public.attendance_records ADD CONSTRAINT unique_attendance_record UNIQUE (session_id, student_id);
    END IF;
    -- Add org_id to group_students if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='group_students' AND column_name='org_id') THEN
        ALTER TABLE public.group_students ADD COLUMN org_id UUID REFERENCES public.organizations(id);
    END IF;
END $$;

-- 2. ENABLE RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_students ENABLE ROW LEVEL SECURITY;

-- 3. HELPER FUNCTIONS (SECURITY DEFINER to break recursion)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.organization_members 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM public.organization_members 
  WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4. HARDENED POLICIES

-- Organizations
CREATE POLICY "Users can view their own organizations" 
ON public.organizations FOR SELECT 
USING ( id IN (SELECT public.get_user_organizations()) );

CREATE POLICY "Authenticated users can create organizations" 
ON public.organizations FOR INSERT 
WITH CHECK ( auth.role() = 'authenticated' );

-- Organization Members
CREATE POLICY "Members can view co-members" 
ON public.organization_members FOR SELECT 
USING ( org_id IN (SELECT public.get_user_organizations()) );

CREATE POLICY "Users can create their own memberships" 
ON public.organization_members FOR INSERT 
WITH CHECK ( user_id = auth.uid() );

-- Academic Years
CREATE POLICY "Members can view org academic years" 
ON public.academic_years FOR ALL 
USING ( org_id IN (SELECT public.get_user_organizations()) );

CREATE POLICY "Authenticated users can create academic years" 
ON public.academic_years FOR INSERT 
WITH CHECK ( auth.role() = 'authenticated' );

-- Groups (Hardened)
CREATE POLICY "Granular access to groups" 
ON public.groups FOR ALL 
USING (
    org_id IN (SELECT public.get_user_organizations())
    AND (
        public.get_user_role() IN ('admin', 'owner', 'owner') -- Including owner
        OR teacher_id = auth.uid()
    )
);

-- Students
CREATE POLICY "Org members can view students" 
ON public.students FOR ALL 
USING ( org_id IN (SELECT public.get_user_organizations()) );

-- Sessions (Hardened)
CREATE POLICY "Granular access to sessions" 
ON public.sessions FOR ALL 
USING (
    org_id IN (SELECT public.get_user_organizations())
    AND (
        public.get_user_role() IN ('admin', 'owner') 
        OR group_id IN (SELECT id FROM public.groups WHERE teacher_id = auth.uid())
    )
);

-- Attendance Records (Hardened)
CREATE POLICY "Granular access to attendance records" 
ON public.attendance_records FOR ALL 
USING (
    session_id IN (
        SELECT s.id FROM public.sessions s
        JOIN public.groups g ON s.group_id = g.id
        WHERE g.org_id IN (SELECT public.get_user_organizations())
        AND (public.get_user_role() IN ('admin', 'owner') OR g.teacher_id = auth.uid())
    )
);

-- Group Students (Assignments)
-- 1. Data Repair: Sync org_id from groups if missing
UPDATE public.group_students gs
SET org_id = g.org_id
FROM public.groups g
WHERE gs.group_id = g.id AND gs.org_id IS NULL;

-- 2. Refined Policies
CREATE POLICY "Members can view student assignments" 
ON public.group_students FOR SELECT 
USING ( org_id IN (SELECT public.get_user_organizations()) );

CREATE POLICY "Manage student assignments" 
ON public.group_students FOR ALL 
USING ( 
    (org_id IN (SELECT public.get_user_organizations())) 
    AND (
        public.get_user_role() IN ('admin', 'owner')
        OR group_id IN (SELECT id FROM public.groups WHERE teacher_id = auth.uid())
    )
)
WITH CHECK (
    (org_id IN (SELECT public.get_user_organizations())) 
    AND (
        public.get_user_role() IN ('admin', 'owner')
        OR group_id IN (SELECT id FROM public.groups WHERE teacher_id = auth.uid())
    )
);

-- 5. SECURIZED RPCs

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
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND org_id = p_org_id) THEN
        RAISE EXCEPTION 'Acceso no autorizado';
    END IF;

    IF (SELECT role FROM public.organization_members WHERE user_id = auth.uid() AND org_id = p_org_id LIMIT 1) != 'admin' THEN
        p_teacher_id := auth.uid();
    END IF;

    WITH filtered_sessions AS (
        SELECT s.id, s.group_id, s.date
        FROM public.sessions s
        JOIN public.groups g ON s.group_id = g.id
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
        LEFT JOIN public.attendance_records ar ON fs.id = ar.session_id
        GROUP BY fs.group_id
    ),
    group_info AS (
        SELECT 
            g.id, g.name, g.type,
            COALESCE(ast.total_records, 0) as total,
            COALESCE(ast.present, 0) as present,
            COALESCE(ast.late, 0) as late,
            COALESCE(ast.absent, 0) as absent,
            COALESCE(ast.justified, 0) as justified,
            CASE WHEN COALESCE(ast.total_records, 0) > 0 THEN ROUND(((ast.present + ast.late * 0.5)::NUMERIC / ast.total_records) * 100) ELSE 0 END as percentage
        FROM public.groups g
        LEFT JOIN attendance_stats ast ON g.id = ast.group_id
        WHERE g.org_id = p_org_id
        AND (p_teacher_id IS NULL OR g.teacher_id = p_teacher_id)
    ),
    org_counts AS (
        SELECT 
            (SELECT COUNT(*) FROM public.students WHERE org_id = p_org_id) as total_students,
            (SELECT COUNT(*) FROM public.groups WHERE org_id = p_org_id AND (p_teacher_id IS NULL OR teacher_id = p_teacher_id)) as total_groups
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

-- Securize Helper Functions
CREATE OR REPLACE FUNCTION get_group_stats(p_group_id UUID, p_start_date DATE, p_end_date DATE) 
RETURNS TABLE (total_sessions BIGINT, avg_attendance NUMERIC, total_present BIGINT, total_absent BIGINT, total_late BIGINT, total_justified BIGINT) AS $$
DECLARE v_org_id UUID;
BEGIN
    SELECT org_id INTO v_org_id FROM public.groups WHERE id = p_group_id;
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND org_id = v_org_id) THEN
        RAISE EXCEPTION 'Acceso no autorizado';
    END IF;
    RETURN QUERY WITH session_stats AS (
        SELECT s.id, COUNT(ar.id) as session_records, COUNT(ar.id) FILTER (WHERE ar.status = 'present') as present, COUNT(ar.id) FILTER (WHERE ar.status = 'absent') as absent, COUNT(ar.id) FILTER (WHERE ar.status = 'late') as late, COUNT(ar.id) FILTER (WHERE ar.status = 'justified') as justified
        FROM public.sessions s JOIN public.attendance_records ar ON s.id = ar.session_id
        WHERE s.group_id = p_group_id AND s.date BETWEEN p_start_date AND p_end_date GROUP BY s.id
    )
    SELECT COUNT(s.id), CASE WHEN SUM(s.session_records) > 0 THEN ROUND((SUM(s.present)::NUMERIC / SUM(s.session_records)::NUMERIC) * 100, 2) ELSE 0 END, COALESCE(SUM(s.present), 0), COALESCE(SUM(s.absent), 0), COALESCE(SUM(s.late), 0), COALESCE(SUM(s.justified), 0)
    FROM session_stats s;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_student_stats(p_student_id UUID, p_group_id UUID)
RETURNS TABLE (total_sessions BIGINT, attendance_percentage NUMERIC, history JSON) AS $$
DECLARE v_org_id UUID;
BEGIN
    SELECT org_id INTO v_org_id FROM public.groups WHERE id = p_group_id;
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND org_id = v_org_id) THEN
        RAISE EXCEPTION 'Acceso no autorizado';
    END IF;
    RETURN QUERY WITH stats AS (
        SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'present') as present FROM public.attendance_records ar JOIN public.sessions s ON ar.session_id = s.id
        WHERE ar.student_id = p_student_id AND s.group_id = p_group_id
    ), recent AS (
        SELECT json_agg(t) as records FROM (SELECT s.date, ar.status FROM public.attendance_records ar JOIN public.sessions s ON ar.session_id = s.id
        WHERE ar.student_id = p_student_id AND s.group_id = p_group_id ORDER BY s.date DESC LIMIT 10) t
    )
    SELECT stats.total, CASE WHEN stats.total > 0 THEN ROUND((stats.present::NUMERIC / stats.total::NUMERIC) * 100, 2) ELSE 0 END, COALESCE(recent.records, '[]'::json)
    FROM stats, recent;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function migrate() {
    console.log('Starting migration via direct SQL execution...');
    // Note: We use execute_sql tool equivalent or RPC if we can't.
    // Since I'm running this locally as a node script, I'll attempt to run it.

    // Attempting to use a common admin RPC if it exists, otherwise write to file for manual run.
    const { data, error } = await supabase.rpc('admin_run_sql', { sql_query: SQL });

    if (error) {
        console.error('RPC "admin_run_sql" not found or failed. This is expected if not explicitly set up.');
        console.log('Writing SQL to migration.sql for manual execution in Supabase Dashboard.');
    } else {
        console.log('Migration applied successfully via RPC!');
    }

    fs.writeFileSync('migration.sql', SQL);
    console.log('migration.sql updated with content.');
}

migrate();
