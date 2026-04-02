/**
 * PEDIBOLA - Proxy Server
 * Versão: v0.1 Beta
 * Data: 30 Março 2025
 * 
 * CHANGELOG v0.1 Beta:
 * - Abordagem profissional com tratamentos específicos por site
 * - A Bola: tratamento mínimo (preserva funcionamento)
 * - O Jogo: CSS agressivo + JS custom (remove ads, fix scroll)
 * - Record: reescrita de links + navegação interna
 * - Sites espanhóis: reescrita de links + navegação interna
 * - Suporte para ?url= parameter para navegação
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const ALLOWED_SITES = {
    'abola': 'https://www.abola.pt',
    'ojogo': 'https://www.ojogo.pt',
    'record': 'https://www.record.pt',
    'marca': 'https://www.marca.com',
    'mundodeportivo': 'https://www.mundodeportivo.com',
    'as': 'https://as.com'
};

// Endpoint de proxy com suporte para navegação interna
app.get('/proxy/:site', async (req, res) => {
    const { site } = req.params;
    let targetUrl = ALLOWED_SITES[site];

    if (!targetUrl) {
        return res.status(400).send('Site não permitido');
    }

    // Suporte para navegação interna (quando clicam em links)
    if (req.query.url) {
        const decodedUrl = decodeURIComponent(req.query.url);
        const baseUrl = new URL(targetUrl);
        targetUrl = `${baseUrl.origin}${decodedUrl}`;
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

        // ═══════════════════════════════════════════════════════════
        // TRANSFORMAÇÕES BASE (TODOS OS SITES)
        // ═══════════════════════════════════════════════════════════
        
        // Assets (CSS, JS, imagens) - manter absolutos
        html = html.replace(/src="\/([^"]*)"/g, `src="${baseUrl.origin}/$1"`);
        html = html.replace(/src='\/([^']*)'/g, `src='${baseUrl.origin}/$1'`);
        html = html.replace(/href="\/([^"]*\.css[^"]*)"/g, `href="${baseUrl.origin}/$1"`);
        html = html.replace(/data-src="\/([^"]*)"/g, `data-src="${baseUrl.origin}/$1"`);
        html = html.replace(/data-lazy-src="\/([^"]*)"/g, `data-lazy-src="${baseUrl.origin}/$1"`);
        html = html.replace(/srcset="\/([^"]*)"/g, `srcset="${baseUrl.origin}/$1"`);
        
        // Base tag
        html = html.replace('<head>', `<head><base href="${targetUrl}/" target="_self">`);

        // ═══════════════════════════════════════════════════════════
        // A BOLA - MÍNIMO (JÁ FUNCIONA BEM!)
        // ═══════════════════════════════════════════════════════════
        if (site === 'abola') {
            // CSS mínimo
            const css = `
                <style id="pedibola-abola">
                    html, body { overflow-y: auto !important; }
                </style>
            `;
            html = html.replace('</head>', `${css}</head>`);
        }

        // ═══════════════════════════════════════════════════════════
        // O JOGO - TRATAMENTO ESPECÍFICO PARA PUBLICIDADE E CONTEÚDO
        // ═══════════════════════════════════════════════════════════
        if (site === 'ojogo') {
            // Links internos passam pelo proxy
            html = html.replace(/href="\/([^"]*)"(?![^<]*\.css)/g, (match, path) => {
                if (path.includes('.css') || path.includes('.js')) {
                    return `href="${baseUrl.origin}/${path}"`;
                }
                return `href="/proxy/ojogo?url=${encodeURIComponent('/' + path)}"`;
            });

            const css = `
                <style id="pedibola-ojogo">
                    html, body {
                        overflow-y: auto !important;
                        scroll-behavior: auto !important;
                    }
                    
                    /* REMOVER PUBLICIDADE ESPECÍFICA DO O JOGO */
                    .ad-container,
                    .advertisement,
                    [class*="publicidade"],
                    [id*="publicidade"],
                    [class*="ad-top"],
                    [id*="ad-top"],
                    .header-ad,
                    .sticky-ad,
                    iframe[src*="doubleclick"],
                    iframe[src*="googlesyndication"],
                    div[data-ad-slot] {
                        display: none !important;
                        height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    /* Prevenir sticky headers que bloqueiam */
                    * {
                        position: relative !important;
                    }
                    
                    header, .header {
                        position: relative !important;
                        top: auto !important;
                    }
                </style>
            `;

            const js = `
                <script id="pedibola-ojogo-fix">
                    (function() {
                        // Prevenir scroll automático
                        let userScrolled = false;
                        
                        window.addEventListener('wheel', () => { userScrolled = true; }, { passive: true });
                        window.addEventListener('touchmove', () => { userScrolled = true; }, { passive: true });
                        
                        const origScrollTo = window.scrollTo;
                        window.scrollTo = function(...args) {
                            if (userScrolled) origScrollTo.apply(this, args);
                        };
                        
                        // Forçar carregamento de conteúdo lazy
                        window.addEventListener('load', () => {
                            userScrolled = true;
                            
                            // Trigger lazy loading
                            window.dispatchEvent(new Event('scroll'));
                            
                            // Remover overlays problemáticos
                            setTimeout(() => {
                                document.querySelectorAll('[class*="overlay"], [class*="modal"]').forEach(el => {
                                    if (el.style.position === 'fixed') el.remove();
                                });
                            }, 1000);
                        });
                        
                        console.log('PEDIBOLA: O Jogo optimized');
                    })();
                </script>
            `;

            html = html.replace('</head>', `${css}</head>`);
            html = html.replace('</body>', `${js}</body>`);
        }

        // ═══════════════════════════════════════════════════════════
        // RECORD - INTERCEPTAÇÃO DE LINKS
        // ═══════════════════════════════════════════════════════════
        if (site === 'record') {
            // Links internos passam pelo proxy
            html = html.replace(/href="\/([^"]*)"(?![^<]*\.css)/g, (match, path) => {
                if (path.includes('.css') || path.includes('.js')) {
                    return `href="${baseUrl.origin}/${path}"`;
                }
                return `href="/proxy/record?url=${encodeURIComponent('/' + path)}"`;
            });

            const css = `
                <style id="pedibola-record">
                    html, body { overflow-y: auto !important; }
                    .ad-container, iframe[src*="doubleclick"] { display: none !important; }
                </style>
            `;

            html = html.replace('</head>', `${css}</head>`);
        }

        // ═══════════════════════════════════════════════════════════
        // SITES ESPANHÓIS - INTERCEPTAÇÃO DE LINKS
        // ═══════════════════════════════════════════════════════════
        if (site === 'marca' || site === 'mundodeportivo' || site === 'as') {
            // Links internos passam pelo proxy
            html = html.replace(/href="\/([^"]*)"(?![^<]*\.css)/g, (match, path) => {
                if (path.includes('.css') || path.includes('.js')) {
                    return `href="${baseUrl.origin}/${path}"`;
                }
                return `href="/proxy/${site}?url=${encodeURIComponent('/' + path)}"`;
            });

            const css = `
                <style id="pedibola-es">
                    html, body { overflow-y: auto !important; }
                    .ad-container, iframe[src*="doubleclick"] { display: none !important; }
                </style>
            `;

            html = html.replace('</head>', `${css}</head>`);
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
                        }
                        h1 { color: #e74c3c; }
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
                        <h1>⚠️ Erro</h1>
                        <p><strong>${site}</strong></p>
                        <p>${error.message}</p>
                        <a href="${ALLOWED_SITES[site]}" target="_blank">Abrir original →</a>
                    </div>
                </body>
            </html>
        `);
    }
});

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 50px;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    .container {
                        background: white;
                        color: #2c3e50;
                        padding: 40px;
                        border-radius: 15px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                        max-width: 600px;
                        margin: 0 auto;
                    }
                    h1 { margin: 0 0 10px 0; color: #27ae60; }
                    .version { 
                        display: inline-block;
                        background: #e74c3c;
                        color: white;
                        padding: 5px 15px;
                        border-radius: 15px;
                        font-size: 14px;
                        margin: 10px 0 20px 0;
                    }
                    .status { color: #27ae60; font-weight: 600; }
                    .sites { 
                        text-align: left;
                        margin-top: 20px;
                        padding: 20px;
                        background: #f8f9fa;
                        border-radius: 8px;
                    }
                    .site-item { 
                        padding: 8px 0;
                        border-bottom: 1px solid #dee2e6;
                    }
                    .site-item:last-child { border-bottom: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>✅ PEDIBOLA Proxy Server</h1>
                    <div class="version">v0.1 Beta</div>
                    <p class="status">Servidor ativo e funcionando!</p>
                    <p style="font-size: 12px; color: #7f8c8d;">Última atualização: 30 Março 2025</p>
                    
                    <div class="sites">
                        <strong>Sites Disponíveis:</strong>
                        <div class="site-item">🇵🇹 A Bola (tratamento: mínimo)</div>
                        <div class="site-item">🇵🇹 O Jogo (tratamento: agressivo)</div>
                        <div class="site-item">🇵🇹 Record (tratamento: médio)</div>
                        <div class="site-item">🇪🇸 Marca (tratamento: médio)</div>
                        <div class="site-item">🇪🇸 Mundo Deportivo (tratamento: médio)</div>
                        <div class="site-item">🇪🇸 AS (tratamento: médio)</div>
                    </div>
                </div>
            </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`🚀 PEDIBOLA Proxy na porta ${PORT}`);
});
