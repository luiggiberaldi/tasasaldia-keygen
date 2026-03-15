import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL + '/rest/v1/licenses?device_id=eq.PDA-700564BC';
const urlDemos = process.env.VITE_SUPABASE_URL + '/rest/v1/demos?device_id=eq.PDA-700564BC';

const headers = {
    'apikey': process.env.VITE_SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + process.env.VITE_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
};

async function check() {
    try {
        console.log('Checking licenses...');
        const r1 = await fetch(url, { headers });
        const d1 = await r1.json();
        console.log('Licenses:', d1);
        
        console.log('Checking demos...');
        const r2 = await fetch(urlDemos, { headers });
        const d2 = await r2.json();
        console.log('Demos:', d2);
    } catch (e) {
        console.error('Error fetching', e);
    }
}

check();
