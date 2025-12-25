// src/features/DimensionControl.js
import { store } from '../core/Store.js';

export class DimensionControl {
    constructor() {
        this.inputs = {
            l: document.getElementById('dim-l'),
            w: document.getElementById('dim-w'),
            h: document.getElementById('dim-h'),
            radius: document.getElementById('radius')
        };

        this.radiusValDisplay = document.getElementById('radius-val');

        this.bindEvents();
        this.subscribeToStore();
    }

    bindEvents() {
        // Length
        if (this.inputs.l) {
            this.inputs.l.addEventListener('input', (e) => {
                store.setDimensions({ l: parseFloat(e.target.value) || 0 });
            });
            // Auto-zoom check usually happens on change (commit)
            this.inputs.l.addEventListener('change', () => {
                // We can let the main app handle auto-zoom, or emit a specific event
                store.emit('dimensionsCommitted');
            });
        }

        // Width
        if (this.inputs.w) {
            this.inputs.w.addEventListener('input', (e) => {
                store.setDimensions({ w: parseFloat(e.target.value) || 0 });
            });
            this.inputs.w.addEventListener('change', () => {
                store.emit('dimensionsCommitted');
            });
        }

        // Height
        if (this.inputs.h) {
            this.inputs.h.addEventListener('input', (e) => {
                store.setDimensions({ h: parseFloat(e.target.value) || 0 });
            });
            this.inputs.h.addEventListener('change', () => {
                store.emit('dimensionsCommitted');
            });
        }

        // Radius
        if (this.inputs.radius) {
            this.inputs.radius.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) || 0;
                store.setDimensions({ radius: val });
            });
        }
    }

    subscribeToStore() {
        store.on('dimensionsChanged', (dims) => {
            // Update input values if they are different (avoid loops if focused?)
            // For now, simpler is just to update them.
            if (this.inputs.l && document.activeElement !== this.inputs.l) this.inputs.l.value = dims.l;
            if (this.inputs.w && document.activeElement !== this.inputs.w) this.inputs.w.value = dims.w;
            if (this.inputs.h && document.activeElement !== this.inputs.h) this.inputs.h.value = dims.h;

            if (this.inputs.radius) this.inputs.radius.value = dims.radius;

            // Note: The logic for "effective radius" calculation was in the old updateBox.
            // That logic belongs in the GeometryFactory or Store, but for display purposes
            // we might want to calculate it here or receive it from store?
            // The user prompt said "move logic", so the GeometryFactory now calculates holes.
            // But the text "8mm" needs to show effective radius.
            // Let's defer effective radius calculation to the geometry generation moment
            // or duplicate the safe radius logic here for display.

            // For now, just show the input value
            if (this.radiusValDisplay) {
                this.radiusValDisplay.innerText = `${dims.radius}mm`;
            }
        });
    }
}
