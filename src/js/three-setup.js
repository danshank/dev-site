/* ═══════════════════════════════════════════════════════════════
   THREE.JS 3D PORTFOLIO SCENE
   Room/Gallery style with CSS3D panels
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from "three";
import {
	CSS3DObject,
	CSS3DRenderer,
} from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { CameraControls } from "./camera-controls.js";

/**
 * Centralized state manager for the skill popup.
 * Uses an explicit state machine to prevent timing bugs.
 */
class PopupStateManager {
	static STATES = {
		CLOSED: "closed",
		OPENING: "opening",
		OPEN: "open",
		CLOSING: "closing",
	};

	constructor(popupElement, options = {}) {
		this.element = popupElement;
		this.state = PopupStateManager.STATES.CLOSED;
		this.transitionDuration = options.transitionDuration || 150;
		this.pendingTransition = null;

		this.onStateChange = options.onStateChange || (() => {});
		this.onPositionNeeded = options.onPositionNeeded || (() => {});
	}

	getState() {
		return this.state;
	}

	isVisible() {
		return (
			this.state === PopupStateManager.STATES.OPENING ||
			this.state === PopupStateManager.STATES.OPEN
		);
	}

	isInteractive() {
		return this.state === PopupStateManager.STATES.OPEN;
	}

	open(position = "center") {
		this.cancelPendingTransition();

		const prevState = this.state;

		// If already open, just reposition
		if (this.state === PopupStateManager.STATES.OPEN) {
			this.onPositionNeeded(position);
			return;
		}

		// If closing, restart from current visual state
		if (this.state === PopupStateManager.STATES.CLOSING) {
			this.element.classList.remove("fading");
		}

		// Position before showing
		this.onPositionNeeded(position);

		// Transition to OPENING
		this.state = PopupStateManager.STATES.OPENING;
		this.element.classList.add("active");
		this.element.classList.remove("interactive");

		this.onStateChange(this.state, prevState);

		// After transition, become fully OPEN
		this.pendingTransition = setTimeout(() => {
			this.pendingTransition = null;
			if (this.state === PopupStateManager.STATES.OPENING) {
				const prev = this.state;
				this.state = PopupStateManager.STATES.OPEN;
				this.element.classList.add("interactive");
				this.onStateChange(this.state, prev);
			}
		}, this.transitionDuration);
	}

	close() {
		this.cancelPendingTransition();

		if (
			this.state === PopupStateManager.STATES.CLOSED ||
			this.state === PopupStateManager.STATES.CLOSING
		) {
			return;
		}

		const prevState = this.state;

		// Immediately remove interactivity
		this.element.classList.remove("interactive");

		// Transition to CLOSING
		this.state = PopupStateManager.STATES.CLOSING;
		this.element.classList.add("fading");

		this.onStateChange(this.state, prevState);

		// After transition, become fully CLOSED
		this.pendingTransition = setTimeout(() => {
			this.pendingTransition = null;
			if (this.state === PopupStateManager.STATES.CLOSING) {
				const prev = this.state;
				this.state = PopupStateManager.STATES.CLOSED;
				this.element.classList.remove("active", "fading");
				this.onStateChange(this.state, prev);
			}
		}, this.transitionDuration);
	}

	cancelPendingTransition() {
		if (this.pendingTransition) {
			clearTimeout(this.pendingTransition);
			this.pendingTransition = null;
		}
	}

	forceClose() {
		this.cancelPendingTransition();
		this.state = PopupStateManager.STATES.CLOSED;
		this.element.classList.remove("active", "fading", "interactive");
		this.onStateChange(this.state, null);
	}
}

class PortfolioScene {
	constructor() {
		this.camera = null;
		this.scene = null;
		this.cssScene = null;
		this.webglRenderer = null;
		this.cssRenderer = null;
		this.controls = null;
		this.panels = [];
		this.isInitialized = false;
		this.popupState = null;

		// Panel configuration
		// Panels at 60 degrees (PI/3) from front for clear separation
		const panelDistance = 800;
		const sideAngle = Math.PI / 3; // 60 degrees

		this.panelConfig = {
			hero: {
				position: new THREE.Vector3(0, 0, -panelDistance),
				rotation: new THREE.Euler(0, 0, 0),
				element: "panel-hero",
			},
			skills: {
				position: new THREE.Vector3(
					-Math.sin(sideAngle) * panelDistance,
					0,
					-Math.cos(sideAngle) * panelDistance,
				),
				rotation: new THREE.Euler(0, sideAngle, 0), // Face toward center
				element: "panel-skills",
			},
			projects: {
				position: new THREE.Vector3(
					Math.sin(sideAngle) * panelDistance,
					0,
					-Math.cos(sideAngle) * panelDistance,
				),
				rotation: new THREE.Euler(0, -sideAngle, 0), // Face toward center
				element: "panel-projects",
			},
			stats: {
				position: new THREE.Vector3(0, 0, panelDistance),
				rotation: new THREE.Euler(0, Math.PI, 0), // 180 degrees
				element: "panel-stats",
			},
		};

		this.init();
	}

