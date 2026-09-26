/**
 * Input Handler Module for Captain Q HTML5
 * Manages Keyboard, Touch D-Pad buttons, and Swipe Gestures
 */

class InputHandler {
    constructor(player) {
        this.player = player;
        this.initKeyboard();
        this.initTouch();
    }

    initKeyboard() {
        window.addEventListener("keydown", (e) => {
            // Unlock audio on first interaction
            audio.init();

            switch (e.key) {
                case "ArrowUp":
                case "w":
                case "W":
                    this.player.setNextDir(DIR.NORTH);
                    e.preventDefault();
                    break;
                case "ArrowDown":
                case "s":
                case "S":
                    this.player.setNextDir(DIR.SOUTH);
                    e.preventDefault();
                    break;
                case "ArrowLeft":
                case "a":
                case "A":
                    this.player.setNextDir(DIR.WEST);
                    e.preventDefault();
                    break;
                case "ArrowRight":
                case "d":
                case "D":
                    this.player.setNextDir(DIR.EAST);
                    e.preventDefault();
                    break;
                case " ":
                case "1":
                    if (window.gameInstance) window.gameInstance.activateShield();
                    e.preventDefault();
                    break;
            }
        });
    }

    initTouch() {
        // 1. D-Pad buttons
        const bindBtn = (id, dir) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const handler = (e) => {
                e.preventDefault();
                audio.init();
                this.player.setNextDir(dir);
            };
            btn.addEventListener("touchstart", handler, { passive: false });
            btn.addEventListener("mousedown", handler);
        };

        bindBtn("btn_up", DIR.NORTH);
        bindBtn("btn_down", DIR.SOUTH);
        bindBtn("btn_left", DIR.WEST);
        bindBtn("btn_right", DIR.EAST);

        // 2. Swipe Gestures on Canvas
        const canvas = document.getElementById("gameCanvas");
        if (!canvas) return;

        let startX = 0;
        let startY = 0;
        let startTime = 0;

        canvas.addEventListener("touchstart", (e) => {
            if (e.touches.length === 1) {
                audio.init();
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                startTime = Date.now();
            }
        }, { passive: true });

        canvas.addEventListener("touchend", (e) => {
            if (e.changedTouches.length === 1) {
                const dx = e.changedTouches[0].clientX - startX;
                const dy = e.changedTouches[0].clientY - startY;
                const dt = Date.now() - startTime;
                const dist = Math.hypot(dx, dy);

                if (dist > 25 && dt < 500) {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        if (dx > 0) this.player.setNextDir(DIR.EAST);
                        else this.player.setNextDir(DIR.WEST);
                    } else {
                        if (dy > 0) this.player.setNextDir(DIR.SOUTH);
                        else this.player.setNextDir(DIR.NORTH);
                    }
                }
            }
        }, { passive: true });
    }
}
