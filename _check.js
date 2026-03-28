import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjbzevntreoxpuofgkyi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqYnpldm50cmVveHB1b2Zna3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjE4MDIsImV4cCI6MjA4NzAzNzgwMn0.wyyISEMsTEl__QgeckSVWgX1isif8iZOblO8GNso-TQ'
);

(async () => {
  const { data, error } = await supabase.from('licenses').select('*').limit(1);
  console.log('Test select:', error ? error : 'OK');
  
  // To see function source, I need postgres access or use the REST API if it helps.
  // Actually, I can check the local SQL files.
})();
