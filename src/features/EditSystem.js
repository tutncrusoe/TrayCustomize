// src/features/EditSystem.js
import { store } from '../core/Store.js';

export class EditSystem {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.input = document.getElementById('global-dim-input');
        this.currentCallback = null;
        this.current3DPos = null;
        this._scrollLockListener = null;
        this._keyboardSettled = false;

        this.bindEvents();
    }

    bindEvents() {
        if (!this.input) return;

        // Listen for requests to start editing
        store.on('REQUEST_EDIT', ({ x, y, value, callback, worldPos3D, sourceElement }) => {
            this.startEditing(x, y, value, callback, worldPos3D, sourceElement);
        });

        // Input events
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.finishEditing();
            else if (e.key === 'Escape') this.cancelEditing();
        });
        this.input.addEventListener('blur', () => setTimeout(() => this.finishEditing(), 100));
        this.input.addEventListener('mousedown', (e) => e.stopPropagation());

        // Update position for 3D labels
        store.on('update3DOverlay', ({ camera, rect }) => {
            this.updatePosition(camera, rect);
        });
    }

    startEditing(x, y, val, cb, worldPos3D = null, sourceElement = null) {
        store.setEditing(true);
        this.currentCallback = cb;
        this.current3DPos = worldPos3D;
        this.currentSourceElement = sourceElement;
        this._keyboardSettled = false;

        this.input.style.display = 'block';
        this.input.value = val;

        // Position at click target (or initial 3D projection)
        this.input.style.left = `${x}px`;
        this.input.style.top = `${y}px`;

        // PRIMARY FIX: preventScroll tells the browser NOT to scroll
        // the page to bring the input into view -- eliminates the jump
        this.input.focus({ preventScroll: true });
        this.input.select();

        // SECONDARY FIX: Removed _lockScroll() as we now freeze the entire SceneManager render loop.
        // This allows native browser pinch-zoom to work as if the 3D scene is a static image.
        
        // Allow 3D position updates only after keyboard has fully animated in
        setTimeout(() => { this._keyboardSettled = true; }, 500);
    }

    finishEditing() {
        if (!store.getState().isEditing) return;
        const val = parseFloat(this.input.value);
        const cb = this.currentCallback;

        this.cleanup();

        if (!isNaN(val) && cb) {
            cb(val);
        }
    }

    cancelEditing() {
        this.cleanup();
    }

    cleanup() {
        store.setEditing(false);
        this.current3DPos = null;
        this._keyboardSettled = false;
        if (this.currentSourceElement) {
            this.currentSourceElement = null;
        }
        this.input.style.display = 'none';
        this.currentCallback = null;
    }

    updatePosition(camera, rect3D) {
        if (!store.getState().isEditing || !this.current3DPos) return;
        if (rect3D.width === 0 || rect3D.height === 0) return;
        // Don't reposition while keyboard is still animating open (avoids jitter)
        if (!this._keyboardSettled) return;

        const vector = new THREE.Vector3(this.current3DPos.x, this.current3DPos.y, this.current3DPos.z);

        // Apply rotation
        const boxGroup = this.sceneManager.boxGroup;
        if (boxGroup) vector.applyQuaternion(boxGroup.quaternion);

        vector.project(camera);

        const x = (vector.x * 0.5 + 0.5) * rect3D.width;
        const y = (-(vector.y) * 0.5 + 0.5) * rect3D.height;

        if (vector.z < 1) {
             this.input.style.display = 'block';
             this.input.style.left = `${rect3D.left + x}px`;
             this.input.style.top = `${rect3D.top + y}px`;
        } else {
             this.input.style.display = 'none';
        }
    }
}
