import { store } from './core/Store.js';
import { SceneManager } from './systems/SceneManager.js';
import { createModel } from './utils/GeometryFactory.js';
import { DimensionControl } from './features/DimensionControl.js';
import { ExportSystem } from './features/ExportSystem.js';
import { InputSystem } from './features/InputSystem.js';
import { DividerSystem } from './features/DividerSystem.js';
import { TutorialSystem } from './features/TutorialSystem.js';
import { LabelSystem } from './features/LabelSystem.js';
import { EditSystem } from './features/EditSystem.js';
import { LogoSystem } from './features/LogoSystem.js';
import { AuthSystem } from './features/AuthSystem.js';
import { calculateTrayPrice, formatVND } from './utils/pricing.js';
import { addOrMergeCartItem, buildCartItemFromState, getCartTrayCount } from './services/cartService.js';

class App {
    constructor() {
        const canvas3D = document.getElementById('canvas-3d');
        const canvasTop = document.getElementById('canvas-top');
        const view3D = document.getElementById('dim-container-3d');
        const viewTop = document.getElementById('dim-container');

        this.sceneManager = new SceneManager(canvas3D, canvasTop, view3D, viewTop);

        // Initialize Features
        this.features = [
            // DimensionControl is mostly replaced by Sidebar inputs but logic remains useful?
            // Actually, we moved inputs to sidebar. DimensionControl.js likely binds to old IDs.
            // We should check DimensionControl.js later or just bind events here.
            new DimensionControl(),
            new ExportSystem(this.sceneManager),
            new InputSystem(this.sceneManager, viewTop),
            new DividerSystem(),
            new TutorialSystem(this.sceneManager),
            new LabelSystem(this.sceneManager),
            new EditSystem(this.sceneManager),
            new LogoSystem(this.sceneManager),
            new AuthSystem()
        ];

        this.bindEvents();
        this.setupSidebarControls();
        this.refreshCartBadge();

        if (window.innerWidth < 768) {
            store.setMobileView('3d');
        } else {
            this.handleMobileViewChange('3d');
        }

        const tab3d = document.getElementById('tab-3d');
        const tabTop = document.getElementById('tab-top');
        if (tab3d) tab3d.onclick = () => store.setMobileView('3d');
        if (tabTop) tabTop.onclick = () => store.setMobileView('top');

        this.updateModel();
        this.sceneManager.autoFitCamera();
    }

    bindEvents() {
        store.on('dimensionsChanged', () => {
            this.updateModel();
            this.updatePrice();
            this.sceneManager.checkAutoZoom();
        });
        store.on('dividersChanged', () => this.updateModel());
        store.on('hiddenSegmentsChanged', () => this.updateModel());
        store.on('colorThemeChanged', () => this.updateModel());

        store.on('dimensionsCommitted', () => {
             this.sceneManager.checkAutoZoom();
        });

        store.on('mobileViewChanged', (view) => this.handleMobileViewChange(view));
        store.on('webglContextRestored', () => {
            this.updateModel();
            this.sceneManager.autoFitCamera();
        });

        window.addEventListener('resize', () => {
             if (window.innerWidth >= 768) {
                 const v3 = document.getElementById('view-3d-wrapper');
                 const vt = document.getElementById('view-top-wrapper');
                 v3.classList.remove('hidden', 'flex-1');
                 vt.classList.remove('hidden', 'flex-1');
             } else {
                 this.handleMobileViewChange(store.getState().mobileView);
             }
        });

        window.addEventListener('storage', (event) => {
            if (!event.key || event.key === 'tray_customize_cart_v1') {
                this.refreshCartBadge();
            }
        });
    }

