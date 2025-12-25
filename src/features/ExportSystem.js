// src/features/ExportSystem.js
import { store } from '../core/Store.js';

export class ExportSystem {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.btn = document.getElementById('export-btn');
        this.bindEvents();
    }

    bindEvents() {
        if (this.btn) {
            this.btn.addEventListener('click', () => this.exportSTL());
        }
    }

    exportSTL() {
        if (!this.sceneManager || !this.sceneManager.boxGroup) {
            console.warn('Nothing to export');
            return;
        }

        // We assume THREE.STLExporter is available globally via the script tag in index.html
        // In a bundler environment we would import it.
        if (typeof THREE.STLExporter === 'undefined') {
            console.error('THREE.STLExporter is not loaded');
            return;
        }

        const exporter = new THREE.STLExporter();
        const boxGroup = this.sceneManager.boxGroup;

        // Reset rotation for export
        const currentRotation = boxGroup.rotation.y;
        boxGroup.rotation.y = 0;
        boxGroup.updateMatrixWorld();

        const result = exporter.parse(boxGroup, { binary: true });

        // Restore rotation
        boxGroup.rotation.y = currentRotation;
        boxGroup.updateMatrixWorld();

        const blob = new Blob([result], { type: 'application/octet-stream' });
        const link = document.createElement('a');
        link.style.display = 'none';
        document.body.appendChild(link);
        link.href = URL.createObjectURL(blob);

        const { l, w, h } = store.getState().dimensions;
        link.download = `BentoBox_${l}x${w}x${h}.stl`;

        link.click();
        document.body.removeChild(link);
    }
}
