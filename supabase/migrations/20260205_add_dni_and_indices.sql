-- # Migration: Add DNI and Performance Indices

-- 1. Update Students Table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS dni TEXT;

-- 2. Add Unique Constraint for DNI within Org
-- Note: We allow NULL DNIs, but if present, they must be unique per Org.
ALTER TABLE public.students
ADD CONSTRAINT unique_org_dni UNIQUE (org_id, dni);

-- 3. Add Performance Indices for Dashboards
CREATE INDEX IF NOT EXISTS idx_sessions_group_date ON public.sessions(group_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_student ON public.attendance_records(session_id, student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON public.attendance_records(student_id);

-- 4. RLS Master Fix (Repeat to ensure consistency)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.organizations;
CREATE POLICY "Enable insert for authenticated users" ON public.organizations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.organizations;
CREATE POLICY "Enable select for authenticated users" ON public.organizations
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for own membership" ON public.organization_members;
CREATE POLICY "Enable insert for own membership" ON public.organization_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Enable select for own membership" ON public.organization_members;
CREATE POLICY "Enable select for own membership" ON public.organization_members
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.academic_years;
CREATE POLICY "Enable all for authenticated users" ON public.academic_years
    FOR ALL USING (auth.role() = 'authenticated');
