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
        // 1. D-Pad buttons & Continuous Sliding Support
        const dpadCluster = document.querySelector(".dpad-cluster");
        const btnMap = {
            "btn_up": DIR.NORTH,
            "btn_down": DIR.SOUTH,
            "btn_left": DIR.WEST,
            "btn_right": DIR.EAST
        };

        const handlePointOnDpad = (clientX, clientY) => {
            const el = document.elementFromPoint(clientX, clientY);
            if (!el) return;
            const btn = el.closest(".touch-btn");
            if (btn && btnMap[btn.id]) {
                audio.init();
                this.setDirection(btnMap[btn.id]);
            }
        };

        if (dpadCluster) {
            dpadCluster.addEventListener("touchstart", (e) => {
                e.preventDefault();
                for (let i = 0; i < e.touches.length; i++) {
                    handlePointOnDpad(e.touches[i].clientX, e.touches[i].clientY);
                }
            }, { passive: false });

            dpadCluster.addEventListener("touchmove", (e) => {
                e.preventDefault();
                for (let i = 0; i < e.touches.length; i++) {
                    handlePointOnDpad(e.touches[i].clientX, e.touches[i].clientY);
                }
            }, { passive: false });

            dpadCluster.addEventListener("touchend", () => {
                document.querySelectorAll(".touch-btn").forEach(b => b.classList.remove("active-touch"));
            });
        }

        // Direct clicks on individual D-Pad buttons
        Object.keys(btnMap).forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const dir = btnMap[id];
            btn.addEventListener("mousedown", (e) => {
                e.preventDefault();
                audio.init();
                this.setDirection(dir);
            });
        });

        // 2. Real-time Continuous Touch Drag & Swipe on Canvas / Game Area
        const canvas = document.getElementById("gameCanvas");
        if (!canvas) return;

        let dragStartX = 0;
        let dragStartY = 0;
        let isTouching = false;
        const SWIPE_THRESHOLD = 14; // pixels for immediate continuous steering

        canvas.addEventListener("touchstart", (e) => {
            if (e.touches.length === 1) {
                audio.init();
                isTouching = true;
                dragStartX = e.touches[0].clientX;
                dragStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        canvas.addEventListener("touchmove", (e) => {
            if (!isTouching || e.touches.length !== 1) return;

            const curX = e.touches[0].clientX;
            const curY = e.touches[0].clientY;
            const dx = curX - dragStartX;
            const dy = curY - dragStartY;
            const dist = Math.hypot(dx, dy);

            if (dist >= SWIPE_THRESHOLD) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.setDirection(dx > 0 ? DIR.EAST : DIR.WEST);
                } else {
                    this.setDirection(dy > 0 ? DIR.SOUTH : DIR.NORTH);
                }
                // Reset anchor point to enable continuous steering while dragging
                dragStartX = curX;
                dragStartY = curY;
            }
        }, { passive: true });

        canvas.addEventListener("touchend", (e) => {
            if (!isTouching) return;
            isTouching = false;

            // If it was a quick tap with minimal movement, steer relative to Pacman
            if (e.changedTouches.length === 1 && window.gameInstance && window.gameInstance.player) {
                const rect = canvas.getBoundingClientRect();
                const tapPixelX = (e.changedTouches[0].clientX - rect.left) * (canvas.width / rect.width);
                const tapPixelY = (e.changedTouches[0].clientY - rect.top) * (canvas.height / rect.height);
                const p = window.gameInstance.player;

                const dx = tapPixelX - p.pixelX;
                const dy = tapPixelY - p.pixelY;
                if (Math.hypot(dx, dy) > 20) {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        this.setDirection(dx > 0 ? DIR.EAST : DIR.WEST);
                    } else {
                        this.setDirection(dy > 0 ? DIR.SOUTH : DIR.NORTH);
                    }
                }
            }
            document.querySelectorAll(".touch-btn").forEach(b => b.classList.remove("active-touch"));
        }, { passive: true });
    }
}
