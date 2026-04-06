/**
 * PEDIBOLA - Proxy Server
 * Versão: v0.2.1 Beta
 * Data: 2 Abril 2025
 * 
 * CHANGELOG v0.2.1 Beta:
 * - Record: CORRIGIDO - links passam pelo proxy (navegação interna funciona)
 * - Sites ES: Links abrem em nova aba (target="_blank")
 * 
 * CHANGELOG v0.2 Beta:
 * - Tentativa Record navegação normal (não funcionou)
 * 
 * CHANGELOG v0.1 Beta:
 * - Versão inicial
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
        // O JOGO - TRATAMENTO SUPER AGRESSIVO v0.2
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
                <style id="pedibola-ojogo-v2">
                    /* SUPER AGRESSIVO - Garantir scroll funciona */
                    html, body {
                        overflow-y: auto !important;
                        overflow-x: hidden !important;
                        scroll-behavior: auto !important;
                        position: static !important;
                        height: auto !important;
                        min-height: 100vh !important;
                    }
                    
                    /* REMOVER TUDO que é sticky/fixed - MUITO AGRESSIVO */
                    * {
                        position: relative !important;
                    }
                    
                    header, .header, nav, .nav, 
                    [class*="header"], [id*="header"],
                    [class*="nav"], [id*="nav"],
                    [class*="sticky"], [id*="sticky"],
                    [class*="fixed"], [id*="fixed"],
                    [class*="top"], [class*="menu"] {
                        position: relative !important;
                        top: auto !important;
                        left: auto !important;
                        transform: none !important;
                    }
                    
                    /* REMOVER PUBLICIDADE AGRESSIVAMENTE */
                    .ad-container,
                    .advertisement, 
                    .publicidade,
                    [class*="publicidade"],
                    [id*="publicidade"],
                    [class*="ad-"],
                    [id*="ad-"],
                    [class*="ads"],
                    [id*="ads"],
                    [data-ad],
                    iframe[src*="doubleclick"],
                    iframe[src*="googlesyndication"],
                    iframe[src*="ad"],
                    div[data-ad-slot],
                    ins[class*="adsbygoogle"] {
                        display: none !important;
                        height: 0 !important;
                        width: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        visibility: hidden !important;
                    }
                    
                    /* FORÇAR CONTEÚDO APARECER */
                    article, .article,
                    [class*="article"],
                    [class*="news"],
                    [class*="noticia"],
                    [class*="content"],
                    .main, main {
                        display: block !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        height: auto !important;
                        max-height: none !important;
                    }
                    
                    /* LAZY LOADING - Forçar mostrar */
                    img[loading="lazy"],
                    img[data-src],
                    img[data-lazy-src] {
                        display: block !important;
                        opacity: 1 !important;
                    }
                    
                    /* Remover overlays */
                    [class*="overlay"],
                    [class*="modal"],
                    [class*="popup"] {
                        display: none !important;
                    }
                </style>
            `;

            const js = `
                <script id="pedibola-ojogo-v2-fix">
                    (function() {
                        console.log('PEDIBOLA v0.2: O Jogo SUPER aggressive mode');
                        
                        // PREVENIR SCROLL AUTOMÁTICO - MUITO AGRESSIVO
                        let userHasScrolled = false;
                        let scrollBlocked = false;
                        
                        // Detectar scroll do utilizador
                        window.addEventListener('wheel', () => { 
                            userHasScrolled = true; 
                            scrollBlocked = false;
                        }, { passive: true });
                        
                        window.addEventListener('touchmove', () => { 
                            userHasScrolled = true; 
                            scrollBlocked = false;
                        }, { passive: true });
                        
                        // BLOQUEAR window.scrollTo completamente nos primeiros 3 segundos
                        scrollBlocked = true;
                        const origScrollTo = window.scrollTo;
                        const origScroll = window.scroll;
                        
                        window.scrollTo = function(...args) {
                            if (!scrollBlocked && userHasScrolled) {
                                origScrollTo.apply(this, args);
                            }
                        };
                        
                        window.scroll = window.scrollTo;
                        
                        // Bloquear scrollIntoView
                        const origScrollIntoView = Element.prototype.scrollIntoView;
                        Element.prototype.scrollIntoView = function(...args) {
                            if (userHasScrolled) {
                                origScrollIntoView.apply(this, args);
                            }
                        };
                        
                        // Após 3 segundos, libera scroll
                        setTimeout(() => {
                            scrollBlocked = false;
                            userHasScrolled = true;
                        }, 3000);
                        
                        // FORÇAR CARREGAMENTO DE LAZY IMAGES
                        function forceLazyLoad() {
                            document.querySelectorAll('img[loading="lazy"], img[data-src], img[data-lazy-src]').forEach(img => {
                                if (img.dataset.src) {
                                    img.src = img.dataset.src;
                                }
                                if (img.dataset.lazySrc) {
                                    img.src = img.dataset.lazySrc;
                                }
                                img.loading = 'eager';
                            });
                        }
                        
                        // REMOVER ELEMENTOS PROBLEMÁTICOS
                        function removeProblematicElements() {
                            // Remover sticky/fixed elements
                            document.querySelectorAll('[style*="position: fixed"], [style*="position: sticky"]').forEach(el => {
                                el.style.position = 'relative';
                            });
                            
                            // Remover overlays
                            document.querySelectorAll('[class*="overlay"], [class*="modal"], [class*="popup"]').forEach(el => {
                                if (el.style.position === 'fixed' || el.style.position === 'absolute') {
                                    el.remove();
                                }
                            });
                        }
                        
                        // Executar quando carregar
                        window.addEventListener('load', () => {
                            forceLazyLoad();
                            removeProblematicElements();
                            
                            // Repeat após 1 segundo
                            setTimeout(() => {
                                forceLazyLoad();
                                removeProblematicElements();
                            }, 1000);
                            
                            // E mais uma vez após 2 segundos
                            setTimeout(() => {
                                forceLazyLoad();
                                removeProblematicElements();
                            }, 2000);
                        });
                        
                        // Também executar imediatamente
                        setTimeout(() => {
                            forceLazyLoad();
                            removeProblematicElements();
                        }, 100);
                        
                        console.log('PEDIBOLA v0.2: O Jogo fixes applied');
                    })();
                </script>
            `;

            html = html.replace('</head>', `${css}</head>`);
            html = html.replace('</body>', `${js}</body>`);
        }

        // ═══════════════════════════════════════════════════════════
        // RECORD - Links passam pelo proxy (navegação interna)
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
        // SITES ESPANHÓIS - Abrir links em nova aba
        // ═══════════════════════════════════════════════════════════
        if (site === 'marca' || site === 'mundodeportivo' || site === 'as') {
            // Adicionar target="_blank" a TODOS os links
            html = html.replace(/<a /g, '<a target="_blank" ');

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
