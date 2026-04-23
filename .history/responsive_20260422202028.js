/* ══════════════════════════════════════════════════════
   RESPONSIVE BEHAVIOR — Simulador de Red v6.0
   Agrega <script src="js/responsive.js"></script>
   justo antes del cierre de </body>
══════════════════════════════════════════════════════ */

(function() {
    'use strict';

    /* ── Inyectar elementos de UI ────────────────────── */
    function injectResponsiveUI() {

        /* Overlay oscuro para el panel derecho */
        const overlay = document.createElement('div');
        overlay.className = 'panel-overlay';
        overlay.id = 'panelOverlay';
        document.body.appendChild(overlay);

        /* Botón flotante para abrir/cerrar panel config */
        const panelToggle = document.createElement('button');
        panelToggle.className = 'panel-toggle-btn';
        panelToggle.id = 'panelToggleBtn';
        panelToggle.title = 'Configuración';
        panelToggle.innerHTML = `<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="10" cy="10" r="2.5"/>
            <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.2 5.2l1.4 1.4M13.4 13.4l1.4 1.4M5.2 14.8l1.4-1.4M13.4 6.6l1.4-1.4"/>
        </svg>`;
        document.body.appendChild(panelToggle);

        /* Bottom bar para móvil (herramientas avanzadas) */
        const bottomBar = document.createElement('div');
        bottomBar.className = 'mobile-bottom-bar';
        bottomBar.id = 'mobileBottomBar';
        bottomBar.innerHTML = `
            <button class="mbb-btn mbb-cli"   id="mbbCLI"    title="CLI">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="3" width="16" height="13" rx="2"/>
                    <path d="M5 8l3 2.5L5 13M10 13h5"/>
                </svg>
                <span>CLI</span>
            </button>
            <button class="mbb-btn mbb-traf"  id="mbbTraf"   title="Tráfico">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="2,14 6,8 9,11 13,5 17,9"/>
                    <line x1="2" y1="17" x2="18" y2="17" stroke-width="1.2"/>
                </svg>
                <span>Tráfico</span>
            </button>
            <button class="mbb-btn mbb-fault" id="mbbFault"  title="Fallas">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
                    <path d="M10 2l8 16H2L10 2z"/>
                    <path d="M10 8v4M10 14v1" stroke-linecap="round"/>
                </svg>
                <span>Fallas</span>
            </button>
            <button class="mbb-btn mbb-diag"  id="mbbDiag"   title="Diagnóstico">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="10" cy="10" r="7"/>
                    <path d="M7 10l2 2 4-4"/>
                </svg>
                <span>Diag.</span>
            </button>
            <button class="mbb-btn mbb-panel" id="mbbEvents" title="Eventos">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                    <rect x="3" y="3" width="14" height="14" rx="2"/>
                    <path d="M6 7h8M6 10h6M6 13h4"/>
                </svg>
                <span>Eventos</span>
            </button>
        `;
        document.body.appendChild(bottomBar);

        return { overlay, panelToggle, bottomBar };
    }

    /* ── Lógica panel derecho ─────────────────────────── */
    function initPanelToggle(overlay, panelToggle) {
        const configPanel = document.querySelector('.config-panel');
        if (!configPanel) return;

        let isOpen = false;

        function openPanel() {
            isOpen = true;
            configPanel.classList.add('panel-open');
            overlay.classList.add('visible');
            panelToggle.style.transform = 'rotate(45deg)';
        }

        function closePanel() {
            isOpen = false;
            configPanel.classList.remove('panel-open');
            overlay.classList.remove('visible');
            panelToggle.style.transform = '';
        }

        panelToggle.addEventListener('click', () => {
            isOpen ? closePanel() : openPanel();
        });

        overlay.addEventListener('click', closePanel);

        /* Abrir el panel automáticamente cuando se selecciona un dispositivo */
        const observer = new MutationObserver(() => {
            const info = document.getElementById('selectedDeviceInfo');
            if (info && info.textContent !== 'Ningún equipo seleccionado' && window.innerWidth <= 1024) {
                openPanel();
            }
        });

        const info = document.getElementById('selectedDeviceInfo');
        if (info) observer.observe(info, { childList: true, subtree: true, characterData: true });

        return { openPanel, closePanel };
    }

    /* ── Conectar bottom bar con los mismos handlers que adv-sidebar ── */
    function initBottomBar() {
        const map = {
            'mbbCLI':    'openCLIBtn',
            'mbbTraf':   'openTrafficBtn',
            'mbbFault':  'openFaultBtn',
            'mbbDiag':   'openDiagBtn',
            'mbbEvents': 'openEventLogBtn',
        };

        Object.entries(map).forEach(([mbbId, advId]) => {
            const mbb = document.getElementById(mbbId);
            const adv = document.getElementById(advId);
            if (!mbb || !adv) return;

            mbb.addEventListener('click', () => {
                adv.click(); /* delegar al handler original de advanced.js */
                /* sincronizar estado activo */
                setTimeout(() => {
                    const isActive = adv.classList.contains('adv-active');
                    mbb.classList.toggle('active', isActive);
                }, 50);
            });
        });
    }

    /* ── ResizeObserver: redibujar canvas ─────────────── */
    function initCanvasResize() {
        const canvas = document.getElementById('networkCanvas');
        const container = document.getElementById('canvas-container');
        if (!canvas || !container) return;

        let resizeTimer;

        const ro = new ResizeObserver(() => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                /* Actualizar dimensiones del canvas */
                const rect = container.getBoundingClientRect();
                canvas.width  = rect.width  * (window.devicePixelRatio || 1);
                canvas.height = rect.height * (window.devicePixelRatio || 1);
                /* Si el renderer expone un método de redibujado, llamarlo */
                if (window.renderer && typeof window.renderer.render === 'function') {
                    window.renderer.render();
                } else if (window.network && typeof window.network.render === 'function') {
                    window.network.render();
                }
            }, 100);
        });

        ro.observe(container);
    }

    /* ── Keyboard shortcuts en móvil — deshabilitarlos si hay teclado virtual ── */
    function initMobileKeyboard() {
        if ('ontouchstart' in window) {
            /* Prevenir zoom con doble tap en el canvas */
            const canvas = document.getElementById('networkCanvas');
            if (canvas) {
                let lastTap = 0;
                canvas.addEventListener('touchend', (e) => {
                    const now = Date.now();
                    if (now - lastTap < 300) {
                        e.preventDefault();
                    }
                    lastTap = now;
                }, { passive: false });
            }
        }
    }

    /* ── Orientación — re-posicionar sub-paletas ──────── */
    function initOrientationChange() {
        window.addEventListener('orientationchange', () => {
            /* Cerrar paletas abiertas */
            document.querySelectorAll('.sub-palette').forEach(p => p.classList.remove('open'));
            document.querySelectorAll('.dsb-cat').forEach(b => b.classList.remove('active'));
        });
    }

    /* ── Init ─────────────────────────────────────────── */
    function init() {
        const { overlay, panelToggle } = injectResponsiveUI();
        initPanelToggle(overlay, panelToggle);
        initBottomBar();
        initCanvasResize();
        initMobileKeyboard();
        initOrientationChange();

        /* Viewport meta dinámico — evitar zoom no deseado */
        let viewportMeta = document.querySelector('meta[name="viewport"]');
        if (!viewportMeta) {
            viewportMeta = document.createElement('meta');
            viewportMeta.name = 'viewport';
            document.head.appendChild(viewportMeta);
        }
        viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();