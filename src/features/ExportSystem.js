// src/features/ExportSystem.js
import { store } from '../core/Store.js';

const ENABLE_EXPORT = true;

export class ExportSystem {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.btn = document.getElementById('export-btn');

        if (!ENABLE_EXPORT) {
            if (this.btn) this.btn.style.display = 'none';
        } else {
            this.bindEvents();
        }
    }

    bindEvents() {
        if (this.btn) {
            this.btn.addEventListener('click', () => this.exportSTL());
        }
    }

    generateOrderCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    formatDate(date, includeTime = false) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');

        let str = `${yyyy}${mm}${dd}`;
        if (includeTime) {
            const HH = String(date.getHours()).padStart(2, '0');
            const MM = String(date.getMinutes()).padStart(2, '0');
            str += `-${HH}${MM}`;
        }
        return str;
    }

    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
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

        // Filename: OrderCode_Color_Time_Deadline.stl
        const orderCode = this.generateOrderCode();
        const now = new Date();
        const orderTimeStr = this.formatDate(now, true);

        const deadlineDate = new Date(now);
        deadlineDate.setDate(deadlineDate.getDate() + 3);
        const deadlineStr = this.formatDate(deadlineDate, false);

        const theme = store.getState().colorTheme; // 'brown', 'white', 'red', 'blue'
        const colorStr = this.capitalize(theme);

        link.download = `${orderCode}_${colorStr}_${orderTimeStr}_${deadlineStr}.stl`;

        link.click();
        document.body.removeChild(link);
    }
}
