
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://supabase.walterdiaz87.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzA1MjI3ODcsImV4cCI6MjA4NTg4Mjc4N30.0zjOBlZxi-DkWUFTWcFKOIo5KqnvjLE7JIXqE9SMmeA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
    console.log('--- Starting Student Cleanup ---');

    // 1. Fetch all students
    const { data: students, error: fetchErr } = await supabase.from('students').select('*');
    if (fetchErr) throw fetchErr;

    // 2. Identify duplicates by normalized Name
    const groups = {};
    students.forEach(s => {
        const key = `${s.first_name.toLowerCase().trim()} ${s.last_name.toLowerCase().trim()}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    });

    for (const key in groups) {
        const list = groups[key];
        if (list.length > 1) {
            console.log(`\nFound ${list.length} records for: ${key.toUpperCase()}`);

            // Keep the first one, merge others into it
            const master = list[0];
            const others = list.slice(1);
            const otherIds = others.map(o => o.id);

            console.log(`Master ID: ${master.id}`);
            console.log(`Merging IDs: ${otherIds.join(', ')}`);

            // A. Remap group_students
            const { error: gsErr } = await supabase
                .from('group_students')
                .update({ student_id: master.id })
                .in('student_id', otherIds);

            if (gsErr) console.error('Error remapping group_students:', gsErr.message);

            // B. Remap attendance_records
            const { error: attErr } = await supabase
                .from('attendance_records')
                .update({ student_id: master.id })
                .in('student_id', otherIds);

            if (attErr) console.error('Error remapping attendance:', attErr.message);

            // C. Delete duplicates
            const { error: delErr } = await supabase
                .from('students')
                .delete()
                .in('id', otherIds);

            if (delErr) {
                console.error(`Error deleting duplicates for ${key}:`, delErr.message);
                console.log('Note: Deletion might fail if there are other foreign keys. Check schema.');
            } else {
                console.log(`Successfully merged ${key}.`);
            }
        }
    }

    console.log('\n--- Cleanup Finished ---');
}

cleanup().catch(console.error);