    isFiniteArraySample(arrayLike) {
        if (!arrayLike || arrayLike.length === 0) return false;
        const len = arrayLike.length;
        const headCount = Math.min(64, len);
        for (let i = 0; i < headCount; i++) {
            if (!Number.isFinite(arrayLike[i])) return false;
        }

        const tailStart = Math.max(headCount, len - 64);
        for (let i = tailStart; i < len; i++) {
            if (!Number.isFinite(arrayLike[i])) return false;
        }

        const steps = 24;
        for (let i = 1; i <= steps; i++) {
            const idx = Math.floor((i / (steps + 1)) * (len - 1));
            if (!Number.isFinite(arrayLike[idx])) return false;
        }

        return true;
    }

    isModelStructurallyValid(model) {
        if (!model || !model.isObject3D || typeof model.traverse !== 'function') return false;
        let hasMesh = false;
        let valid = true;

        model.traverse((node) => {
            if (!valid || !node.isMesh) return;
            hasMesh = true;

            const geometry = node.geometry;
            const positionArray = geometry?.attributes?.position?.array;
            if (!positionArray || !positionArray.length) {
                valid = false;
                return;
            }
            if (!this.isFiniteArraySample(positionArray)) {
                valid = false;
            }
        });

        return hasMesh && valid;
    }

    setupSidebarControls() {
        // Colors
        document.getElementById('color-brown')?.addEventListener('click', () => {
            store.setColorTheme('brown');
            this.updateActiveColorButton('brown');
        });
        document.getElementById('color-white')?.addEventListener('click', () => {
            store.setColorTheme('white');
            this.updateActiveColorButton('white');
        });
        document.getElementById('color-red')?.addEventListener('click', () => {
            store.setColorTheme('red');
            this.updateActiveColorButton('red');
        });
        document.getElementById('color-blue')?.addEventListener('click', () => {
            store.setColorTheme('blue');
            this.updateActiveColorButton('blue');
        });

        // Radius
        const radInput = document.getElementById('radius');
        if (radInput) {
            radInput.addEventListener('input', (e) => {
                const r = parseInt(e.target.value);
                store.setDimensions({ radius: r });
            });
        }

        // Wall Thickness
        const wallInput = document.getElementById('wall-thickness');
        if (wallInput) {
            wallInput.addEventListener('input', (e) => {
                let t = parseFloat(e.target.value);
                if (isNaN(t)) t = 2;
                t = Math.max(2, Math.min(10, t));
                store.setDimensions({ wallThickness: t });
            });
        }

        // Reset
        document.getElementById('reset-btn')?.addEventListener('click', () => {
            store.setDimensions({ l: 120, w: 120, h: 40, radius: 8, wallThickness: 2 });
            store.updateDividers('x', []);
            store.updateDividers('z', []);
            store.setLogo(null);
            store.setColorTheme('brown');
            this.updateActiveColorButton('brown');
            if(radInput) radInput.value = 8;
            if(wallInput) wallInput.value = 2;
        });

        // Logo - Text
        document.getElementById('add-text-btn')?.addEventListener('click', () => {
            const text = document.getElementById('logo-text-input').value;
            if(text) {
                store.setLogo({ type: 'text', data: text, x: 0, z: 0 });
                document.getElementById('remove-logo-btn').classList.remove('hidden');
            }
        });

        // Logo - Image
        const fileInput = document.getElementById('logo-file-input');
        document.getElementById('upload-logo-btn')?.addEventListener('click', () => fileInput.click());
        fileInput?.addEventListener('change', (e) => {
            if(e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    store.setLogo({ type: 'image', data: evt.target.result, x: 0, z: 0 });
                    document.getElementById('remove-logo-btn').classList.remove('hidden');
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });

        document.getElementById('remove-logo-btn')?.addEventListener('click', () => {
             store.setLogo(null);
             document.getElementById('remove-logo-btn').classList.add('hidden');
             document.getElementById('logo-text-input').value = '';
             fileInput.value = '';
        });

        document.getElementById('add-to-cart-btn')?.addEventListener('click', () => {
            this.handleAddToCart();
        });
        document.getElementById('buy-now-btn')?.addEventListener('click', () => {
            this.handleBuyNow();
        });
        document.getElementById('open-cart-btn')?.addEventListener('click', () => {
            this.handleOpenCart();
        });

        this.updatePrice();
    }

    handleAddToCart() {
        try {
            const topViewPreview = this.captureTopViewPreview();
            const item = buildCartItemFromState(store.getState(), { topViewPreview });
            addOrMergeCartItem(item);
            this.refreshCartBadge();
            return true;
        } catch (error) {
            console.error('Failed to add item to cart:', error);
            window.alert('Unable to add item to cart. Please try again.');
            return false;
        }
    }

    handleBuyNow() {
        const added = this.handleAddToCart();
        if (!added) return;

        this.handleOpenCart({ checkout: true });
    }

    captureTopViewPreview() {
        const sourceCanvas = document.getElementById('canvas-top');
        if (!sourceCanvas || sourceCanvas.width < 4 || sourceCanvas.height < 4) {
            return null;
        }

        try {
            const size = 80;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;

            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) return null;

            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, size, size);
            ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, size, size);

