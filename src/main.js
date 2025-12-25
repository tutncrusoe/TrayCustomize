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

class App {
    constructor() {
        const canvas = document.getElementById('main-canvas');
        const view3D = document.getElementById('view-3d-placeholder');
        const viewTop = document.getElementById('view-top-placeholder');

        this.sceneManager = new SceneManager(canvas, view3D, viewTop);

        // Initialize Features
        this.features = [
            // DimensionControl is mostly replaced by Sidebar inputs but logic remains useful?
            // Actually, we moved inputs to sidebar. DimensionControl.js likely binds to old IDs.
            // We should check DimensionControl.js later or just bind events here.
            new DimensionControl(),
            new ExportSystem(this.sceneManager),
            new InputSystem(this.sceneManager, viewTop),
            new DividerSystem(),
            new TutorialSystem(),
            new LabelSystem(this.sceneManager),
            new EditSystem(this.sceneManager),
            new LogoSystem(this.sceneManager)
        ];

        this.bindEvents();
        this.setupSidebarControls();

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
        });
        store.on('dividersChanged', () => this.updateModel());
        store.on('hiddenSegmentsChanged', () => this.updateModel());
        store.on('colorThemeChanged', () => this.updateModel());

        store.on('dimensionsCommitted', () => {
             this.sceneManager.checkAutoZoom();
        });

        store.on('mobileViewChanged', (view) => this.handleMobileViewChange(view));

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

        // Radius
        const radInput = document.getElementById('radius');
        if (radInput) {
            radInput.addEventListener('input', (e) => {
                const r = parseInt(e.target.value);
                store.setDimensions({ radius: r });
            });
        }

        // Reset
        document.getElementById('reset-btn')?.addEventListener('click', () => {
            store.setDimensions({ l: 120, w: 120, h: 40, radius: 8 });
            store.updateDividers('x', []);
            store.updateDividers('z', []);
            store.setLogo(null);
            store.setColorTheme('brown');
            this.updateActiveColorButton('brown');
            if(radInput) radInput.value = 8;
        });

        // Guide
        document.getElementById('guide-btn')?.addEventListener('click', () => {
             // Assuming TutorialSystem starts on restart
             localStorage.removeItem('tutorialComplete');
             location.reload();
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

        this.updatePrice();
    }

    updateActiveColorButton(theme) {
        document.querySelectorAll('.active-theme-btn').forEach(b => b.classList.remove('border-white', 'scale-105'));
        const btn = document.getElementById(theme === 'brown' ? 'color-brown' : 'color-white');
        if(btn) btn.classList.add('border-white');
    }

    updatePrice() {
        const { l, w, h } = store.getState().dimensions;
        // Volume Calculation
        // Approx: Base + Walls
        // Base: l * w * 2mm
        // Walls: (2*l + 2*w) * h * 2mm
        // Volume in cm3 = (mm3) / 1000

        const thick = 2;
        const volBase = l * w * thick;
        const volWalls = (2 * l + 2 * w) * h * thick;
        const totalVolMm3 = volBase + volWalls;
        const totalVolCm3 = totalVolMm3 / 1000;

        // PLA Density ~ 1.25 g/cm3. 10% infill -> ~0.2 effective?
        // Walls are usually solid in 3D printing if thin (2mm is 4 perimeters).
        // Let's assume solid for 2mm walls.
        // Density = 1.25 g/cm3

        const massGrams = totalVolCm3 * 1.25;

        // Price per gram? Let's say 500 VND/g + base fee
        const pricePerGram = 500;
        const baseFee = 50000;

        const price = Math.round((massGrams * pricePerGram + baseFee) / 1000) * 1000; // Round to nearest 1000

        const el = document.getElementById('total-price');
        if(el) el.innerText = price.toLocaleString('vi-VN') + ' VNĐ';
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
        const { l, w, h, radius } = state.dimensions;
        const { x: dX, z: dZ } = state.dividers;

        const minSegX = this.getMinSegmentSize(l, dX);
        const minSegZ = this.getMinSegmentSize(w, dZ);
        const minSegment = Math.min(minSegX, minSegZ);
        const maxSafeRadius = (minSegment / 2) - 0.5;
        const effectiveR = Math.max(1, Math.min(radius, maxSafeRadius));

        const radDisplay = document.getElementById('radius-val');
        if(radDisplay) radDisplay.innerText = `${Math.round(effectiveR * 10) / 10}mm`;

        const model = createModel(l, h, w, effectiveR, dX, dZ, state.hiddenSegments, state.colorTheme);
        this.sceneManager.updateMesh(model);
        store.emit('modelRegenerated');
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
    window.app = new App();
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});
