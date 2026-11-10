let files = {};

self.addEventListener('install', e => {
    console.log("SW: Installed");
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    console.log("SW: Activated and Claiming Clients");
    e.waitUntil(self.clients.claim());
});

// Receive virtual file mapping from main code.html
self.addEventListener('message', e => {
    if (e.data && e.data.type === 'SET_FILES') {
        files = e.data.files || {};
        console.log("SW: Received", Object.keys(files).length, "files for virtual file system.");
    }
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    
    // Intercept virtual file paths routed through /_vfs/
    if (url.pathname.includes('/_vfs/')) {
        const parts = url.pathname.split('/_vfs/');
        let path = parts[parts.length - 1];

        // Decode URL components in case paths contain spaces or encoded symbols
        try {
            path = decodeURIComponent(path);
        } catch (err) {
            // Keep fallback path if URI decoding fails
        }

        // Notify client logs of SW file requests
        e.waitUntil(
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'FETCH_LOG',
                        path: path,
                        success: !!files[path]
                    });
                });
            })
        );

        if (files[path]) {
            const blobUrl = files[path];
            const ext = path.split('.').pop().toLowerCase();

            const mimeTypes = {
                'html': 'text/html', 
                'htm': 'text/html',
                'js': 'application/javascript', 
                'css': 'text/css',
                'json': 'application/json', 
                'png': 'image/png', 
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'svg': 'image/svg+xml',
                'ogg': 'audio/ogg', 
                'mp3': 'audio/mpeg', 
                'wav': 'audio/wav',
                'xml': 'application/xml', 
                'txt': 'text/plain',
                'wasm': 'application/wasm'
            };

            const contentType = mimeTypes[ext] || 'application/octet-stream';

            // Fetch Blob and re-serve with necessary execution headers
            e.respondWith(
                fetch(blobUrl)
                    .then(response => {
                        return new Response(response.body, {
                            status: 200,
                            statusText: 'OK',
                            headers: { 
                                'Content-Type': contentType, 
                                'Access-Control-Allow-Origin': '*' 
                            }
                        });
                    })
                    .catch(err => {
                        console.error("SW: Failed to stream virtual file blob:", err);
                        return new Response("Virtual File Transfer Failed", { status: 500 });
                    })
            );
        } else {
            console.warn("SW: File not found in virtual filesystem map:", path);
            e.respondWith(new Response("File Not Found in Virtual ZIP FS", { status: 404 }));
        }
    }
});