            const pixels = ctx.getImageData(0, 0, size, size).data;
            let sum = 0;
            let sumSq = 0;
            for (let i = 0; i < pixels.length; i += 4) {
                const lum = (pixels[i] * 0.299) + (pixels[i + 1] * 0.587) + (pixels[i + 2] * 0.114);
                sum += lum;
                sumSq += lum * lum;
            }
            const count = pixels.length / 4;
            const mean = sum / count;
            const variance = (sumSq / count) - (mean * mean);

            // If top canvas is visually flat/empty, skip capture and let cart fallback to SVG preview.
            if (!Number.isFinite(variance) || variance < 15) {
                return null;
            }

            return canvas.toDataURL('image/jpeg', 0.4);
        } catch (_error) {
            return null;
        }
    }

    handleOpenCart(options = {}) {
        const targetUrl = new URL('./cart.html', window.location.href);
        if (options.checkout) {
            targetUrl.searchParams.set('checkout', '1');
        }

        window.location.href = targetUrl.toString();
    }

    refreshCartBadge() {
        const badge = document.getElementById('cart-badge');
        if (!badge) return;

        try {
            const count = getCartTrayCount();
            badge.innerText = count > 99 ? '99+' : String(count);
        } catch (error) {
            console.error('Failed to refresh cart badge:', error);
            badge.innerText = '0';
        }
    }

    updateActiveColorButton(theme) {
        ['brown', 'white', 'red', 'blue'].forEach(t => {
            const btn = document.getElementById(`color-${t}`);
            if (btn) btn.classList.remove('border-white', 'scale-105');
        });

        const btn = document.getElementById(`color-${theme}`);
        if(btn) btn.classList.add('border-white');
    }

    updatePrice() {
        const price = calculateTrayPrice(store.getState().dimensions);

        const el = document.getElementById('total-price');
        if(el) el.innerText = formatVND(price);
    }

    handleMobileViewChange(mode) {
        if (window.innerWidth >= 768) return;

        const v3 = document.getElementById('view-3d-wrapper');
        const vt = document.getElementById('view-top-wrapper');
        const t3 = document.getElementById('tab-3d');
        const tt = document.getElementById('tab-top');

        v3.classList.remove('hidden', 'flex-1');
        vt.classList.remove('hidden', 'flex-1');
        if(t3) t3.className = 'px-6 py-2 rounded-lg text-xs font-bold transition-all';
        if(tt) tt.className = 'px-6 py-2 rounded-lg text-xs font-bold transition-all';

        if (mode === '3d') {
            v3.classList.add('flex-1');
            vt.classList.add('hidden', 'md:block', 'md:flex-1');
            if(t3) t3.classList.add('bg-zinc-600', 'text-white', 'shadow-sm');
            if(tt) tt.classList.add('text-zinc-400', 'hover:text-white');
        } else {
            vt.classList.add('flex-1');
            v3.classList.add('hidden', 'md:block', 'md:flex-1');
            if(tt) tt.classList.add('bg-zinc-600', 'text-white', 'shadow-sm');
            if(t3) t3.classList.add('text-zinc-400', 'hover:text-white');
        }
    }

    updateModel() {
        const state = store.getState();
        const { l, w, h, radius, wallThickness } = state.dimensions;
        const { x: dX, z: dZ } = state.dividers;

        const minSegX = this.getMinSegmentSize(l, dX);
        const minSegZ = this.getMinSegmentSize(w, dZ);
        const minSegment = Math.min(minSegX, minSegZ);
        const maxSafeRadius = (minSegment / 2) - 0.5;
        const effectiveR = Math.max(1, Math.min(radius, maxSafeRadius));

        const radDisplay = document.getElementById('radius-val');
        if(radDisplay) radDisplay.innerText = `${Math.round(effectiveR * 10) / 10}mm`;

        const wallDisplay = document.getElementById('wall-thickness-val');
        if(wallDisplay) wallDisplay.innerText = `${Math.round(wallThickness * 10) / 10}mm`;
        if (!this.sceneManager.canUpdateMesh()) {
            return;
        }

        let model = null;
        try {
            model = createModel(l, h, w, effectiveR, wallThickness, dX, dZ, state.hiddenSegments, state.colorTheme);
        } catch (error) {
            console.error('[App] Model generation failed:', error);
            return;
        }

        if (!this.isModelStructurallyValid(model)) {
            console.warn('[App] Generated geometry is invalid; keeping previous mesh.');
            this.sceneManager.disposeObjectResources(model);
            return;
        }

        try {
            const swapped = this.sceneManager.updateMesh(model);
            if (!swapped) {
                this.sceneManager.disposeObjectResources(model);
                return;
            }
            store.emit('modelRegenerated');
        } catch (error) {
            console.error('[App] Mesh update failed:', error);
            this.sceneManager.disposeObjectResources(model);
        }
    }

    getMinSegmentSize(totalSize, dividers) {
        const points = [-totalSize/2, ...[...dividers].sort((a,b)=>a-b), totalSize/2];
        let minSize = totalSize;
        for(let i = 0; i < points.length - 1; i++) {
            const dist = points[i+1] - points[i];
            if (dist < minSize) minSize = dist;
        }
        return minSize;
    }
}

