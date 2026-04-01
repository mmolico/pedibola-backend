const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Sites permitidos
const ALLOWED_SITES = {
    'abola': 'https://www.abola.pt',
    'ojogo': 'https://www.ojogo.pt',
    'record': 'https://www.record.pt',
    'marca': 'https://www.marca.com',
    'mundodeportivo': 'https://www.mundodeportivo.com',
    'as': 'https://as.com'
};

// Endpoint de proxy - SIMPLES E FUNCIONAL
app.get('/proxy/:site', async (req, res) => {
    const { site } = req.params;
    const targetUrl = ALLOWED_SITES[site];

    if (!targetUrl) {
        return res.status(400).send('Site não permitido');
    }

    try {
        console.log(`Fetching: ${targetUrl}`);
        
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8,es;q=0.7',
                'Cache-Control': 'no-cache'
            },
            redirect: 'follow'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        let html = await response.text();
        const baseUrl = new URL(targetUrl);

        // TRANSFORMAÇÃO SIMPLES DE URLs
        // Transformar URLs relativas em absolutas para ASSETS (CSS, JS, imagens)
        html = html.replace(/src="\/([^"]*)"/g, `src="${baseUrl.origin}/$1"`);
        html = html.replace(/src='\/([^']*)'/g, `src='${baseUrl.origin}/$1'`);
        html = html.replace(/href="\/([^"]*\.css[^"]*)"/g, `href="${baseUrl.origin}/$1"`);
        html = html.replace(/href='\/([^']*\.css[^']*)'/g, `href='${baseUrl.origin}/$1'`);
        
        // data-src para lazy loading
        html = html.replace(/data-src="\/([^"]*)"/g, `data-src="${baseUrl.origin}/$1"`);
        html = html.replace(/data-lazy-src="\/([^"]*)"/g, `data-lazy-src="${baseUrl.origin}/$1"`);
        
        // srcset para imagens responsivas
        html = html.replace(/srcset="\/([^"]*)"/g, `srcset="${baseUrl.origin}/$1"`);
        
        // Adicionar base tag
        html = html.replace('<head>', `<head><base href="${targetUrl}/">`);

        // CSS FIXES MÍNIMOS - SÓ O ESSENCIAL
        const cssFixesMinimal = `
            <style id="pedibola-minimal-fixes">
                /* Garantir scroll funciona */
                html, body {
                    overflow-y: auto !important;
                    scroll-behavior: auto !important;
                }
                
                /* Esconder ads óbvios */
                .ad-container,
                [id*="google_ads"],
                iframe[src*="doubleclick"],
                iframe[src*="googlesyndication"] {
                    display: none !important;
                }
            </style>
        `;
        
        html = html.replace('</head>', `${cssFixesMinimal}</head>`);

        // APENAS para O Jogo - prevenir scroll automático
        if (site === 'ojogo') {
            const scrollFix = `
                <script>
                    (function() {
                        let userScrolled = false;
                        window.addEventListener('wheel', () => { userScrolled = true; }, { passive: true });
                        window.addEventListener('touchmove', () => { userScrolled = true; }, { passive: true });
                        
                        const origScrollTo = window.scrollTo;
                        window.scrollTo = function(...args) {
                            if (userScrolled) origScrollTo.apply(this, args);
                        };
                        
                        setTimeout(() => { userScrolled = true; }, 2000);
                    })();
                </script>
            `;
            html = html.replace('</body>', `${scrollFix}</body>`);
        }

        // Headers corretos
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Content-Security-Policy', '');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        res.send(html);
        
    } catch (error) {
        console.error(`Erro ao fazer proxy de ${site}:`, error.message);
        res.status(500).send(`
            <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: #f5f5f5;
                        }
                        .error-box {
                            background: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                            text-align: center;
                            max-width: 500px;
                        }
                        h1 { color: #e74c3c; margin: 0 0 20px 0; }
                        p { color: #7f8c8d; margin: 10px 0; }
                        a { 
                            display: inline-block;
                            margin-top: 20px;
                            padding: 10px 20px;
                            background: #3498db;
                            color: white;
                            text-decoration: none;
                            border-radius: 5px;
                        }
                    </style>
                </head>
                <body>
                    <div class="error-box">
                        <h1>⚠️ Erro ao carregar</h1>
                        <p><strong>${site}</strong></p>
                        <p>${error.message}</p>
                        <a href="${targetUrl}" target="_blank">Abrir site original →</a>
                    </div>
                </body>
            </html>
        `);
    }
});

// Health check
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    }
                    .status-box {
                        background: white;
                        padding: 50px;
                        border-radius: 15px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                        text-align: center;
                    }
                    h1 { color: #27ae60; margin: 0 0 20px 0; font-size: 36px; }
                </style>
            </head>
            <body>
                <div class="status-box">
                    <h1>✅ PEDIBOLA Proxy Server</h1>
                    <p>Servidor ativo e funcionando!</p>
                </div>
            </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`🚀 PEDIBOLA Proxy Server na porta ${PORT}`);
});
