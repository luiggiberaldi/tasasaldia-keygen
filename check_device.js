const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDevice() {
    const { data, error } = await supabase.from('licenses').select('*').eq('device_id', 'PDA-700564BC');
    console.log('Licenses:', data, error);
    
    const { data: d2, error: e2 } = await supabase.from('demos').select('*').eq('device_id', 'PDA-700564BC');
    console.log('Demos:', d2, e2);
}

checkDevice();
