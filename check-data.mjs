import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rajinkobqhkomrfiusom.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhamlua29icWhrb21yZml1c29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NDkzNzUsImV4cCI6MjA4MzQyNTM3NX0.ftOkI_cYyOaWxNHbwEpA6hH3loCn0Cm-yzlp3HM7bgM'
);

async function checkData() {
  // Check activity types
  const { data: types, error: typesError } = await supabase
    .from('activity_types')
    .select('id, name, user_id')
    .limit(20);

  console.log('Activity types:', types?.length || 0);
  if (types) {
    types.forEach(t => console.log(' -', t.name, '(user:', t.user_id?.substring(0, 8) + '...)'));
  }
  if (typesError) console.log('Error:', typesError);

  // Check users
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  if (users) {
    console.log('\nUsers:', users.length);
  }
}

checkData();
