// src/features/InputSystem.js
import { store } from '../core/Store.js';

export class InputSystem {
    constructor(sceneManager, container) {
        this.sceneManager = sceneManager;
        this.container = container;

        this.bindEvents();
    }

    bindEvents() {
        this.container.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));

        this.container.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.container.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.container.addEventListener('touchend', (e) => this.onTouchEnd(e));
    }

    getCoords(e) {
        if (e.touches && e.touches.length > 0) {
            return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
        }
        return { clientX: e.clientX, clientY: e.clientY };
    }

    getWorldCoords(e) {
        const { clientX, clientY } = this.getCoords(e);
        return this.sceneManager.getTopWorldCoords(clientX, clientY);
    }

    onMouseDown(e) {
        if (store.getState().isEditing) return;
        const world = this.getWorldCoords(e);
        const { clientX, clientY } = this.getCoords(e);

        store.emit('POINTER_DOWN', {
            world,
            client: { x: clientX, y: clientY },
            originalEvent: e
        });
    }

    onMouseMove(e) {
        if (store.getState().isEditing) return;
        // Optimization: Only calc world coords if we are interacting or over the container
        // But for drag, we need global move.
        // We can just emit client coords globally, and let listeners ask for world if needed?
        // Or checking target?
        // Let's rely on SceneManager logic inside the event handler.

        const { clientX, clientY } = this.getCoords(e);
        // Note: SceneManager.getTopWorldCoords works based on container bounding rect.
        const world = this.sceneManager.getTopWorldCoords(clientX, clientY);

        store.emit('POINTER_MOVE', {
            world,
            client: { x: clientX, y: clientY },
            originalEvent: e
        });
    }

    onMouseUp(e) {
        store.emit('POINTER_UP', { originalEvent: e });
    }

    onTouchStart(e) {
        if (store.getState().isEditing) return;
        // e.preventDefault(); // Prevent scroll? Maybe handled by CSS touch-action
        const world = this.getWorldCoords(e);
        const { clientX, clientY } = this.getCoords(e);

        store.emit('POINTER_DOWN', {
            world,
            client: { x: clientX, y: clientY },
            isTouch: true
        });
    }

    onTouchMove(e) {
        if (store.getState().isEditing) return;
        // e.preventDefault();
        const world = this.getWorldCoords(e);
        const { clientX, clientY } = this.getCoords(e);

        store.emit('POINTER_MOVE', {
            world,
            client: { x: clientX, y: clientY },
            isTouch: true
        });
    }

    onTouchEnd(e) {
        store.emit('POINTER_UP', { isTouch: true });
    }
}
