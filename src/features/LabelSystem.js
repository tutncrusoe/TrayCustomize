// src/features/LabelSystem.js
import { store } from '../core/Store.js';

export class LabelSystem {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.dimContainer = document.getElementById('dim-container'); // Top View
        this.dimContainer3D = document.getElementById('dim-container-3d'); // 3D View

        this.bindEvents();
        this.updateLabels();
    }

    bindEvents() {
        store.on('dimensionsChanged', () => this.updateLabels());
        store.on('dividersChanged', () => this.updateLabels());

        // Listen to frame update for positioning
        // SceneManager emits this every frame
        store.on('update3DOverlay', ({ camera, rect }) => {
            this.update3DPositions(camera, rect);
        });
    }

    createEditableLabel(text, cb, worldPos3D = null) {
        const el = document.createElement('div');
        el.className = 'dim-label';
        el.innerText = text;

        // Simple click handler - in a full refactor, this might dispatch an EDIT_START action
        // For now, we reuse the prompt logic or simple input swap?
        // The original code used a complex `startEditing` global function.
        // We should probably replicate `startEditing` logic here or in a separate EditSystem.
        // For simplicity, let's just make them display-only or use a simple prompt for now to restore VISUAL parity.
        // To restore full functionality, we need the Edit logic.
        // I'll assume we want at least visual parity first.

        // Let's implement a basic click-to-edit if needed, but the main goal is rendering.
        // To support editing, I'd need to bring back `startEditing` logic which was in `index.html`.
        // Let's create a minimal handler that emits an event `REQUEST_EDIT`.
        // But we don't have an EditSystem.
        // Let's stick to visual rendering.

        if (worldPos3D) {
            el.dataset.worldPos = JSON.stringify(worldPos3D);
            el.classList.add('dim-label-3d');
        }

        // Edit Handler
        const handler = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const r = el.getBoundingClientRect();
            // Emit event to request Global Input to appear
            store.emit('REQUEST_EDIT', {
                x: r.left + r.width/2,
                y: r.top + r.height/2,
                value: parseFloat(text),
                callback: cb,
                worldPos3D: worldPos3D
            });
        };
        el.addEventListener('mousedown', handler);
        el.addEventListener('touchstart', handler);

        return el;
    }

    updateLabels() {
        this.dimContainer.innerHTML = '';
        this.dimContainer3D.innerHTML = '';

        const state = store.getState();
        const { l, w, h } = state.dimensions;
        const { x: dX, z: dZ } = state.dividers;

        // --- Top View Labels ---
        // We need SceneManager's frustum/rect to calculate position?
        // Or we can rely on `sceneManager.getTopWorldCoords` inverse?
        // Original code used `rect` from `viewTop`.
        const rect = document.getElementById('view-top-placeholder').getBoundingClientRect();
        if (rect.width === 0) return; // Hidden

        const aspect = rect.width / rect.height;
        // Need Frustum Size. SceneManager has it.
        // We can access it via sceneManager instance since we passed it in.
        const frustum = this.sceneManager.frustumSize;

        const w2pX = (wx) => rect.left + rect.width/2 + (wx / (frustum * aspect / 2)) * (rect.width/2);
        const w2pZ = (wz) => rect.top + rect.height/2 + (wz / (frustum / 2)) * (rect.height/2);

        const sortedX = [-l/2, ...[...dX].sort((a,b) => a-b), l/2];
        for(let i=0; i < sortedX.length - 1; i++) {
            const dist = sortedX[i+1] - sortedX[i];
            if(dist < 1) continue;

            const segmentStart = sortedX[i];
            const segmentEnd = sortedX[i+1];

            const cb = (nd) => {
                const diff = nd - dist;
                store.setDimensions({ l: l + diff });

                const newX = dX.map(d => {
                    if (d <= segmentStart + 0.001) return d - diff/2;
                    if (d >= segmentEnd - 0.001) return d + diff/2;
                    return d;
                });
                store.updateDividers('x', newX);
            };

            const el = this.createEditableLabel(Math.round(dist), cb);
            el.style.left = `${w2pX((sortedX[i] + sortedX[i+1]) / 2)}px`;
            el.style.top = `${w2pZ(-w/2) - 25}px`;
            el.style.transform = 'translateX(-50%)';
            this.dimContainer.appendChild(el);
        }

        const sortedZ = [-w/2, ...[...dZ].sort((a,b) => a-b), w/2];
        for(let i=0; i < sortedZ.length - 1; i++) {
            const dist = sortedZ[i+1] - sortedZ[i];
            if(dist < 1) continue;

            const segmentStart = sortedZ[i];
            const segmentEnd = sortedZ[i+1];

            const cb = (nd) => {
                const diff = nd - dist;
                store.setDimensions({ w: w + diff });

                const newZ = dZ.map(d => {
                    if (d <= segmentStart + 0.001) return d - diff/2;
                    if (d >= segmentEnd - 0.001) return d + diff/2;
                    return d;
                });
                store.updateDividers('z', newZ);
            };

            const el = this.createEditableLabel(Math.round(dist), cb);
            el.style.left = `${w2pX(-l/2) - 35}px`;
            el.style.top = `${w2pZ((sortedZ[i] + sortedZ[i+1]) / 2)}px`;
            el.style.transform = 'translateY(-50%)';
            this.dimContainer.appendChild(el);
        }

        // --- 3D View Labels ---
        // Labels for L, W, H
        const labels3D = [
            { text: Math.round(l), pos: new THREE.Vector3(0, -h/2 - 10, w/2 + 10), axis: 'l' },
            { text: Math.round(w), pos: new THREE.Vector3(l/2 + 15, -h/2 - 10, 0), axis: 'w' },
            { text: Math.round(h), pos: new THREE.Vector3(-l/2 - 15, 0, w/2 + 15), axis: 'h' }
        ];

        labels3D.forEach((info) => {
            const cb = (nv) => {
                store.setDimensions({ [info.axis]: nv });
                store.emit('dimensionsCommitted');
            };
            const el = this.createEditableLabel(info.text, cb, info.pos);
            el.id = `label-3d-${info.axis}`;
            this.dimContainer3D.appendChild(el);
        });
    }

    update3DPositions(camera, rect3D) {
        if (rect3D.width === 0 || rect3D.height === 0) return;

        const labels = this.dimContainer3D.querySelectorAll('.dim-label-3d');
        const boxGroup = this.sceneManager.boxGroup;

        labels.forEach(el => {
            // If editing, logic might pause, but we check Store.isEditing in SceneManager loop usually?
            // Original code: update3DLabels executed every frame WITHOUT isEditing guard.

            const worldPos = JSON.parse(el.dataset.worldPos);
            const vector = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);

            // Apply box rotation
            if (boxGroup) vector.applyQuaternion(boxGroup.quaternion);

            vector.project(camera);

            const x = rect3D.left + (vector.x * 0.5 + 0.5) * rect3D.width;
            const y = rect3D.top + (-(vector.y) * 0.5 + 0.5) * rect3D.height;

            if (vector.z < 1) {
                el.style.display = 'block';
                el.style.left = `${x}px`;
                el.style.top = `${y}px`;
                el.style.transform = 'translate(-50%, -50%)';
            } else {
                el.style.display = 'none';
            }
        });
    }
}