	init() {
		this.createCamera();
		this.createScenes();
		this.createRenderers();
		this.createRoom();
		this.createPanels();
		this.createControls();
		this.setupEventListeners();
		this.animate();
		this.isInitialized = true;

		// Start entry animation after a brief delay
		setTimeout(() => this.playEntryAnimation(), 100);
	}

	createCamera() {
		this.camera = new THREE.PerspectiveCamera(
			60, // FOV
			window.innerWidth / window.innerHeight,
			1,
			5000,
		);
		// Camera at origin - user stands in center of room
		this.camera.position.set(0, 0, 0);
	}

	createScenes() {
		// WebGL scene for room/environment
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x11111b); // Catppuccin crust

		// CSS3D scene for HTML panels
		this.cssScene = new THREE.Scene();
	}

	createRenderers() {
		const container = document.getElementById("threejs-container");

		// WebGL renderer for environment (rendered first, behind CSS3D)
		this.webglRenderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true,
		});
		this.webglRenderer.setSize(window.innerWidth, window.innerHeight);
		this.webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.webglRenderer.domElement.style.position = "absolute";
		this.webglRenderer.domElement.style.top = "0";
		this.webglRenderer.domElement.style.left = "0";
		this.webglRenderer.domElement.style.zIndex = "1";
		container.appendChild(this.webglRenderer.domElement);

		// CSS3D renderer for HTML panels (rendered on top)
		this.cssRenderer = new CSS3DRenderer();
		this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
		this.cssRenderer.domElement.style.position = "absolute";
		this.cssRenderer.domElement.style.top = "0";
		this.cssRenderer.domElement.style.left = "0";
		this.cssRenderer.domElement.style.zIndex = "2";
		container.appendChild(this.cssRenderer.domElement);
	}

	createRoom() {
		// Ambient light
		const ambientLight = new THREE.AmbientLight(0x89b4fa, 0.3);
		this.scene.add(ambientLight);

		// Point lights at panel positions for glow effect
		const lightPositions = [
			{ pos: [0, 200, -800], color: 0x89b4fa }, // Front
			{ pos: [-700, 200, -400], color: 0xcba6f7 }, // Left
			{ pos: [700, 200, -400], color: 0xa6e3a1 }, // Right
			{ pos: [0, 200, 800], color: 0xf9e2af }, // Back
		];

		lightPositions.forEach(({ pos, color }) => {
			const light = new THREE.PointLight(color, 0.5, 1500);
			light.position.set(...pos);
			this.scene.add(light);
		});

		// Create room wireframe edges for spatial reference
		this.createRoomWireframe();

		// Floor grid
		this.createFloorGrid();
	}

	createRoomWireframe() {
		const material = new THREE.LineBasicMaterial({
			color: 0x313244, // Catppuccin surface0
			transparent: true,
			opacity: 0.5,
		});

		// Create hexagonal room outline
		const radius = 1000;
		const height = 600;
		const segments = 6;

		const points = [];
		for (let i = 0; i <= segments; i++) {
			const angle = (i / segments) * Math.PI * 2;
			points.push(
				new THREE.Vector3(
					Math.cos(angle) * radius,
					-height / 2,
					Math.sin(angle) * radius,
				),
			);
		}

		// Floor outline
		const floorGeometry = new THREE.BufferGeometry().setFromPoints(points);
		const floorLine = new THREE.Line(floorGeometry, material);
		this.scene.add(floorLine);

		// Ceiling outline
		const ceilingPoints = points.map(
			(p) => new THREE.Vector3(p.x, height / 2, p.z),
		);
		const ceilingGeometry = new THREE.BufferGeometry().setFromPoints(
			ceilingPoints,
		);
		const ceilingLine = new THREE.Line(ceilingGeometry, material);
		this.scene.add(ceilingLine);

		// Vertical pillars at corners
		for (let i = 0; i < segments; i++) {
			const angle = (i / segments) * Math.PI * 2;
			const x = Math.cos(angle) * radius;
			const z = Math.sin(angle) * radius;

			const pillarPoints = [
				new THREE.Vector3(x, -height / 2, z),
				new THREE.Vector3(x, height / 2, z),
			];
			const pillarGeometry = new THREE.BufferGeometry().setFromPoints(
				pillarPoints,
			);
			const pillar = new THREE.Line(pillarGeometry, material);
			this.scene.add(pillar);
		}
	}

	createFloorGrid() {
		const gridHelper = new THREE.GridHelper(2000, 40, 0x313244, 0x1e1e2e);
		gridHelper.position.y = -300;
		gridHelper.material.transparent = true;
		gridHelper.material.opacity = 0.3;
		this.scene.add(gridHelper);
	}

	createPanels() {
		Object.entries(this.panelConfig).forEach(([name, config]) => {
			const element = document.getElementById(config.element);
			if (!element) {
				console.warn(`Panel element not found: ${config.element}`);
				return;
			}

			// Create CSS3D object from DOM element
			const cssObject = new CSS3DObject(element);
			cssObject.position.copy(config.position);
			cssObject.rotation.copy(config.rotation);
			cssObject.name = name;

			// Store reference
			this.panels.push({
				name,
				object: cssObject,
				element,
			});

			this.cssScene.add(cssObject);

			// Initially hide for entry animation
			element.style.opacity = "0";
		});

		// Create popup panel (starts hidden)
		this.createPopupPanel();
	}

	createPopupPanel() {
		const popupElement = document.getElementById("skill-popup");
		if (!popupElement) return;

		this.popupObject = new CSS3DObject(popupElement);
		this.popupObject.name = "popup";
		this.cssScene.add(this.popupObject);

		// Store reference for updating position
		this.popupElement = popupElement;

		// Get skills panel position and rotation for reference
		const skillsConfig = this.panelConfig.skills;
		this.skillsPanelPosition = skillsConfig.position.clone();
		this.skillsPanelRotation = skillsConfig.rotation.clone();

		// Initialize state manager
		this.popupState = new PopupStateManager(popupElement, {
			transitionDuration: 150,
			onStateChange: (newState, oldState) => {
				console.debug(`Popup: ${oldState} -> ${newState}`);
			},
			onPositionNeeded: (position) => {
				this.positionPopup(position);
			},
		});
	}

	showPopup(position = "center") {
		if (!this.popupState) return;

		// Gently pan camera toward the popup position
		if (this.controls && this.controls.lookAtSkillPopup) {
			this.controls.lookAtSkillPopup(position);
		}

		this.popupState.open(position);
	}

	positionPopup(position) {
		// Get skills panel position as base
		const skillsPos = this.skillsPanelPosition;
		const sideAngle = Math.PI / 3;

		// Offset based on position (in panel's local space)
		// Local X is perpendicular to panel face, local Y is up
		let localX = 0; // Left/right relative to panel
		let localY = 0; // Up/down
		const localZ = 50; // Slightly in front of panel

		switch (position) {
			case "top-left":
				localX = -280;
				localY = 180;
				break;
			case "top-right":
				localX = 280;
				localY = 180;
				break;
			case "bottom":
				localX = 0;
				localY = -200;
				break;
			default:
				localX = 0;
				localY = 0;
		}

		// Transform local offset to world coordinates
		// Panel faces inward, so we rotate the offset by the panel's Y rotation
		const cosAngle = Math.cos(sideAngle);
		const sinAngle = Math.sin(sideAngle);

		// Local X becomes world X/Z, local Z (depth) also rotates
		const worldOffsetX = localX * cosAngle + localZ * sinAngle;
		const worldOffsetZ = -localX * sinAngle + localZ * cosAngle;

		this.popupObject.position.set(
			skillsPos.x + worldOffsetX,
			skillsPos.y + localY,
			skillsPos.z + worldOffsetZ,
		);

		// Match skills panel rotation
		this.popupObject.rotation.copy(this.skillsPanelRotation);
	}

	hidePopup() {
		if (!this.popupState) return;
		this.popupState.close();

		// Recenter camera on skills panel
		if (this.controls && this.controls.lookAtLeft) {
			this.controls.lookAtLeft();
		}
	}

	isPopupVisible() {
		return this.popupState ? this.popupState.isVisible() : false;
	}

	isPopupInteractive() {
		return this.popupState ? this.popupState.isInteractive() : false;
	}

	createControls() {
		this.controls = new CameraControls(
			this.camera,
			this.cssRenderer.domElement,
		);
	}

	setupEventListeners() {
		window.addEventListener("resize", () => this.onWindowResize());
		this.setupNavHUD();
	}

	setupNavHUD() {
		const navHUD = document.getElementById("nav-hud");
		if (!navHUD) return;

		const buttons = navHUD.querySelectorAll(".nav-btn");
		buttons.forEach((btn) => {
			btn.addEventListener("click", () => {
				const direction = btn.dataset.direction;
				if (this.controls) {
					switch (direction) {
						case "front":
							this.controls.lookAtFront();
							break;
						case "left":
							this.controls.lookAtLeft();
							break;
						case "right":
							this.controls.lookAtRight();
							break;
						case "back":
							this.controls.lookAtBack();
							break;
					}
				}
				// Update active state
				buttons.forEach((b) => b.classList.remove("active"));
				btn.classList.add("active");
			});
		});
	}

	onWindowResize() {
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();

		this.webglRenderer.setSize(window.innerWidth, window.innerHeight);
		this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
	}

	async playEntryAnimation() {
		// Boot sequence text
		const bootOverlay = document.getElementById("boot-overlay");
		if (bootOverlay) {
			await this.typeBootSequence(bootOverlay);
		}

		// Reveal panels sequentially
		const panelOrder = ["hero", "skills", "projects", "stats"];
		for (const panelName of panelOrder) {
			const panel = this.panels.find((p) => p.name === panelName);
			if (panel) {
				await this.revealPanel(panel, 300);
			}
		}

		// Hide boot overlay
		if (bootOverlay) {
			bootOverlay.style.opacity = "0";
			setTimeout(() => (bootOverlay.style.display = "none"), 500);
		}

		// Enable controls
		if (this.controls) {
			this.controls.enabled = true;
		}
	}

	async typeBootSequence(overlay) {
		const lines = [
			"> Initializing portfolio.exe...",
			"> Loading assets... [████████████] 100%",
			"> Jumping into Star Fissure...",
		];

		const textElement = overlay.querySelector(".boot-text");
		if (!textElement) return;

		for (const line of lines) {
			for (const char of line) {
				textElement.textContent += char;
				await this.sleep(20);
			}
			textElement.textContent += "\n";
			await this.sleep(300);
		}

		await this.sleep(500);
	}

	async revealPanel(panel, duration) {
		return new Promise((resolve) => {
			panel.element.style.transition = `opacity ${duration}ms ease`;
			panel.element.style.opacity = "1";
			setTimeout(resolve, duration);
		});
	}

	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	animate() {
		requestAnimationFrame(() => this.animate());

		// Update controls
		if (this.controls) {
			this.controls.update();
		}

		// Render both scenes
		this.webglRenderer.render(this.scene, this.camera);
		this.cssRenderer.render(this.cssScene, this.camera);
	}

	// Public method to get current focused panel based on camera direction
	getFocusedPanel() {
		const direction = new THREE.Vector3();
		this.camera.getWorldDirection(direction);

		let closestPanel = null;
		let closestAngle = Infinity;

		this.panels.forEach((panel) => {
			const toPanel = panel.object.position.clone().normalize();
			const angle = direction.angleTo(toPanel);

			if (angle < closestAngle && angle < Math.PI / 3) {
				// Within 60 degrees
				closestAngle = angle;
				closestPanel = panel;
			}
		});

		return closestPanel;
	}
}

// Initialize when DOM is ready
let portfolioScene = null;

function initPortfolio() {
	// Check for WebGL support
	if (!window.WebGLRenderingContext) {
		console.warn("WebGL not supported, falling back to 2D");
		document.body.classList.add("fallback-2d");
		return;
	}

	portfolioScene = new PortfolioScene();
	window.portfolioScene = portfolioScene; // Expose for debugging
}

// Export for module use
export { PortfolioScene, initPortfolio };

// Auto-init if loaded directly
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initPortfolio);
} else {
	initPortfolio();
}
