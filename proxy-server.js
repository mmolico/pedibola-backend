const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS para todos
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

// Endpoint de proxy
app.get('/proxy/:site', async (req, res) => {
    const { site } = req.params;
    let targetUrl = ALLOWED_SITES[site];

    if (!targetUrl) {
        return res.status(400).send('Site não permitido');
    }

    // Suporte para URLs internas (quando clicam em links)
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
                'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            redirect: 'follow'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        let html = await response.text();

        const baseUrl = new URL(targetUrl);
        
        // REESCRITA SUPREMA DE URLs - Passar TUDO pelo proxy
        // Função para transformar URL original em URL do proxy
        const proxyifyUrl = (url) => {
            try {
                const urlObj = new URL(url, targetUrl);
                // Se for do mesmo domínio, passar pelo proxy
                if (urlObj.hostname === baseUrl.hostname) {
                    // Encode a URL completa para passar pelo proxy
                    return `/proxy/${site}?url=${encodeURIComponent(urlObj.pathname + urlObj.search + urlObj.hash)}`;
                }
                return url; // URLs externos mantém
            } catch (e) {
                return url;
            }
        };
        
        // Reescrever TODOS os tipos de URLs
        // href attributes
        html = html.replace(/href="\/([^"]*)"/g, (match, path) => {
            return `href="/proxy/${site}?url=${encodeURIComponent('/' + path)}"`;
        });
        html = html.replace(/href='\/([^']*)'/g, (match, path) => {
            return `href='/proxy/${site}?url=${encodeURIComponent('/' + path)}'`;
        });
        
        // src attributes - manter no domínio original para assets
        html = html.replace(/src="\/([^"]*)"/g, `src="${baseUrl.origin}/$1"`);
        html = html.replace(/src='\/([^']*)'/g, `src='${baseUrl.origin}/$1'`);
        
        // data-src (lazy loading)
        html = html.replace(/data-src="\/([^"]*)"/g, `data-src="${baseUrl.origin}/$1"`);
        
        // URLs em JavaScript inline
        html = html.replace(/window\.location\s*=\s*["']\/([^"']*)["']/g, 
            `window.location="/proxy/${site}?url=${encodeURIComponent('/$1')}"`);
        
        // Adicionar base tag
        html = html.replace('<head>', `<head><base href="${targetUrl}/" target="_parent">`);

        // MELHORIAS ESPECÍFICAS POR SITE
        
        // O JOGO - Controlo de scroll e remoção de publicidades problemáticas
        if (site === 'ojogo') {
            // CSS para controlar scroll e esconder ads
            const customCSS = `
                <style id="pedibola-fixes">
                    /* Forçar scroll controlado */
                    html, body {
                        scroll-behavior: auto !important;
                        overflow-y: auto !important;
                        position: relative !important;
                    }
                    
                    /* Esconder publicidades conhecidas */
                    .ad-container,
                    .advertisement,
                    .pub-container,
                    .publicidade,
                    [class*="ad-"],
                    [class*="publicidade"],
                    [id*="ad-"],
                    [id*="publicidade"],
                    iframe[src*="doubleclick"],
                    iframe[src*="googlesyndication"],
                    div[data-ad],
                    .ads-wrapper {
                        display: none !important;
                        height: 0 !important;
                        overflow: hidden !important;
                    }
                    
                    /* Prevenir overlays que bloqueiam conteúdo */
                    .overlay,
                    .modal-backdrop,
                    [class*="overlay"] {
                        position: relative !important;
                    }
                    
                    /* Melhorar usabilidade em iframe */
                    * {
                        scroll-margin-top: 0 !important;
                    }
                </style>
            `;
            
            // JavaScript para prevenir auto-scroll forçado
            const customJS = `
                <script id="pedibola-scroll-fix">
                    (function() {
                        // CONTROLO DE SCROLL
                        let userScrolling = false;
                        window.addEventListener('wheel', () => { userScrolling = true; }, { passive: true });
                        window.addEventListener('touchmove', () => { userScrolling = true; }, { passive: true });
                        
                        const originalScrollTo = window.scrollTo;
                        window.scrollTo = function(...args) {
                            if (userScrolling) {
                                originalScrollTo.apply(this, args);
                            }
                        };
                        
                        window.scroll = window.scrollTo;
                        
                        const originalScrollIntoView = Element.prototype.scrollIntoView;
                        Element.prototype.scrollIntoView = function(...args) {
                            if (userScrolling) {
                                originalScrollIntoView.apply(this, args);
                            }
                        };
                        
                        window.addEventListener('load', () => {
                            setTimeout(() => {
                                userScrolling = true;
                            }, 2000);
                        });
                        
                        // INTERCEPTAÇÃO SUPREMA DE CLIQUES
                        document.addEventListener('click', function(e) {
                            let target = e.target;
                            
                            // Encontrar o link pai se clicou num elemento dentro do link
                            while (target && target.tagName !== 'A') {
                                target = target.parentElement;
                            }
                            
                            if (target && target.tagName === 'A' && target.href) {
                                const href = target.href;
                                
                                // Se for link interno do domínio
                                if (href.includes('ojogo.pt') && !href.includes('/proxy/')) {
                                    e.preventDefault();
                                    
                                    // Extrair path
                                    const url = new URL(href);
                                    const path = url.pathname + url.search + url.hash;
                                    
                                    // Redirecionar pelo proxy
                                    window.location.href = '/proxy/ojogo?url=' + encodeURIComponent(path);
                                    return false;
                                }
                            }
                        }, true);
                        
                        // INTERCEPTAR fetch e XMLHttpRequest para conteúdo dinâmico
                        const originalFetch = window.fetch;
                        window.fetch = function(...args) {
                            let url = args[0];
                            if (typeof url === 'string' && url.startsWith('/')) {
                                args[0] = 'https://www.ojogo.pt' + url;
                            }
                            return originalFetch.apply(this, args);
                        };
                        
                        console.log('PEDIBOLA: O Jogo supremo control activated');
                    })();
                </script>
            `;
            
            // Injetar CSS no head
            html = html.replace('</head>', `${customCSS}</head>`);
            
            // Injetar JS antes de fechar body
            html = html.replace('</body>', `${customJS}</body>`);
            
            // Remover scripts de ads conhecidos
            html = html.replace(/<script[^>]*doubleclick[^>]*>.*?<\/script>/gis, '');
            html = html.replace(/<script[^>]*googlesyndication[^>]*>.*?<\/script>/gis, '');
            html = html.replace(/<script[^>]*googletagmanager[^>]*>.*?<\/script>/gis, '');
        }
        
        // MARCA, MUNDO DEPORTIVO, AS - Interceptação de cliques
        if (site === 'marca' || site === 'mundodeportivo' || site === 'as') {
            const domain = site === 'marca' ? 'marca.com' : 
                          site === 'mundodeportivo' ? 'mundodeportivo.com' : 
                          'as.com';
            
            const customCSS = `
                <style id="pedibola-fixes">
                    html, body {
                        overflow-y: auto !important;
                    }
                    
                    .ad-container,
                    [class*="ad-"],
                    iframe[src*="doubleclick"] {
                        display: none !important;
                    }
                </style>
            `;
            
            const customJS = `
                <script id="pedibola-link-intercept">
                    (function() {
                        const SITE_DOMAIN = '${domain}';
                        const SITE_ID = '${site}';
                        
                        // INTERCEPTAR TODOS OS CLIQUES EM LINKS
                        document.addEventListener('click', function(e) {
                            let target = e.target;
                            
                            // Encontrar o link
                            while (target && target.tagName !== 'A') {
                                target = target.parentElement;
                            }
                            
                            if (target && target.tagName === 'A' && target.href) {
                                const href = target.href;
                                
                                // Se for link interno
                                if (href.includes(SITE_DOMAIN) && !href.includes('/proxy/')) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    try {
                                        const url = new URL(href);
                                        const path = url.pathname + url.search + url.hash;
                                        
                                        // Redirecionar pelo proxy
                                        window.top.location.href = '/proxy/' + SITE_ID + '?url=' + encodeURIComponent(path);
                                    } catch (err) {
                                        console.error('Link intercept error:', err);
                                    }
                                    
                                    return false;
                                }
                            }
                        }, true);
                        
                        // Interceptar window.location changes
                        const originalLocationSetter = Object.getOwnPropertyDescriptor(window, 'location').set;
                        Object.defineProperty(window, 'location', {
                            set: function(url) {
                                if (typeof url === 'string' && url.includes(SITE_DOMAIN) && !url.includes('/proxy/')) {
                                    const urlObj = new URL(url);
                                    const path = urlObj.pathname + urlObj.search + urlObj.hash;
                                    url = '/proxy/' + SITE_ID + '?url=' + encodeURIComponent(path);
                                }
                                return originalLocationSetter.call(window, url);
                            },
                            get: function() {
                                return window.document.location;
                            }
                        });
                        
                        console.log('PEDIBOLA: Link intercept active for ' + SITE_DOMAIN);
                    })();
                </script>
            `;
            
            html = html.replace('</head>', `${customCSS}</head>`);
            html = html.replace('</body>', `${customJS}</body>`);
        }
        
        // A BOLA e RECORD - Otimizações leves
        if (site === 'abola' || site === 'record') {
            const customCSS = `
                <style id="pedibola-fixes">
                    /* Melhorar scroll em iframe */
                    html, body {
                        overflow-y: auto !important;
                    }
                </style>
            `;
            html = html.replace('</head>', `${customCSS}</head>`);
        }

        // Remover headers problemáticos e adicionar headers corretos
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
                        a:hover { background: #2980b9; }
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
                    p { color: #7f8c8d; margin: 10px 0; }
                    .sites { 
                        margin-top: 30px;
                        padding: 20px;
                        background: #f8f9fa;
                        border-radius: 10px;
                    }
                    .site-item {
                        margin: 8px 0;
                        color: #34495e;
                    }
                </style>
            </head>
            <body>
                <div class="status-box">
                    <h1>✅ PEDIBOLA Proxy Server</h1>
                    <p>Servidor ativo e funcionando!</p>
                    <div class="sites">
                        <p><strong>Sites disponíveis:</strong></p>
                        <div class="site-item">🇵🇹 /proxy/abola</div>
                        <div class="site-item">🇵🇹 /proxy/ojogo</div>
                        <div class="site-item">🇵🇹 /proxy/record</div>
                        <div class="site-item">🇪🇸 /proxy/marca</div>
                        <div class="site-item">🇪🇸 /proxy/mundodeportivo</div>
                        <div class="site-item">🇪🇸 /proxy/as</div>
                    </div>
                </div>
            </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`🚀 PEDIBOLA Proxy Server rodando na porta ${PORT}`);
    console.log(`📍 Acesso: http://localhost:${PORT}`);
});
