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
        this.isPinching = false;
        this.previousPinchDistance = 0;

        // Zoom state (FOV-based zoom)
        this.baseFov = 60;
        this.targetFov = 60;
        this.minFov = 30;  // Max zoom in
        this.maxFov = 90;  // Max zoom out
        this.zoomSpeed = 0.5;

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

    // ═══ HELPER: Check if element is interactive ═══

    isInteractiveElement(element) {
        // Special handling for popup: only interactive when .interactive class present
        const popup = element.closest('.skill-popup-3d');
        if (popup) {
            return popup.classList.contains('interactive');
        }

        // Check if the element or any parent is interactive
        const interactiveSelectors = [
            'button', 'a', 'input', 'select', 'textarea',
            '.skill-file', '.skill-btn', '.nav-btn', '.skill-popup-close',
            '.window-controls', '.dot', '.link', '.project-item a'
        ];

        for (const selector of interactiveSelectors) {
            if (element.matches && element.matches(selector)) return true;
            if (element.closest && element.closest(selector)) return true;
        }

        return false;
    }

    // ═══ MOUSE CONTROLS (Desktop) ═══

    setupMouseControls() {
        this.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.domElement.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.domElement.addEventListener('mouseleave', () => this.onMouseUp());
        this.domElement.addEventListener('wheel', (e) => this.onMouseWheel(e), { passive: false });

        // Cursor style
        this.domElement.style.cursor = 'grab';
    }

    // Find the actual interactive element at click coordinates (accounting for CSS3D transforms)
    findInteractiveElementAtPoint(x, y) {
        // List of interactive element selectors to check
        const selectors = [
            '.skill-file',
            '.skill-popup-close',
            '.nav-btn',
            '.link',
            '.project-item a',
            'button',
            'a'
        ];

        // Get all interactive elements
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                const rect = el.getBoundingClientRect();
                // Check if click is within this element's transformed bounds
                if (x >= rect.left && x <= rect.right &&
                    y >= rect.top && y <= rect.bottom) {
                    // Additional check: element must be visible
                    const style = getComputedStyle(el);
                    if (style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        parseFloat(style.opacity) > 0) {
                        return el;
                    }
                }
            }
        }
        return null;
    }

    onMouseWheel(event) {
        if (!this.enabled) return;

        event.preventDefault();

        // Scroll up = zoom in (decrease FOV), scroll down = zoom out (increase FOV)
        this.targetFov += event.deltaY * 0.05;
        this.targetFov = Math.max(this.minFov, Math.min(this.maxFov, this.targetFov));
    }

    onMouseDown(event) {
        if (!this.enabled) return;

        // Store starting position for click detection
        this.mouseDownPos = { x: event.clientX, y: event.clientY };
        this.mouseDownTime = Date.now();

        // Check if there's an interactive element at this position
        const interactiveEl = this.findInteractiveElementAtPoint(event.clientX, event.clientY);
        if (interactiveEl) {
            // Don't start dragging - this might be a click
            this.pendingClick = interactiveEl;
            return;
        }

        // Don't start drag if clicking on interactive elements (fallback check)
        if (this.isInteractiveElement(event.target)) return;

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

    onMouseUp(event) {
        // Handle pending click on interactive element
        if (this.pendingClick && event) {
            const dx = event.clientX - this.mouseDownPos.x;
            const dy = event.clientY - this.mouseDownPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const duration = Date.now() - this.mouseDownTime;

            // If it was a quick tap without much movement, trigger the click
            if (distance < 10 && duration < 300) {
                this.pendingClick.click();
            }
            this.pendingClick = null;
        }

        this.isDragging = false;
        this.domElement.style.cursor = 'grab';
    }

    // ═══ TOUCH CONTROLS (Mobile fallback) ═══

    setupTouchControls() {
        this.domElement.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.domElement.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.domElement.addEventListener('touchend', (e) => this.onTouchEnd(e));
    }

    onTouchStart(event) {
        if (!this.enabled) return;

        // Store touch start position for tap detection
        if (event.touches.length === 1) {
            this.touchStartPos = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            };
            this.touchStartTime = Date.now();

            // Check for interactive element at touch position
            const interactiveEl = this.findInteractiveElementAtPoint(
                event.touches[0].clientX,
                event.touches[0].clientY
            );
            if (interactiveEl) {
                this.pendingTap = interactiveEl;
                return; // Don't prevent default, let the tap potentially work
            }
        }

        // Don't capture touch if on interactive elements - let them handle it
        if (this.isInteractiveElement(event.target)) return;

        // Handle pinch start (two fingers)
        if (event.touches.length === 2) {
            event.preventDefault();
            this.isPinching = true;
            this.pendingTap = null; // Cancel tap on pinch
            this.previousPinchDistance = this.getPinchDistance(event.touches);
            return;
        }

        // Single touch for drag (only if gyro is off)
        if (event.touches.length === 1 && !this.gyroEnabled) {
            event.preventDefault();
            this.previousTouch.x = event.touches[0].clientX;
            this.previousTouch.y = event.touches[0].clientY;
        }
    }

    getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    onTouchMove(event) {
        if (!this.enabled) return;

        // Handle pinch zoom (two fingers)
        if (event.touches.length === 2 && this.isPinching) {
            event.preventDefault();
            const currentDistance = this.getPinchDistance(event.touches);
            const delta = currentDistance - this.previousPinchDistance;

            // Pinch out = zoom in (decrease FOV), pinch in = zoom out (increase FOV)
            this.targetFov -= delta * this.zoomSpeed * 0.1;
            this.targetFov = Math.max(this.minFov, Math.min(this.maxFov, this.targetFov));

            this.previousPinchDistance = currentDistance;
            return;
        }

        // Single touch drag (only if gyro is off)
        if (this.gyroEnabled) return;
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

    onTouchEnd(event) {
        // Handle pending tap on interactive element
        if (this.pendingTap && event && event.changedTouches.length > 0) {
            const touch = event.changedTouches[0];
            const dx = touch.clientX - this.touchStartPos.x;
            const dy = touch.clientY - this.touchStartPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const duration = Date.now() - this.touchStartTime;

            // If it was a quick tap without much movement, trigger the click
            if (distance < 15 && duration < 400) {
                this.pendingTap.click();
            }
            this.pendingTap = null;
        }

        // Reset pinch state when fingers are lifted
        if (!event || event.touches.length < 2) {
            this.isPinching = false;
        }
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
        // Alpha (compass) controls horizontal look - positive so phone points where you look
        const alphaRad = THREE.MathUtils.degToRad(alpha - this.gyroAlphaOffset);
        this.targetTheta = alphaRad;

        // Beta (tilt) controls vertical look
        // Neutral position is ~45-60 degrees (phone held at angle)
        const neutralBeta = 50;
        const betaDelta = beta - neutralBeta;
        const betaRad = THREE.MathUtils.degToRad(betaDelta);
        this.targetPhi = (Math.PI / 2) - betaRad * 0.5; // Inverted so tilting up looks up

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

        // Smooth FOV interpolation for zoom
        const currentFov = this.camera.fov;
        if (Math.abs(currentFov - this.targetFov) > 0.1) {
            this.camera.fov += (this.targetFov - currentFov) * this.dampingFactor;
            this.camera.updateProjectionMatrix();
        }

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

    // Gently nudge camera toward a skill popup position
    // position: 'top-left', 'top-right', 'bottom', or 'center'
    lookAtSkillPopup(position = 'center') {
        // Base angle for skills panel (60 degrees left)
        const baseTheta = -Math.PI / 3;

        // Small offsets based on popup position
        let thetaOffset = 0;
        let phiOffset = 0;

        switch (position) {
            case 'top-left':
                thetaOffset = -0.35; // Pan further left to center on popup
                phiOffset = -0.15;   // Slightly up
                break;
            case 'top-right':
                thetaOffset = 0.35;  // Pan further right to center on popup
                phiOffset = -0.15;   // Slightly up
                break;
            case 'bottom':
                thetaOffset = 0;
                phiOffset = 0.15;    // Slightly down
                break;
            default:
                thetaOffset = 0;
                phiOffset = 0;
        }

        this.targetTheta = baseTheta + thetaOffset;
        this.targetPhi = (Math.PI / 2) + phiOffset;

        // Clamp phi
        this.targetPhi = Math.max(this.minPhi, Math.min(this.maxPhi, this.targetPhi));
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
