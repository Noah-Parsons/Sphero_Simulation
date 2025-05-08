// OrbitControls.js - This is a simplified version based on THREE.OrbitControls
// Original source: https://github.com/mrdoob/three.js/blob/master/examples/jsm/controls/OrbitControls.js

class OrbitControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        
        // API
        this.enabled = true;
        this.target = new THREE.Vector3();
        
        this.enableZoom = true;
        this.zoomSpeed = 1.0;
        
        this.enableRotate = true;
        this.rotateSpeed = 1.0;
        
        this.enablePan = true;
        this.panSpeed = 1.0;
        
        this.minDistance = 0;
        this.maxDistance = Infinity;
        
        // Internals
        this.position0 = this.camera.position.clone();
        this.target0 = this.target.clone();
        this.zoom0 = this.camera.zoom;
        
        // State
        this.STATE = { NONE: -1, ROTATE: 0, DOLLY: 1, PAN: 2 };
        this.state = this.STATE.NONE;
        
        // Mouse buttons
        this.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
        
        // Current position in spherical coordinates
        this.spherical = new THREE.Spherical();
        this.sphericalDelta = new THREE.Spherical();
        
        this.scale = 1;
        this.panOffset = new THREE.Vector3();
        this.zoomChanged = false;
        
        // Event handlers
        this.rotateStart = new THREE.Vector2();
        this.rotateEnd = new THREE.Vector2();
        this.rotateDelta = new THREE.Vector2();
        
        this.panStart = new THREE.Vector2();
        this.panEnd = new THREE.Vector2();
        this.panDelta = new THREE.Vector2();
        
        this.dollyStart = new THREE.Vector2();
        this.dollyEnd = new THREE.Vector2();
        this.dollyDelta = new THREE.Vector2();
        
        // Event listeners
        this.domElement.addEventListener('contextmenu', this.onContextMenu.bind(this), false);
        this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this), false);
        
        this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), false);
        this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), false);
        this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), false);
        
        this.domElement.addEventListener('keydown', this.onKeyDown.bind(this), false);
        
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        
        // Initial update
        this.update();
    }
    
    getPolarAngle() {
        return this.spherical.phi;
    }
    
    getAzimuthalAngle() {
        return this.spherical.theta;
    }
    
    saveState() {
        this.position0.copy(this.camera.position);
        this.target0.copy(this.target);
        this.zoom0 = this.camera.zoom;
    }
    
    reset() {
        this.camera.position.copy(this.position0);
        this.target.copy(this.target0);
        this.camera.zoom = this.zoom0;
        
        this.camera.updateProjectionMatrix();
        this.update();
        
        this.state = this.STATE.NONE;
    }
    
    update() {
        const offset = new THREE.Vector3();
        const quat = new THREE.Quaternion().setFromUnitVectors(this.camera.up, new THREE.Vector3(0, 1, 0));
        const quatInverse = quat.clone().invert();
        
        offset.copy(this.camera.position).sub(this.target);
        offset.applyQuaternion(quat);
        
        // angle from z-axis around y-axis
        this.spherical.setFromVector3(offset);
        
        this.spherical.theta += this.sphericalDelta.theta;
        this.spherical.phi += this.sphericalDelta.phi;
        
        // restrict phi to be between desired limits
        this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));
        this.spherical.makeSafe();
        
        this.spherical.radius *= this.scale;
        
        // restrict radius to be between desired limits
        this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
        
        // move target to panned location
        this.target.add(this.panOffset);
        
        offset.setFromSpherical(this.spherical);
        offset.applyQuaternion(quatInverse);
        
        this.camera.position.copy(this.target).add(offset);
        this.camera.lookAt(this.target);
        
        // reset changes
        this.sphericalDelta.set(0, 0, 0);
        this.panOffset.set(0, 0, 0);
        this.scale = 1;
        
        return true;
    }
    
    // Event handlers
    onMouseDown(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        this.domElement.focus ? this.domElement.focus() : window.focus();
        
        switch (event.button) {
            case this.mouseButtons.LEFT:
                this.state = this.STATE.ROTATE;
                this.rotateStart.set(event.clientX, event.clientY);
                break;
            case this.mouseButtons.MIDDLE:
                this.state = this.STATE.DOLLY;
                this.dollyStart.set(event.clientX, event.clientY);
                break;
            case this.mouseButtons.RIGHT:
                this.state = this.STATE.PAN;
                this.panStart.set(event.clientX, event.clientY);
                break;
        }
        
        if (this.state !== this.STATE.NONE) {
            document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
            document.addEventListener('mouseup', this.onMouseUp.bind(this), false);
        }
    }
    
    onMouseMove(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        switch (this.state) {
            case this.STATE.ROTATE:
                if (!this.enableRotate) return;
                this.rotateEnd.set(event.clientX, event.clientY);
                this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart);
                
                // Rotating across the whole screen goes 360 degrees around
                this.sphericalDelta.theta -= 2 * Math.PI * this.rotateDelta.x / this.domElement.clientWidth * this.rotateSpeed;
                
                // Rotating up and down along the whole screen attempts to go 180 degrees
                this.sphericalDelta.phi -= 2 * Math.PI * this.rotateDelta.y / this.domElement.clientHeight * this.rotateSpeed;
                
                this.rotateStart.copy(this.rotateEnd);
                break;
                
            case this.STATE.DOLLY:
                if (!this.enableZoom) return;
                this.dollyEnd.set(event.clientX, event.clientY);
                this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);
                
                if (this.dollyDelta.y > 0) {
                    this.dollyIn(this.getZoomScale());
                } else if (this.dollyDelta.y < 0) {
                    this.dollyOut(this.getZoomScale());
                }
                
                this.dollyStart.copy(this.dollyEnd);
                break;
                
            case this.STATE.PAN:
                if (!this.enablePan) return;
                this.panEnd.set(event.clientX, event.clientY);
                this.panDelta.subVectors(this.panEnd, this.panStart);
                this.pan(this.panDelta.x, this.panDelta.y);
                this.panStart.copy(this.panEnd);
                break;
        }
        
        this.update();
    }
    
    onMouseUp(event) {
        if (!this.enabled) return;
        
        document.removeEventListener('mousemove', this.onMouseMove.bind(this), false);
        document.removeEventListener('mouseup', this.onMouseUp.bind(this), false);
        
        this.state = this.STATE.NONE;
    }
    
    onMouseWheel(event) {
        if (!this.enabled || !this.enableZoom || (this.state !== this.STATE.NONE && this.state !== this.STATE.ROTATE)) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        if (event.deltaY < 0) {
            this.dollyOut(this.getZoomScale());
        } else if (event.deltaY > 0) {
            this.dollyIn(this.getZoomScale());
        }
        
        this.update();
    }
    
    onKeyDown(event) {
        if (!this.enabled || !this.enableKeys || !this.enablePan) return;
        
        switch (event.keyCode) {
            case 38: // up
            case 87: // w
                this.pan(0, this.keyPanSpeed);
                this.update();
                break;
                
            case 37: // left
            case 65: // a
                this.pan(this.keyPanSpeed, 0);
                this.update();
                break;
                
            case 40: // down
            case 83: // s
                this.pan(0, -this.keyPanSpeed);
                this.update();
                break;
                
            case 39: // right
            case 68: // d
                this.pan(-this.keyPanSpeed, 0);
                this.update();
                break;
        }
    }
    
    onTouchStart(event) {
        if (!this.enabled) return;
        
        switch (event.touches.length) {
            case 1: // one-fingered touch: rotate
                if (!this.enableRotate) return;
                
                this.state = this.STATE.ROTATE;
                this.rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);
                break;
                
            case 2: // two-fingered touch: dolly-pan
                if (!this.enableZoom && !this.enablePan) return;
                
                // For simplicity, we'll just use the center point for panning
                this.panStart.set(
                    (event.touches[0].pageX + event.touches[1].pageX) / 2,
                    (event.touches[0].pageY + event.touches[1].pageY) / 2
                );
                break;
                
            default:
                this.state = this.STATE.NONE;
        }
    }
    
    onTouchMove(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        switch (event.touches.length) {
            case 1: // one-fingered touch: rotate
                if (!this.enableRotate) return;
                if (this.state !== this.STATE.ROTATE) return;
                
                this.rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);
                this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart);
                
                // Rotating across the whole screen goes 360 degrees around
                this.sphericalDelta.theta -= 2 * Math.PI * this.rotateDelta.x / this.domElement.clientWidth * this.rotateSpeed;
                
                // Rotating up and down along the whole screen attempts to go 180 degrees
                this.sphericalDelta.phi -= 2 * Math.PI * this.rotateDelta.y / this.domElement.clientHeight * this.rotateSpeed;
                
                this.rotateStart.copy(this.rotateEnd);
                
                this.update();
                break;
                
            case 2: // two-fingered touch: dolly-pan
                if (!this.enableZoom && !this.enablePan) return;
                
                // For simplicity, we'll just use the center point for panning
                this.panEnd.set(
                    (event.touches[0].pageX + event.touches[1].pageX) / 2,
                    (event.touches[0].pageY + event.touches[1].pageY) / 2
                );
                
                this.panDelta.subVectors(this.panEnd, this.panStart);
                this.pan(this.panDelta.x, this.panDelta.y);
                
                this.panStart.copy(this.panEnd);
                
                this.update();
                break;
                
            default:
                this.state = this.STATE.NONE;
        }
    }
    
    onTouchEnd(event) {
        if (!this.enabled) return;
        
        this.state = this.STATE.NONE;
    }
    
    onContextMenu(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
    }
    
    onWindowResize() {
        if (this.domElement === document) {
            this.screen.left = 0;
            this.screen.top = 0;
            this.screen.width = window.innerWidth;
            this.screen.height = window.innerHeight;
        } else {
            const box = this.domElement.getBoundingClientRect();
            const d = this.domElement.ownerDocument.documentElement;
            this.screen.left = box.left + window.pageXOffset - d.clientLeft;
            this.screen.top = box.top + window.pageYOffset - d.clientTop;
            this.screen.width = box.width;
            this.screen.height = box.height;
        }
    }
    
    // Helpers
    getZoomScale() {
        return Math.pow(0.95, this.zoomSpeed);
    }
    
    rotateLeft(angle) {
        this.sphericalDelta.theta -= angle;
    }
    
    rotateUp(angle) {
        this.sphericalDelta.phi -= angle;
    }
    
    dollyIn(dollyScale) {
        this.scale /= dollyScale;
    }
    
    dollyOut(dollyScale) {
        this.scale *= dollyScale;
    }
    
    pan(deltaX, deltaY) {
        const offset = new THREE.Vector3();
        const element = this.domElement === document ? this.domElement.body : this.domElement;
        
        if (this.camera instanceof THREE.PerspectiveCamera) {
            // perspective
            const position = this.camera.position;
            offset.copy(position).sub(this.target);
            let targetDistance = offset.length();
            
            // half of the fov is center to top of screen
            targetDistance *= Math.tan((this.camera.fov / 2) * Math.PI / 180.0);
            
            // we use only clientHeight here so aspect ratio does not distort speed
            this.panLeft(2 * deltaX * targetDistance / element.clientHeight, this.camera.matrix);
            this.panUp(2 * deltaY * targetDistance / element.clientHeight, this.camera.matrix);
        } else if (this.camera instanceof THREE.OrthographicCamera) {
            // orthographic
            this.panLeft(deltaX * (this.camera.right - this.camera.left) / this.camera.zoom / element.clientWidth, this.camera.matrix);
            this.panUp(deltaY * (this.camera.top - this.camera.bottom) / this.camera.zoom / element.clientHeight, this.camera.matrix);
        } else {
            // camera neither orthographic nor perspective
            console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
            this.enablePan = false;
        }
    }
    
    panLeft(distance, matrix) {
        const v = new THREE.Vector3();
        v.setFromMatrixColumn(matrix, 0); // get X column of matrix
        v.multiplyScalar(-distance);
        this.panOffset.add(v);
    }
    
    panUp(distance, matrix) {
        const v = new THREE.Vector3();
        v.setFromMatrixColumn(matrix, 1); // get Y column of matrix
        v.multiplyScalar(distance);
        this.panOffset.add(v);
    }
    
    dispose() {
        this.domElement.removeEventListener('contextmenu', this.onContextMenu, false);
        this.domElement.removeEventListener('mousedown', this.onMouseDown, false);
        this.domElement.removeEventListener('wheel', this.onMouseWheel, false);
        
        this.domElement.removeEventListener('touchstart', this.onTouchStart, false);
        this.domElement.removeEventListener('touchend', this.onTouchEnd, false);
        this.domElement.removeEventListener('touchmove', this.onTouchMove, false);
        
        document.removeEventListener('mousemove', this.onMouseMove, false);
        document.removeEventListener('mouseup', this.onMouseUp, false);
        
        window.removeEventListener('keydown', this.onKeyDown, false);
    }
}