window.addEventListener('load', () => {
    // Mobile Viewport Height Lock Logic
    // Prevents interface jump when keyboard opens by setting a fixed pixel height on body.
    //
    // IMPORTANT: We must NOT resize when the user is pinch-zooming (visual viewport change).
    // On some browsers window.innerHeight tracks the VISUAL viewport so it shrinks during zoom,
    // which would incorrectly shrink the canvas and the 3D geometry with it.
    // Fix: use document.documentElement.clientHeight which always reflects the LAYOUT viewport
    // (unaffected by visual zoom), and skip updates if only height changed (zoom, not rotation).
    const fixMobileHeight = () => {
        if (window.innerWidth < 768) {
            // Only act on real orientation/layout changes (width changed significantly).
            // A pure pinch-zoom changes height but NOT width, so we can ignore height-only resizes.
            const currentWidth = window.innerWidth;
            const lastWidth = parseFloat(document.body.dataset.lastWidth || 0);

            if (Math.abs(currentWidth - lastWidth) > 50) {
                // Use clientHeight (layout viewport) — NOT innerHeight (can be visual viewport)
                const h = document.documentElement.clientHeight;
                document.body.style.height = `${h}px`;
                document.body.style.overflow = 'hidden';
                document.documentElement.style.height = `${h}px`;
                document.documentElement.style.overflow = 'hidden';
                document.body.dataset.lastWidth = currentWidth;
            }
        } else {
             // Reset on desktop
             document.body.style.height = '';
             document.documentElement.style.height = '';
             document.body.style.overflow = '';
             document.documentElement.style.overflow = '';
             delete document.body.dataset.lastWidth;
        }
    };

    fixMobileHeight();
    window.addEventListener('resize', () => {
        fixMobileHeight();
    });

    window.app = new App();
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});
