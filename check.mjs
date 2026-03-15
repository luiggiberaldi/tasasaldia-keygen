import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDevice() {
    console.log("Checking DB for PDA-700564BC...");
    const { data, error } = await supabase.from('licenses').select('*').eq('device_id', 'PDA-700564BC');
    console.log('Licenses result:', data, error);
    
    if (data && data.length > 0) {
        console.log("FOUND IN LICENSES!");
    } else {
        console.log("NOT found in licenses");
    }

    const { data: d2, error: e2 } = await supabase.from('demos').select('*').eq('device_id', 'PDA-700564BC');
    console.log('Demos result:', d2, e2);
    if (d2 && d2.length > 0) {
        console.log("FOUND IN DEMOS!");
    } else {
        console.log("NOT found in demos");
    }
}

checkDevice();
