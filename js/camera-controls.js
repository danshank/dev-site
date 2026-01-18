/* ═══════════════════════════════════════════════════════════════
   CAMERA CONTROLS
   Unified mouse drag (desktop) + gyroscope (mobile) controls
   Camera stays at origin, only rotation changes
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';

export class CameraControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        this.enabled = false; // Disabled until entry animation completes

        // Spherical rotation (camera looks outward from origin)
        this.theta = 0;      // Horizontal angle (yaw) - radians
        this.phi = Math.PI / 2; // Vertical angle (pitch) - start at horizon

        // Target values for smooth interpolation
        this.targetTheta = 0;
        this.targetPhi = Math.PI / 2;

        // Constraints
        this.minPhi = Math.PI / 6;   // Don't look too far up (30 degrees from top)
        this.maxPhi = Math.PI * 5/6; // Don't look too far down (30 degrees from bottom)

        // Smoothing
        this.dampingFactor = 0.08;
        this.rotationSpeed = 0.003;

        // Mouse drag state
        this.isDragging = false;
        this.previousMouse = { x: 0, y: 0 };

        // Touch state
        this.previousTouch = { x: 0, y: 0 };
        this.touchStartTime = 0;

        // Gyroscope state
        this.gyroEnabled = false;
        this.gyroCalibrated = false;
        this.gyroAlphaOffset = 0;
        this.gyroBetaOffset = 0;

        // Device detection
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Initialize
        this.setupMouseControls();
        this.setupTouchControls();
        this.setupKeyboardControls();

        if (this.isMobile) {
            this.createGyroButton();
        }

        // Initial camera direction
        this.updateCameraRotation();
    }

    // ═══ MOUSE CONTROLS (Desktop) ═══

    setupMouseControls() {
        this.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.domElement.addEventListener('mouseup', () => this.onMouseUp());
        this.domElement.addEventListener('mouseleave', () => this.onMouseUp());

        // Cursor style
        this.domElement.style.cursor = 'grab';
    }

    onMouseDown(event) {
        if (!this.enabled) return;

        this.isDragging = true;
        this.previousMouse.x = event.clientX;
        this.previousMouse.y = event.clientY;
        this.domElement.style.cursor = 'grabbing';
    }

    onMouseMove(event) {
        if (!this.enabled || !this.isDragging) return;

        const deltaX = event.clientX - this.previousMouse.x;
        const deltaY = event.clientY - this.previousMouse.y;

        // Invert X so dragging left rotates view left
        // Invert Y so dragging up looks up
        this.targetTheta -= deltaX * this.rotationSpeed;
        this.targetPhi -= deltaY * this.rotationSpeed;

        // Clamp vertical rotation
        this.targetPhi = Math.max(this.minPhi, Math.min(this.maxPhi, this.targetPhi));

        this.previousMouse.x = event.clientX;
        this.previousMouse.y = event.clientY;
    }

    onMouseUp() {
        this.isDragging = false;
        this.domElement.style.cursor = 'grab';
    }

    // ═══ TOUCH CONTROLS (Mobile fallback) ═══

    setupTouchControls() {
        this.domElement.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.domElement.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.domElement.addEventListener('touchend', () => this.onTouchEnd());
    }

    onTouchStart(event) {
        if (!this.enabled || this.gyroEnabled) return;
        if (event.touches.length !== 1) return;

        event.preventDefault();
        this.touchStartTime = Date.now();
        this.previousTouch.x = event.touches[0].clientX;
        this.previousTouch.y = event.touches[0].clientY;
    }

    onTouchMove(event) {
        if (!this.enabled || this.gyroEnabled) return;
        if (event.touches.length !== 1) return;

        event.preventDefault();

        const touch = event.touches[0];
        const deltaX = touch.clientX - this.previousTouch.x;
        const deltaY = touch.clientY - this.previousTouch.y;

        // More sensitive on touch, invert Y so swiping up looks up
        this.targetTheta -= deltaX * this.rotationSpeed * 1.5;
        this.targetPhi -= deltaY * this.rotationSpeed * 1.5;

        this.targetPhi = Math.max(this.minPhi, Math.min(this.maxPhi, this.targetPhi));

        this.previousTouch.x = touch.clientX;
        this.previousTouch.y = touch.clientY;
    }

    onTouchEnd() {
        // Could add momentum/inertia here
    }

    // ═══ KEYBOARD CONTROLS ═══

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    onKeyDown(event) {
        if (!this.enabled) return;

        const rotateAmount = 0.1;

        switch (event.key) {
            case 'ArrowLeft':
            case 'a':
                this.targetTheta += rotateAmount;
                break;
            case 'ArrowRight':
            case 'd':
                this.targetTheta -= rotateAmount;
                break;
            case 'ArrowUp':
            case 'w':
                this.targetPhi = Math.max(this.minPhi, this.targetPhi - rotateAmount);
                break;
            case 'ArrowDown':
            case 's':
                this.targetPhi = Math.min(this.maxPhi, this.targetPhi + rotateAmount);
                break;
        }
    }

    // ═══ GYROSCOPE CONTROLS (Mobile) ═══

    createGyroButton() {
        const button = document.createElement('button');
        button.id = 'gyro-btn';
        button.innerHTML = `<span class="gyro-icon">&#x21BA;</span> Enable tilt`;
        button.className = 'gyro-button';

        button.addEventListener('click', () => this.requestGyroPermission());
        document.body.appendChild(button);

        this.gyroButton = button;
    }

    async requestGyroPermission() {
        // iOS 13+ requires explicit permission
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    this.enableGyroscope();
                } else {
                    this.showGyroFeedback('Permission denied');
                }
            } catch (error) {
                console.error('Gyroscope permission error:', error);
                this.showGyroFeedback('Error: ' + error.message);
            }
        } else if ('DeviceOrientationEvent' in window) {
            // Android and older iOS
            this.enableGyroscope();
        } else {
            this.showGyroFeedback('Not supported');
            this.gyroButton.style.display = 'none';
        }
    }

    enableGyroscope() {
        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e), true);
        this.gyroEnabled = true;
        this.updateGyroButton(true);
        this.showGyroFeedback('Tilt enabled');

        // Allow toggling
        this.gyroButton.onclick = () => {
            this.gyroEnabled = !this.gyroEnabled;
            this.updateGyroButton(this.gyroEnabled);
            this.showGyroFeedback(this.gyroEnabled ? 'Tilt ON' : 'Tilt OFF');
        };
    }

    updateGyroButton(enabled) {
        if (!this.gyroButton) return;

        if (enabled) {
            this.gyroButton.innerHTML = `<span class="gyro-icon active">&#x21BA;</span> Tilt ON`;
            this.gyroButton.classList.add('active');
        } else {
            this.gyroButton.innerHTML = `<span class="gyro-icon">&#x21BA;</span> Tilt OFF`;
            this.gyroButton.classList.remove('active');
        }
    }

    handleOrientation(event) {
        if (!this.enabled || !this.gyroEnabled) return;

        const alpha = event.alpha; // Compass direction (0-360)
        const beta = event.beta;   // Front-back tilt (-180 to 180)
        const gamma = event.gamma; // Left-right tilt (-90 to 90)

        if (alpha === null || beta === null) return;

        // Calibrate on first reading
        if (!this.gyroCalibrated) {
            this.gyroAlphaOffset = alpha;
            this.gyroBetaOffset = beta;
            this.gyroCalibrated = true;
        }

        // Convert device orientation to camera rotation
        // Alpha (compass) controls horizontal look
        const alphaRad = THREE.MathUtils.degToRad(alpha - this.gyroAlphaOffset);
        this.targetTheta = -alphaRad;

        // Beta (tilt) controls vertical look
        // Neutral position is ~45-60 degrees (phone held at angle)
        const neutralBeta = 50;
        const betaDelta = beta - neutralBeta;
        const betaRad = THREE.MathUtils.degToRad(betaDelta);
        this.targetPhi = (Math.PI / 2) + betaRad * 0.5;

        // Clamp
        this.targetPhi = Math.max(this.minPhi, Math.min(this.maxPhi, this.targetPhi));
    }

    showGyroFeedback(message) {
        // Use existing terminal feedback if available
        if (typeof addTerminalFeedback === 'function') {
            addTerminalFeedback('gyro: ' + message);
        } else {
            console.log('Gyro:', message);
        }
    }

    // ═══ UPDATE LOOP ═══

    update() {
        if (!this.enabled) return;

        // Smooth interpolation toward target
        this.theta += (this.targetTheta - this.theta) * this.dampingFactor;
        this.phi += (this.targetPhi - this.phi) * this.dampingFactor;

        this.updateCameraRotation();
    }

    updateCameraRotation() {
        // Convert spherical to Cartesian for lookAt target
        // Camera at origin, looking outward
        const lookDistance = 100;
        const x = lookDistance * Math.sin(this.phi) * Math.sin(this.theta);
        const y = lookDistance * Math.cos(this.phi);
        const z = -lookDistance * Math.sin(this.phi) * Math.cos(this.theta);

        this.camera.lookAt(x, y, z);
    }

    // ═══ PUBLIC METHODS ═══

    // Snap to look at a specific panel
    lookAt(theta, phi, instant = false) {
        this.targetTheta = theta;
        this.targetPhi = phi || Math.PI / 2;

        if (instant) {
            this.theta = this.targetTheta;
            this.phi = this.targetPhi;
            this.updateCameraRotation();
        }
    }

    // Snap to look at front (hero)
    lookAtFront(instant = false) {
        this.lookAt(0, Math.PI / 2, instant);
    }

    // Snap to look left (skills) - 60 degrees
    lookAtLeft(instant = false) {
        this.lookAt(-Math.PI / 3, Math.PI / 2, instant);
    }

    // Snap to look right (projects) - 60 degrees
    lookAtRight(instant = false) {
        this.lookAt(Math.PI / 3, Math.PI / 2, instant);
    }

    // Snap to look back (stats)
    lookAtBack(instant = false) {
        this.lookAt(Math.PI, Math.PI / 2, instant);
    }

    // Get current viewing direction name
    getCurrentDirection() {
        // Normalize theta to 0-2PI
        let normalizedTheta = this.theta % (Math.PI * 2);
        if (normalizedTheta < 0) normalizedTheta += Math.PI * 2;

        // Determine which panel we're roughly facing
        if (normalizedTheta < Math.PI / 8 || normalizedTheta > Math.PI * 15/8) {
            return 'front';
        } else if (normalizedTheta >= Math.PI / 8 && normalizedTheta < Math.PI * 3/8) {
            return 'left';
        } else if (normalizedTheta >= Math.PI * 5/8 && normalizedTheta < Math.PI * 11/8) {
            return 'back';
        } else if (normalizedTheta >= Math.PI * 13/8 && normalizedTheta < Math.PI * 15/8) {
            return 'right';
        }

        return 'unknown';
    }

    dispose() {
        this.domElement.removeEventListener('mousedown', this.onMouseDown);
        this.domElement.removeEventListener('mousemove', this.onMouseMove);
        this.domElement.removeEventListener('mouseup', this.onMouseUp);
        this.domElement.removeEventListener('touchstart', this.onTouchStart);
        this.domElement.removeEventListener('touchmove', this.onTouchMove);
        this.domElement.removeEventListener('touchend', this.onTouchEnd);

        if (this.gyroButton) {
            this.gyroButton.remove();
        }
    }
}
