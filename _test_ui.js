import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jjbzevntreoxpuofgkyi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqYnpldm50cmVveHB1b2Zna3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjE4MDIsImV4cCI6MjA4NzAzNzgwMn0.wyyISEMsTEl__QgeckSVWgX1isif8iZOblO8GNso-TQ'
);

(async () => {
  console.log('Making TASAS-J0PZ permanent first...');
  await supabase.rpc('admin_make_permanent_secure', {
    p_device_id: 'TASAS-J0PZ',
    p_product_id: 'tasas',
    p_code: 'TESTCODE'
  });

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  await page.goto('http://localhost:5173');
  
  // Try to bypass PIN by setting localstorage
  await page.evaluate(() => {
    localStorage.setItem('em_auth', '794848');
  });
  await page.reload();
  
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Looking for revoke button...');
  const buttons = await page.$$('button');
  let revokeBtn = null;
  for (const btn of buttons) {
     const text = await page.evaluate(el => el.textContent, btn);
     if (text.toLowerCase().includes('revocar')) {
        revokeBtn = btn;
        break;
     }
  }
  
  if (revokeBtn) {
     console.log('Clicking revoke...');
     await revokeBtn.click();
     await new Promise(r => setTimeout(r, 500));
     
     console.log('Looking for confirm button...');
     const allBtns = await page.$$('button');
     let confirmBtn = null;
     for (const btn of allBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.toLowerCase().includes('confirmar')) {
           confirmBtn = btn;
           break;
        }
     }
     
     if (confirmBtn) {
       console.log('Clicking confirm FIRST TIME...');
       await confirmBtn.click();
       await new Promise(r => setTimeout(r, 2000));
       
       // See if modal is still open and button still there?
       const finalBtns = await page.$$('button');
       let stillThere = false;
       for (const btn of finalBtns) {
          const text = await page.evaluate(el => el.textContent, btn);
          if (text.toLowerCase().includes('confirmar')) {
             stillThere = true;
             console.log('Wait... Confirmar button is still there??');
          }
       }
       if (!stillThere) {
         console.log('Modal closed properly after first click.');
       }
     }
  } else {
     console.log('No revoke button found.');
  }
  
  await browser.close();
})();
