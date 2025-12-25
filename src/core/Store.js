import { EventBus } from './EventBus.js';

export class Store extends EventBus {
    constructor() {
        super();
        this.state = {
            dimensions: {
                l: 120,
                w: 120,
                h: 40,
                radius: 8
            },
            dividers: {
                x: [],
                z: []
            },
            hiddenSegments: {},
            isEditing: false,
            mobileView: '3d', // '3d' or 'top'
            tutorialStep: 0
        };
    }

    setDimensions(newDims) {
        this.state.dimensions = { ...this.state.dimensions, ...newDims };
        this.emit('dimensionsChanged', this.state.dimensions);
    }

    addDivider(axis, pos) {
        if (axis === 'x') {
            this.state.dividers.x.push(pos);
            this.state.dividers.x.sort((a, b) => a - b);
        } else {
            this.state.dividers.z.push(pos);
            this.state.dividers.z.sort((a, b) => a - b);
        }
        this.emit('dividersChanged', this.state.dividers);
    }

    updateDividers(axis, newDividers) {
        if (axis === 'x') {
            this.state.dividers.x = newDividers;
            this.state.dividers.x.sort((a, b) => a - b);
        } else {
            this.state.dividers.z = newDividers;
            this.state.dividers.z.sort((a, b) => a - b);
        }
        this.emit('dividersChanged', this.state.dividers);
    }

    setHiddenSegments(segments) {
        this.state.hiddenSegments = segments;
        this.emit('hiddenSegmentsChanged', this.state.hiddenSegments);
    }

    setEditing(isEditing) {
        this.state.isEditing = isEditing;
        this.emit('editingStateChanged', this.state.isEditing);
    }

    setMobileView(view) {
        this.state.mobileView = view;
        this.emit('mobileViewChanged', this.state.mobileView);
    }

    getState() {
        return this.state;
    }
}

export const store = new Store();
