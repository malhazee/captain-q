/**
 * Input Handler Module for Captain Q HTML5
 * Responsive, ultra-low-latency Keyboard, D-Pad, and Continuous Touch Gestures
 */

class InputHandler {
    constructor(player) {
        this.player = player;
        this.initKeyboard();
        this.initTouch();
    }

    setDirection(dir) {
        if (!this.player) return;
        this.player.setNextDir(dir);

        // Visual feedback on D-Pad buttons
        document.querySelectorAll(".touch-btn").forEach(b => b.classList.remove("active-touch"));
        if (dir === DIR.NORTH) {
            const b = document.getElementById("btn_up");
            if (b) b.classList.add("active-touch");
        } else if (dir === DIR.SOUTH) {
            const b = document.getElementById("btn_down");
            if (b) b.classList.add("active-touch");
        } else if (dir === DIR.WEST) {
            const b = document.getElementById("btn_left");
            if (b) b.classList.add("active-touch");
        } else if (dir === DIR.EAST) {
            const b = document.getElementById("btn_right");
            if (b) b.classList.add("active-touch");
        }
    }

    initKeyboard() {
        window.addEventListener("keydown", (e) => {
            audio.init();

            switch (e.key) {
                case "ArrowUp":
                case "w":
                case "W":
                    this.setDirection(DIR.NORTH);
                    e.preventDefault();
                    break;
                case "ArrowDown":
                case "s":
                case "S":
                    this.setDirection(DIR.SOUTH);
                    e.preventDefault();
                    break;
                case "ArrowLeft":
                case "a":
                case "A":
                    this.setDirection(DIR.WEST);
                    e.preventDefault();
                    break;
                case "ArrowRight":
                case "d":
                case "D":
                    this.setDirection(DIR.EAST);
                    e.preventDefault();
                    break;
                case " ":
                case "1":
                    if (window.gameInstance) window.gameInstance.toggleShield();
                    e.preventDefault();
                    break;
            }
        });
    }

    initTouch() {
        const btnMap = {
            "btn_up": DIR.NORTH,
            "btn_down": DIR.SOUTH,
            "btn_left": DIR.WEST,
            "btn_right": DIR.EAST
        };

        const dpadCluster = document.querySelector(".dpad-cluster");
        let dpadTouchId = null;

        const updateDpadFromPoint = (clientX, clientY) => {
            const el = document.elementFromPoint(clientX, clientY);
            if (!el) return;
            const btn = el.closest(".touch-btn");
            if (btn && btnMap[btn.id]) {
                audio.init();
                this.setDirection(btnMap[btn.id]);
            }
        };

        // 1. Direct D-Pad Button Listeners: Instant and dedicated
        Object.keys(btnMap).forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const dir = btnMap[id];

            const onBtnDown = (e) => {
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();
                audio.init();
                this.setDirection(dir);
            };

            btn.addEventListener("touchstart", onBtnDown, { passive: false });
            btn.addEventListener("mousedown", onBtnDown);
        });

        // 2. Continuous Sliding Across D-Pad Cluster (Locked to dpadTouchId)
        if (dpadCluster) {
            dpadCluster.addEventListener("touchstart", (e) => {
                e.stopPropagation();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    dpadTouchId = t.identifier;
                    updateDpadFromPoint(t.clientX, t.clientY);
                }
            }, { passive: false });

            dpadCluster.addEventListener("touchmove", (e) => {
                e.stopPropagation();
                if (e.cancelable) e.preventDefault();
                for (let i = 0; i < e.touches.length; i++) {
                    const t = e.touches[i];
                    if (t.identifier === dpadTouchId) {
                        updateDpadFromPoint(t.clientX, t.clientY);
                        break;
                    }
                }
            }, { passive: false });

            const clearDpadActive = (e) => {
                e.stopPropagation();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === dpadTouchId) {
                        dpadTouchId = null;
                        document.querySelectorAll(".touch-btn").forEach(b => b.classList.remove("active-touch"));
                        break;
                    }
                }
            };

            dpadCluster.addEventListener("touchend", clearDpadActive, { passive: false });
            dpadCluster.addEventListener("touchcancel", clearDpadActive, { passive: false });
        }

        // 3. Smooth Screen Swipe Steering: Strictly isolated from D-Pad
        const canvas = document.getElementById("gameCanvas");
        if (!canvas) return;

        let canvasTouchId = null;
        let dragStartX = 0;
        let dragStartY = 0;
        const SWIPE_THRESHOLD = 14; // pixels

        canvas.addEventListener("touchstart", (e) => {
            if (canvasTouchId === null && e.changedTouches.length > 0) {
                const t = e.changedTouches[0];
                canvasTouchId = t.identifier;
                dragStartX = t.clientX;
                dragStartY = t.clientY;
                audio.init();
            }
        }, { passive: true });

        canvas.addEventListener("touchmove", (e) => {
            if (canvasTouchId === null) return;

            let canvasTouch = null;
            for (let i = 0; i < e.touches.length; i++) {
                if (e.touches[i].identifier === canvasTouchId) {
                    canvasTouch = e.touches[i];
                    break;
                }
            }
            if (!canvasTouch) return;

            const dx = canvasTouch.clientX - dragStartX;
            const dy = canvasTouch.clientY - dragStartY;
            const dist = Math.hypot(dx, dy);

            if (dist >= SWIPE_THRESHOLD) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.setDirection(dx > 0 ? DIR.EAST : DIR.WEST);
                } else {
                    this.setDirection(dy > 0 ? DIR.SOUTH : DIR.NORTH);
                }
                // Reset anchor for continuous steering without lifting finger
                dragStartX = canvasTouch.clientX;
                dragStartY = canvasTouch.clientY;
            }
        }, { passive: true });

        const endCanvasTouch = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === canvasTouchId) {
                    canvasTouchId = null;
                    break;
                }
            }
        };

        canvas.addEventListener("touchend", endCanvasTouch, { passive: true });
        canvas.addEventListener("touchcancel", endCanvasTouch, { passive: true });
    }
}
