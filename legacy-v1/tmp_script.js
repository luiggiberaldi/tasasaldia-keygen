
        const _APP_VERSION = '1.0.3';
        // Cliente Supabase único: usa 'db' definido en el script principal (línea 528)

        // --- PWA INSTALLATION LOGIC ---
        let deferredPrompt;
        const installBtn = document.getElementById('installPwaBtn');

        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            deferredPrompt = e;
            // Update UI to notify the user they can add to home screen
            installBtn.style.display = 'flex';
            installBtn.classList.remove('hidden');
        });

        installBtn.addEventListener('click', async () => {
            // hide our user interface that shows our A2HS button
            installBtn.style.display = 'none';
            installBtn.classList.add('hidden');
            // Show the prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            // We've used the prompt, and can't use it again, throw it away
            deferredPrompt = null;
        });

        window.addEventListener('appinstalled', () => {
            // Hide the app-provided install promotion
            installBtn.style.display = 'none';
            installBtn.classList.add('hidden');
            // Clear the deferredPrompt so it can be garbage collected
            deferredPrompt = null;
            console.log('PWA was installed');
        });

        // Registrar Service Worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => console.log('SW ok', reg.scope))
                    .catch(err => console.log('SW error', err));
            });
        }

    