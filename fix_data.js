
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://supabase.walterdiaz87.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzA1MjI3ODcsImV4cCI6MjA4NTg4Mjc4N30.0zjOBlZxi-DkWUFTWcFKOIo5KqnvjLE7JIXqE9SMmeA';

const supabase = createClient(supabaseUrl, supabaseKey);

const CORRECT_ORG_ID = 'dd61632a-09fa-4123-a656-bb9dccdc468a';
const AFFECTED_GROUPS = ['66a3723f-bec0-4c6d-8c28-08e36aac0e36', '6804a6e2-d22a-453a-bd70-6789c8f82f31'];

async function fix() {
    console.log('--- Starting Data Fix ---');

    // 1. Create/Ensure Academic Year 2026 in Correct Org
    let ayId;
    const { data: existingAY } = await supabase
        .from('academic_years')
        .select('id')
        .eq('org_id', CORRECT_ORG_ID)
        .eq('year', 2026)
        .maybeSingle();

    if (existingAY) {
        ayId = existingAY.id;
        console.log('Using existing AY:', ayId);
    } else {
        const { data: newAY, error: ayError } = await supabase
            .from('academic_years')
            .insert({ org_id: CORRECT_ORG_ID, year: 2026, is_active: true })
            .select()
            .single();
        if (ayError) throw ayError;
        ayId = newAY.id;
        console.log('Created new AY:', ayId);
    }

    // 2. Fix Groups
    const { error: groupError } = await supabase
        .from('groups')
        .update({ org_id: CORRECT_ORG_ID, academic_year_id: ayId })
        .in('id', AFFECTED_GROUPS);
    if (groupError) console.error('Error updating groups:', groupError);
    else console.log('Groups updated.');

    // 3. Fix Sessions
    const { error: sessError } = await supabase
        .from('sessions')
        .update({ org_id: CORRECT_ORG_ID })
        .in('group_id', AFFECTED_GROUPS);
    if (sessError) console.error('Error updating sessions:', sessError);
    else console.log('Sessions updated.');

    // 4. Fix Students (linked via group_students)
    const { data: gs } = await supabase
        .from('group_students')
        .select('student_id')
        .in('group_id', AFFECTED_GROUPS);

    const studentIds = gs.map(x => x.student_id);
    if (studentIds.length > 0) {
        const { error: studError } = await supabase
            .from('students')
            .update({ org_id: CORRECT_ORG_ID })
            .in('id', studentIds);
        if (studError) console.error('Error updating students:', studError);
        else console.log('Students updated.');
    }

    // 5. Fix Attendance Records (linked via sessions)
    // First get sessions for these groups
    const { data: sessions } = await supabase.from('sessions').select('id').in('group_id', AFFECTED_GROUPS);
    const sessionIds = sessions.map(s => s.id);
    if (sessionIds.length > 0) {
        const { error: attError } = await supabase
            .from('attendance_records')
            .update({ org_id: CORRECT_ORG_ID })
            .in('session_id', sessionIds);
        if (attError) console.error('Error updating attendance records:', attError);
        else console.log('Attendance records updated.');
    }

    console.log('--- Fix Completed ---');
}

fix().catch(console.error);
