import { store } from '../core/Store.js';

export class SceneManager {
    constructor(canvas, view3DContainer, viewTopContainer) {
        this.canvas = canvas;
        this.view3DContainer = view3DContainer;
        this.viewTopContainer = viewTopContainer;

        this.scene = null;
        this.renderer = null;
        this.camera3D = null;
        this.cameraTop = null;
        this.boxGroup = null;

        // Configuration
        this.frustumSize = 250;
        this.lastZoomedMaxDim = 0;

        this.init();
        this.bindEvents();
    }

    init() {
        // Scene Setup
        this.scene = new THREE.Scene();

        // Renderer Setup
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Camera Setup
        this.camera3D = new THREE.PerspectiveCamera(40, 1, 1, 1000);
        this.camera3D.position.set(160, 160, 160);
        this.camera3D.lookAt(0, 0, 0);

        this.cameraTop = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
        this.cameraTop.position.set(0, 200, 0);
        this.cameraTop.lookAt(0, 0, 0);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        const spotLight = new THREE.SpotLight(0xfff5e6, 1.0);
        spotLight.position.set(100, 250, 100);
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = 2048;
        spotLight.shadow.mapSize.height = 2048;
        spotLight.shadow.bias = -0.00005;
        this.scene.add(spotLight);

        const dirLight = new THREE.DirectionalLight(0xd4d4d8, 0.4);
        dirLight.position.set(-100, 100, -50);
        this.scene.add(dirLight);

        // Object Group
        this.boxGroup = new THREE.Group();
        this.scene.add(this.boxGroup);

        // Start Loop
        this.animate = this.animate.bind(this);
        this.animate();
    }

    bindEvents() {
        // Listen to Store changes if needed for global scene settings
        // For now, specific geometry updates will be handled by main.js or a separate controller
        // calling methods on SceneManager, but decoupling suggests listening to store.

        // We will listen for resize events
        // window.addEventListener('resize', ...) // We can handle this in the animate loop like the original code did
    }

    updateMesh(mesh) {
        // Clear existing children
        while(this.boxGroup.children.length > 0) {
            this.boxGroup.remove(this.boxGroup.children[0]);
        }
        if (mesh) {
            this.boxGroup.add(mesh);
        }
    }

    // Camera Auto-Fit Logic
    autoFitCamera() {
        const { l, w, h } = store.getState().dimensions;
        const maxDim = Math.max(l, w, h);
        const labelPadding = 60; // Padding for labels

        // Fit Top View
        const rectTop = this.viewTopContainer.getBoundingClientRect();
        if (rectTop.height > 0) {
            const aspect = rectTop.width / rectTop.height;
            this.frustumSize = Math.max(w + labelPadding, (l + labelPadding) / aspect) * 1.4;

            if (this.cameraTop) {
                this.cameraTop.left = this.frustumSize * aspect / -2;
                this.cameraTop.right = this.frustumSize * aspect / 2;
                this.cameraTop.top = this.frustumSize / 2;
                this.cameraTop.bottom = this.frustumSize / -2;
                this.cameraTop.updateProjectionMatrix();
            }
        }

        // Fit 3D View
        const rect3D = this.view3DContainer.getBoundingClientRect();
        if (rect3D.height > 0) {
            const aspect3D = rect3D.width / rect3D.height;
            const fovRad = (this.camera3D.fov * Math.PI) / 180;

            const verticalSize = (maxDim + labelPadding) * 1.4;
            let distance = (verticalSize / 2) / Math.tan(fovRad / 2);

            const horizontalSize = (maxDim + labelPadding) * 1.4;
            const distanceH = (horizontalSize / 2) / (Math.tan(fovRad / 2) * aspect3D);

            distance = Math.max(distance, distanceH);

            const direction = new THREE.Vector3(1, 1, 1).normalize();
            this.camera3D.position.copy(direction.multiplyScalar(distance));
            this.camera3D.lookAt(0, 0, 0);
        }

        this.lastZoomedMaxDim = maxDim;
    }

    checkAutoZoom() {
        const { l, w, h } = store.getState().dimensions;
        const currentMaxDim = Math.max(l, w, h);

        if (this.lastZoomedMaxDim === 0) {
            this.autoFitCamera();
        } else {
            const diff = Math.abs(currentMaxDim - this.lastZoomedMaxDim);
            if (diff / this.lastZoomedMaxDim > 0.05) {
                this.autoFitCamera();
            }
        }
    }

    animate() {
        requestAnimationFrame(this.animate);

        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.renderer.setSize(width, height, false);
            // Trigger a dimension update/repaint via event if needed?
            // In original code, updateDimensions() was called here.
            store.emit('viewportResize');
        }

        this.renderer.setScissorTest(true);
        const { isEditing } = store.getState();

        // Render 3D View
        const rect3D = this.view3DContainer.getBoundingClientRect();
        if (rect3D.width > 0 && rect3D.height > 0) {
            this.renderer.setViewport(rect3D.left, height - rect3D.bottom, rect3D.width, rect3D.height);
            this.renderer.setScissor(rect3D.left, height - rect3D.bottom, rect3D.width, rect3D.height);
            this.camera3D.aspect = rect3D.width / rect3D.height;
            this.camera3D.updateProjectionMatrix();
            this.renderer.render(this.scene, this.camera3D);

            // Notify system to update 3D labels overlay position
            store.emit('update3DOverlay', { camera: this.camera3D, rect: rect3D, object: this.boxGroup });
        }

        // Render Top View
        // Temporary rotation reset for Top View rendering
        const curRot = this.boxGroup.rotation.y;
        this.boxGroup.rotation.y = 0;
        this.boxGroup.updateMatrixWorld();

        const rectTop = this.viewTopContainer.getBoundingClientRect();
        if (rectTop.width > 0 && rectTop.height > 0) {
            this.renderer.setViewport(rectTop.left, height - rectTop.bottom, rectTop.width, rectTop.height);
            this.renderer.setScissor(rectTop.left, height - rectTop.bottom, rectTop.width, rectTop.height);

            const aspectTop = rectTop.width / rectTop.height;
            this.cameraTop.left = this.frustumSize * aspectTop / -2;
            this.cameraTop.right = this.frustumSize * aspectTop / 2;
            this.cameraTop.top = this.frustumSize / 2;
            this.cameraTop.bottom = this.frustumSize / -2;
            this.cameraTop.updateProjectionMatrix();

            this.renderer.render(this.scene, this.cameraTop);
        }

        // Restore rotation
        this.boxGroup.rotation.y = curRot;
        this.boxGroup.updateMatrixWorld();
    }

    // Helper to get World Coordinates from Screen Coordinates (for Top View)
    getTopWorldCoords(clientX, clientY) {
        const rect = this.viewTopContainer.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        const mouseX = (x / rect.width) * 2 - 1;
        const mouseY = -(y / rect.height) * 2 + 1;
        const aspect = rect.width / rect.height;

        return {
            x: mouseX * (this.frustumSize * aspect / 2),
            z: -mouseY * (this.frustumSize / 2),
            isInside: x >= 0 && x <= rect.width && y >= 0 && y <= rect.height
        };
    }
}
