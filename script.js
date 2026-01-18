/* ═══════════════════════════════════════════════════════════════
   DEV PORTFOLIO - Interactive Scripts
   Now integrated with 3D scene
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize features that work in both 2D and 3D modes
    initTypingEffect();
    initGlitchOnHover();
    initTerminalEffects();
    initNavHUD();

    // Note: Gyroscope controls are now handled by camera-controls.js for 3D
    // Scroll animations removed - not needed in 3D mode
});

/* ═══ Typing Effect ═══ */
function initTypingEffect() {
    const typingElements = document.querySelectorAll('.typing');

    typingElements.forEach(el => {
        const text = el.textContent;
        el.textContent = '';
        el.style.opacity = '1';

        let i = 0;
        const speed = 80;

        function type() {
            if (i < text.length) {
                el.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }

        // Start typing after entry animation (longer delay for 3D)
        setTimeout(type, 3500);
    });
}

/* ═══ Glitch Effect on Hover ═══ */
function initGlitchOnHover() {
    const glitchElements = document.querySelectorAll('.glitch');

    glitchElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            el.style.animation = 'none';
            // Force reflow
            el.offsetHeight;
            el.style.animation = '';
        });
    });
}

/* ═══ Terminal Effects ═══ */
function initTerminalEffects() {
    // Random "typing" effect on project items hover
    const projectItems = document.querySelectorAll('.project-item');

    projectItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
            item.style.background = 'rgba(137, 180, 250, 0.05)';
            item.style.transition = 'background 0.2s ease';
        });

        item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
        });
    });

    // Skill card hover effects
    const skillCards = document.querySelectorAll('.skill-card');

    skillCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.borderColor = 'var(--accent-primary)';
            card.style.boxShadow = '0 0 15px rgba(137, 180, 250, 0.2)';
        });

        card.addEventListener('mouseleave', () => {
            card.style.borderColor = 'var(--surface1)';
            card.style.boxShadow = 'none';
        });
    });
}

/* ═══ Navigation HUD ═══ */
function initNavHUD() {
    const navButtons = document.querySelectorAll('.nav-btn');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const direction = btn.dataset.direction;

            // Update active state
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Call camera controls if available
            if (window.portfolioScene && window.portfolioScene.controls) {
                const controls = window.portfolioScene.controls;

                switch (direction) {
                    case 'front':
                        controls.lookAtFront();
                        addTerminalFeedback('look --front');
                        break;
                    case 'left':
                        controls.lookAtLeft();
                        addTerminalFeedback('look --left');
                        break;
                    case 'right':
                        controls.lookAtRight();
                        addTerminalFeedback('look --right');
                        break;
                    case 'back':
                        controls.lookAtBack();
                        addTerminalFeedback('look --back');
                        break;
                }
            }
        });
    });

    // Set initial active state
    const frontBtn = document.querySelector('.nav-btn[data-direction="front"]');
    if (frontBtn) frontBtn.classList.add('active');
}

/* ═══ Terminal Feedback ═══ */
function addTerminalFeedback(command) {
    // Create temporary feedback element
    const feedback = document.createElement('div');
    feedback.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 20px;
        background: var(--crust, #11111b);
        border: 1px solid var(--surface0, #313244);
        padding: 0.5rem 1rem;
        border-radius: 4px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.8rem;
        color: var(--green, #a6e3a1);
        z-index: 1000;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.3s ease, transform 0.3s ease;
    `;
    feedback.innerHTML = `<span style="color: var(--blue, #89b4fa);">$</span> ${command}`;

    document.body.appendChild(feedback);

    // Animate in
    requestAnimationFrame(() => {
        feedback.style.opacity = '1';
        feedback.style.transform = 'translateY(0)';
    });

    // Remove after delay
    setTimeout(() => {
        feedback.style.opacity = '0';
        feedback.style.transform = 'translateY(10px)';
        setTimeout(() => feedback.remove(), 300);
    }, 1500);
}

// Make addTerminalFeedback globally available for camera-controls.js
window.addTerminalFeedback = addTerminalFeedback;

/* ═══ Console Easter Egg ═══ */
console.log(`
%c
    ┌─────────────────────────────────────┐
    │                                     │
    │   Welcome to the console, hacker.   │
    │                                     │
    │   > You found the easter egg        │
    │   > Drag mouse or tilt device       │
    │   > to look around the 3D space     │
    │                                     │
    └─────────────────────────────────────┘
`, 'color: #89b4fa; font-family: monospace;');

/* ═══ Keyboard Shortcuts for 3D Navigation ═══ */
document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const controls = window.portfolioScene?.controls;

    switch (e.key) {
        case '1':
            // Look at front (hero)
            if (controls) {
                controls.lookAtFront();
                updateNavActive('front');
                addTerminalFeedback('goto panel[0]');
            }
            break;
        case '2':
            // Look at left (skills)
            if (controls) {
                controls.lookAtLeft();
                updateNavActive('left');
                addTerminalFeedback('goto panel[1]');
            }
            break;
        case '3':
            // Look at right (projects)
            if (controls) {
                controls.lookAtRight();
                updateNavActive('right');
                addTerminalFeedback('goto panel[2]');
            }
            break;
        case '4':
            // Look at back (stats)
            if (controls) {
                controls.lookAtBack();
                updateNavActive('back');
                addTerminalFeedback('goto panel[3]');
            }
            break;
        case 'Escape':
            // Reset to front
            if (controls) {
                controls.lookAtFront();
                updateNavActive('front');
                addTerminalFeedback('reset');
            }
            break;
    }
});

function updateNavActive(direction) {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.direction === direction);
    });
}
