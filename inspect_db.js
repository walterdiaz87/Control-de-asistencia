
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://supabase.walterdiaz87.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzA1MjI3ODcsImV4cCI6MjA4NTg4Mjc4N30.0zjOBlZxi-DkWUFTWcFKOIo5KqnvjLE7JIXqE9SMmeA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    const marianelaId = '3ebac63d-883f-4788-9c6e-169b0f02ab9c';

    // 1. Correct Org for Marianela
    const { data: mem } = await supabase
        .from('organization_members')
        .select('org_id, organizations(name)')
        .eq('user_id', marianelaId)
        .single();

    console.log(`Marianela's Real Org: ${mem?.organizations?.name} (${mem?.org_id})`);

    // 2. Groups where Marianela is teacher
    const { data: teacherGroups } = await supabase
        .from('groups')
        .select('*, organizations(name)')
        .eq('teacher_id', marianelaId);

    console.log('\nGroups where Marianela is Teacher:');
    teacherGroups?.forEach(g => {
        console.log(`- ID: ${g.id}, Name: ${g.name}, Org: ${g.organizations?.name} (${g.org_id})`);
    });

    // 3. Groups in Marianela's Real Org (regardless of teacher)
    const { data: orgGroups } = await supabase
        .from('groups')
        .select('*, organizations(name)')
        .eq('org_id', mem?.org_id);

    console.log('\nGroups in Marianela\'s Real Org:');
    orgGroups?.forEach(g => {
        console.log(`- ID: ${g.id}, Name: ${g.name}`);
    });
}

inspect();
