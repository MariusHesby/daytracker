import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rajinkobqhkomrfiusom.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhamlua29icWhrb21yZml1c29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NDkzNzUsImV4cCI6MjA4MzQyNTM3NX0.ftOkI_cYyOaWxNHbwEpA6hH3loCn0Cm-yzlp3HM7bgM'
);

async function deleteDuplicates() {
  // Get all activity types
  const { data: types, error } = await supabase
    .from('activity_types')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Found', types.length, 'activity types');

  // Group by name (case-insensitive)
  const byName = new Map();
  for (const t of types) {
    const key = t.name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, []);
    }
    byName.get(key).push(t);
  }

  // Find duplicates to delete (keep the first one)
  const toDelete = [];
  for (const [name, items] of byName) {
    if (items.length > 1) {
      console.log('Duplicate:', name, '- keeping first, deleting', items.length - 1);
      toDelete.push(...items.slice(1).map(i => i.id));
    }
  }

  if (toDelete.length === 0) {
    console.log('No duplicates found!');
    return;
  }

  console.log('Deleting', toDelete.length, 'duplicates...');

  // Delete duplicates
  const { error: deleteError } = await supabase
    .from('activity_types')
    .delete()
    .in('id', toDelete);

  if (deleteError) {
    console.error('Delete error:', deleteError);
  } else {
    console.log('Done! Deleted', toDelete.length, 'duplicates.');
  }
}

deleteDuplicates();
