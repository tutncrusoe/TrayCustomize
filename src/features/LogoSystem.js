import { store } from '../core/Store.js';
import { processLogo, createTextLogo } from '../utils/ImageProcessor.js';

export class LogoSystem {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.logoMesh = null;
        this.raycaster = new THREE.Raycaster();
        this.isDragging = false;
        this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Horizontal plane for intersection

        this.init();
    }

    init() {
        store.on('logoChanged', (logo) => this.updateLogo(logo));
        store.on('colorThemeChanged', () => this.refreshLogoColor());
        store.on('logoPositionChanged', ({ x, z }) => this.updateMeshPosition(x, z));
        store.on('modelRegenerated', () => this.reattachLogo());

        // Listen to scene updates to ensure logo stays attached if needed (though parenting handles this)
        // Bind input events for dragging
        const canvas = document.getElementById('main-canvas');
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mouseup', () => this.onMouseUp());
        canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        canvas.addEventListener('touchend', () => this.onMouseUp());
    }

    async updateLogo(logo) {
        if (!logo) {
            if (this.logoMesh) {
                this.logoMesh.parent.remove(this.logoMesh);
                this.logoMesh = null;
            }
            return;
        }

        const theme = store.getState().colorTheme;
        let dataUrl;

        if (logo.type === 'text') {
            dataUrl = createTextLogo(logo.data, theme);
        } else {
            try {
                dataUrl = await processLogo(logo.data, theme);
            } catch (e) {
                console.error("Failed to process logo", e);
                return;
            }
        }

        const texture = new THREE.TextureLoader().load(dataUrl);
        // Fix texture wrapping/premultiply if needed
        texture.anisotropy = 16;

        if (this.logoMesh) {
            this.logoMesh.material.map = texture;
            this.logoMesh.material.needsUpdate = true;
        } else {
            const geometry = new THREE.PlaneGeometry(40, 40); // Default size 40x40
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide,
                depthTest: false // Ensure it renders on top if close
            });
            // Better: use polygon offset or just lift slightly
            material.polygonOffset = true;
            material.polygonOffsetFactor = -1;

            this.logoMesh = new THREE.Mesh(geometry, material);
            this.logoMesh.rotation.x = -Math.PI / 2; // Flat on ground

            // Add to the tray group. We need to find the main mesh group.
            // SceneManager creates `this.modelGroup`. We need access to it.
            // Assuming sceneManager exposes it or we can find it.
            if (this.sceneManager.modelGroup) {
                this.sceneManager.modelGroup.add(this.logoMesh);

                // Set initial position
                const { dimensions } = store.getState();
                const yPos = -dimensions.h / 2 + 2 + 0.2; // 2mm base + 0.2 offset

                // Default to top-left if x/z not provided
                // Top-Left in this coordinate system?
                // X is Length (-L/2 to L/2), Z is Width (-W/2 to W/2).
                // "Top Left" usually means Min X, Min Z (or Max Z depending on orientation).
                // Let's assume Top-Left corresponds to -X, -Z.

                let startX = logo.x;
                let startZ = logo.z;

                if (startX === undefined || startZ === undefined) {
                    const margin = 25; // 20 (half logo) + 5 padding
                    startX = -dimensions.l / 2 + margin;
                    startZ = -dimensions.w / 2 + margin;

                    // Update store so it persists
                    store.updateLogoPosition(startX, startZ);
                }

                this.logoMesh.position.set(startX || 0, yPos, startZ || 0);
            }
        }
    }

    async refreshLogoColor() {
        const logo = store.getState().logo;
        if (logo) {
            await this.updateLogo(logo);
        }
    }

    updateMeshPosition(x, z) {
        if (this.logoMesh) {
            this.logoMesh.position.x = x;
            this.logoMesh.position.z = z;
        }
    }

    reattachLogo() {
        if (this.logoMesh && this.sceneManager.modelGroup) {
             // Check if already attached
             if (this.logoMesh.parent !== this.sceneManager.modelGroup) {
                 this.sceneManager.modelGroup.add(this.logoMesh);
             }
        } else if (store.getState().logo && !this.logoMesh) {
             // If mesh was destroyed but state exists (unlikely with current logic but safe)
             this.updateLogo(store.getState().logo);
        }
    }

    // Drag Logic
    getIntersects(event, object) {
        const rect = this.sceneManager.renderer.domElement.getBoundingClientRect();
        const clientX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
        const clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;

        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera({ x, y }, this.sceneManager.camera); // Default camera (Perspective)
        // Note: SceneManager handles multiple viewports (scissor).
        // If we are in Top View, we might need cameraTop.
        // For simplicity, let's support 3D view dragging first.
        // Todo: Check which viewport the mouse is in?

        return this.raycaster.intersectObject(object, true);
    }

    onMouseDown(e) {
        if (!this.logoMesh) return;

        const intersects = this.getIntersects(e, this.logoMesh);
        if (intersects.length > 0) {
            this.isDragging = true;
            // Disable orbit controls if possible?
            // sceneManager.controls.enabled = false;
            e.preventDefault();
        }
    }

    onMouseMove(e) {
        if (!this.isDragging || !this.logoMesh) return;

        // Raycast against a virtual horizontal plane at the logo's height
        // to find where to move.
        // Since logo is child of modelGroup, and modelGroup might be rotated?
        // Actually modelGroup is usually static, but let's be safe.
        // Easier: Raycast against the "Base" mesh of the tray.

        // Find base mesh
        const baseMesh = this.sceneManager.modelGroup?.children.find(c => c.geometry.type === 'ExtrudeGeometry' && c.position.y < 0);
        // Or just use the mathematical plane at logo height

        // Let's use the invisible mathematical plane at y = logo.y (world space)
        // We need world position of logo plane.

        const rect = this.sceneManager.renderer.domElement.getBoundingClientRect();
        const clientX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
        const clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;

        const ndc = {
            x: ((clientX - rect.left) / rect.width) * 2 - 1,
            y: -((clientY - rect.top) / rect.height) * 2 + 1
        };

        this.raycaster.setFromCamera(ndc, this.sceneManager.camera);

        // Plane at mesh height
        const worldPos = new THREE.Vector3();
        this.logoMesh.getWorldPosition(worldPos);
        this.plane.constant = -worldPos.y; // Plane equation normal.dot(P) + constant = 0

        const target = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.plane, target);

        if (target) {
            // Convert world target back to local if group is transformed?
            // Assuming group is at 0,0,0 identity for now.
            // Bounds check
            const { l, w } = store.getState().dimensions;
            const halfL = l / 2 - 20; // Margin
            const halfW = w / 2 - 20;

            const clampedX = Math.max(-halfL, Math.min(halfL, target.x));
            const clampedZ = Math.max(-halfW, Math.min(halfW, target.z));

            store.updateLogoPosition(clampedX, clampedZ);
        }
    }

    onMouseUp() {
        if (this.isDragging) {
            this.isDragging = false;
            // sceneManager.controls.enabled = true;
        }
    }

    onTouchStart(e) {
        this.onMouseDown(e);
    }

    onTouchMove(e) {
        this.onMouseMove(e);
    }
}
