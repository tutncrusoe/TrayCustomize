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

class App {
    constructor() {
        const canvas = document.getElementById('main-canvas');
        const view3D = document.getElementById('view-3d-placeholder');
        const viewTop = document.getElementById('view-top-placeholder');

        this.sceneManager = new SceneManager(canvas, view3D, viewTop);

        // Initialize Features
        this.features = [
            new DimensionControl(),
            new ExportSystem(this.sceneManager),
            new InputSystem(this.sceneManager, viewTop),
            new DividerSystem(),
            new TutorialSystem(),
            new LabelSystem(this.sceneManager),
            new EditSystem(this.sceneManager)
        ];

        this.bindEvents();

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
        store.on('dimensionsChanged', () => this.updateModel());
        store.on('dividersChanged', () => this.updateModel());
        store.on('hiddenSegmentsChanged', () => this.updateModel());

        store.on('dimensionsCommitted', () => {
             this.sceneManager.checkAutoZoom();
        });

        store.on('mobileViewChanged', (view) => this.handleMobileViewChange(view));

        window.addEventListener('resize', () => {
             if (window.innerWidth >= 768) {
                 const v3 = document.getElementById('view-3d-placeholder');
                 const vt = document.getElementById('view-top-placeholder');
                 v3.classList.remove('hidden', 'flex-1');
                 vt.classList.remove('hidden', 'flex-1');
             } else {
                 this.handleMobileViewChange(store.getState().mobileView);
             }
        });
    }

    handleMobileViewChange(mode) {
        if (window.innerWidth >= 768) return;

        const v3 = document.getElementById('view-3d-placeholder');
        const vt = document.getElementById('view-top-placeholder');
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

        const model = createModel(l, h, w, effectiveR, dX, dZ, state.hiddenSegments);
        this.sceneManager.updateMesh(model);
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
