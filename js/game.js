/**
 * Main Game Controller & Canvas Renderer for Captain Q HTML5
 * High-performance 60FPS Game Loop with zero dependencies
 */

class CaptainQGame {
    constructor() {
        this.canvas = document.getElementById("gameCanvas");
        this.ctx = this.canvas.getContext("2d");
        
        // Logical resolution
        this.canvas.width = GAME_CONFIG.CANVAS_SIZE;
        this.canvas.height = GAME_CONFIG.CANVAS_SIZE;
        
        this.state = "REGISTRATION"; // REGISTRATION, INTRO, PLAYING, PAUSED, LEVEL_CLEAR, GAME_OVER, VICTORY
        this.score = 0;
        this.lives = GAME_CONFIG.INITIAL_LIVES;
        this.levelIndex = 0;
        this.levelTimer = GAME_CONFIG.LEVEL_TIME_LIMIT;
        this.introTimer = GAME_CONFIG.INTRO_COUNTDOWN;
        
        // High score
        this.highScore = parseInt(localStorage.getItem("captain_q_high") || "0", 10);

        // Core systems
        this.telemetry = new TelemetryTracker();
        this.missionMgr = new MathMissionManager();
        this.maze = null;
        this.player = null;
        this.ghosts = [];
        this.inputHandler = null;

        // Visual timers
        this.lastTimestamp = 0;

        this.initDOM();
        this.setupLevel(0);
        this.inputHandler = new InputHandler(this.player);

        // Start render loop
        requestAnimationFrame((ts) => this.gameLoop(ts));
    }

    initDOM() {
        // Registration Modal Submit
        const startBtn = document.getElementById("btn_modal_start");
        if (startBtn) {
            startBtn.addEventListener("click", () => this.submitRegistration());
            startBtn.addEventListener("touchend", (e) => {
                e.preventDefault();
                this.submitRegistration();
            });
        }

        // Section buttons
        this.selectedSection = "شعبة أ";
        document.querySelectorAll(".sec-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".sec-btn").forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
                this.selectedSection = btn.innerText;
            });
        });

        // Sound Toggle Button inside Start Screen
        const soundBtn = document.getElementById("btn_sound_toggle");
        const quickSoundBtn = document.getElementById("btn_quick_sound");
        const updateSoundUI = (muted) => {
            if (soundBtn) soundBtn.innerText = muted ? "🔇 المؤثرات الصوتية: معطلة" : "🔊 المؤثرات الصوتية: مفعلة";
            if (quickSoundBtn) quickSoundBtn.innerText = muted ? "🔇" : "🔊";
        };

        if (soundBtn) {
            soundBtn.addEventListener("click", () => {
                const muted = audio.toggleMute();
                updateSoundUI(muted);
            });
        }
        if (quickSoundBtn) {
            quickSoundBtn.addEventListener("click", () => {
                const muted = audio.toggleMute();
                updateSoundUI(muted);
            });
        }

        // Quick Help button in Top Bar
        const quickHelpBtn = document.getElementById("btn_quick_help");
        if (quickHelpBtn) {
            quickHelpBtn.addEventListener("click", () => {
                document.getElementById("mobile_reg_modal").style.display = "flex";
            });
        }

        // Pause button
        const pauseBtn = document.getElementById("btn_pause");
        if (pauseBtn) {
            pauseBtn.addEventListener("click", () => this.togglePause());
        }

        // Reg button
        const regBtn = document.getElementById("btn_reg");
        if (regBtn) {
            regBtn.addEventListener("click", () => {
                document.getElementById("mobile_reg_modal").style.display = "flex";
            });
        }
    }

    submitRegistration() {
        audio.init();
        const input = document.getElementById("mobile_name_input");
        const name = (input && input.value.trim()) ? input.value.trim() : "طالب مجهول";
        
        this.telemetry.setStudent(name, this.selectedSection);
        this.telemetry.sendStartPing();

        // Update player badge in HUD
        const badge = document.getElementById("student_badge");
        if (badge) badge.innerText = `${name} (${this.selectedSection})`;

        document.getElementById("mobile_reg_modal").style.display = "none";
        this.startLevelIntro();
    }

    setupLevel(idx) {
        this.levelIndex = idx;
        const levelConfig = GAME_CONFIG.LEVELS[this.levelIndex % GAME_CONFIG.LEVELS.length];
        const seed = 41 + this.levelIndex;
        
        this.maze = new Maze(GAME_CONFIG.GRID_WIDTH, GAME_CONFIG.GRID_HEIGHT, seed);
        
        // Exact frame geometry ensuring row 0 is never cut off
        const HUD_HEIGHT = 64;
        const availHeight = this.canvas.height - HUD_HEIGHT;
        const tileSize = Math.floor(Math.min(this.canvas.width / this.maze.cols, availHeight / this.maze.rows));
        this.tileSize = tileSize;
        this.mazeOffsetX = Math.floor((this.canvas.width - this.maze.cols * tileSize) / 2);
        this.mazeOffsetY = Math.floor(HUD_HEIGHT + (availHeight - this.maze.rows * tileSize) / 2);

        // Player
        const pSpawn = this.maze.getPlayerSpawn();
        if (!this.player) {
            this.player = new Player(pSpawn, tileSize, this.mazeOffsetX, this.mazeOffsetY);
        } else {
            this.player.tileSize = tileSize;
            this.player.reset(pSpawn, this.mazeOffsetX, this.mazeOffsetY);
        }
        this.player.speed = levelConfig.playerSpeed || 3.2;

        // Ghosts: Spaced out across house & entrance so all 4 ghosts are visible and roam!
        const cx = Math.floor(this.maze.cols / 2);
        const cy = Math.floor(this.maze.rows / 2);

        const gColors = [
            { id: 1, name: "بلينكي", color: "#ef4444", corner: { c: this.maze.cols - 2, r: 1 }, spawn: { c: cx, r: cy - 3 }, state: "CHASE", exitDelay: 0 },
            { id: 2, name: "بينكي", color: "#f472b6", corner: { c: 1, r: 1 }, spawn: { c: cx, r: cy }, state: "WAITING", exitDelay: 45 },
            { id: 3, name: "إنكي", color: "#06b6d4", corner: { c: this.maze.cols - 2, r: this.maze.rows - 2 }, spawn: { c: cx - 1, r: cy }, state: "WAITING", exitDelay: 150 },
            { id: 4, name: "كلايد", color: "#f97316", corner: { c: 1, r: this.maze.rows - 2 }, spawn: { c: cx + 1, r: cy }, state: "WAITING", exitDelay: 270 }
        ];

        this.ghosts = [];
        const count = 4; // Always spawn all 4 ghosts (Blinky, Pinky, Inky, Clyde)

        for (let i = 0; i < count; i++) {
            const gInfo = gColors[i];
            const g = new Ghost(gInfo.id, gInfo.name, gInfo.color, gInfo.corner, tileSize, this.mazeOffsetX, this.mazeOffsetY);
            g.reset(gInfo.spawn, gInfo.state, gInfo.exitDelay, this.mazeOffsetX, this.mazeOffsetY);
            g.speed = levelConfig.ghostSpeed || 2.2;
            this.ghosts.push(g);
        }

        // Mission & Collectibles
        this.missionMgr.loadLevel(this.levelIndex, this.maze);
        this.levelTimer = GAME_CONFIG.LEVEL_TIME_LIMIT;
    }

    startLevelIntro() {
        this.state = "INTRO";
        this.introTimer = GAME_CONFIG.INTRO_COUNTDOWN;
        audio.playTarget();
    }

    togglePause() {
        if (this.state === "PLAYING") this.state = "PAUSED";
        else if (this.state === "PAUSED") this.state = "PLAYING";
    }

    gameLoop(timestamp) {
        const dt = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 1000 : 0.016;
        this.lastTimestamp = timestamp;

        this.update(dt);
        this.render();

        requestAnimationFrame((ts) => this.gameLoop(ts));
    }

    update(dt) {
        if (this.state === "INTRO") {
            this.introTimer -= dt;
            if (this.introTimer <= 0) {
                this.state = "PLAYING";
            }
            return;
        }

        if (this.state !== "PLAYING") return;

        // Level Timer
        this.levelTimer -= dt;
        if (this.levelTimer <= 0) {
            this.handlePlayerDeath("نفاد وقت المرحلة");
            return;
        }

        // Update player
        this.player.update(this.maze);

        // Update collectibles & check collection
        const colRes = this.missionMgr.checkCollisions(this.player, this.telemetry);
        if (colRes.pointsDelta !== 0) {
            this.score = Math.max(0, this.score + colRes.pointsDelta);
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem("captain_q_high", this.highScore.toString());
            }
            if (colRes.pointsDelta > 0) audio.playTarget();
            else audio.playTrap();
        }

        if (colRes.superDotEaten) {
            audio.playSuperDot();
            this.ghosts.forEach(g => g.setFrightened(GAME_CONFIG.SUPER_DOT_DURATION));
        }

        // Level Clear condition
        if (colRes.missionCleared) {
            this.handleLevelClear();
            return;
        }

        // Update ghosts & collisions
        const cx = Math.floor(this.maze.cols / 2);
        const cy = Math.floor(this.maze.rows / 2);
        const gHouse = { c: cx, r: cy };

        for (let ghost of this.ghosts) {
            ghost.update(this.maze, this.player, gHouse);

            // Safe Sanctuary Immunity: player inside sanctuary is 100% immune from ghost attacks
            if (this.maze.isSanctuary(this.player.gridX, this.player.gridY)) {
                continue;
            }

            // Distance to player
            const dist = Math.hypot(ghost.pixelX - this.player.pixelX, ghost.pixelY - this.player.pixelY);
            if (dist < (this.player.radius + ghost.radius) * 0.75) {
                if (ghost.state === "FRIGHTENED") {
                    // Eat ghost!
                    ghost.state = "EATEN";
                    this.score += 200;
                    audio.playGhostEaten();
                    this.missionMgr.addFloatingText(ghost.pixelX, ghost.pixelY, "+200 👻", "#67e8f9");
                } else if (ghost.state === "CHASE" || ghost.state === "SCATTER") {
                    this.handlePlayerDeath(`اصطدام بالشبح ${ghost.name}`);
                    return;
                }
            }
        }

        // Update floating texts
        this.missionMgr.updateFloatingTexts();

        // Sync telemetry state
        this.telemetry.score = this.score;
        this.telemetry.level = this.levelIndex + 1;
        this.telemetry.lives = this.lives;
    }

    handlePlayerDeath(reason) {
        audio.playGameOver();
        this.lives--;
        this.telemetry.lives = this.lives;

        if (this.lives <= 0) {
            this.state = "GAME_OVER";
            this.telemetry.sendFinalReport(`انتهت المحاولات (${reason})`);
        } else {
            // Respawn player and ghosts
            const pSpawn = this.maze.getPlayerSpawn();
            this.player.reset(pSpawn, this.mazeOffsetX, this.mazeOffsetY);

            const cx = Math.floor(this.maze.cols / 2);
            const cy = Math.floor(this.maze.rows / 2);
            const gSpawns = [
                { spawn: { c: cx, r: cy - 3 }, state: "CHASE", exitDelay: 0 },
                { spawn: { c: cx, r: cy }, state: "WAITING", exitDelay: 45 },
                { spawn: { c: cx - 1, r: cy }, state: "WAITING", exitDelay: 150 },
                { spawn: { c: cx + 1, r: cy }, state: "WAITING", exitDelay: 270 }
            ];

            this.ghosts.forEach((g, idx) => {
                const info = gSpawns[idx] || gSpawns[0];
                g.reset(info.spawn, info.state, info.exitDelay, this.mazeOffsetX, this.mazeOffsetY);
            });
            this.startLevelIntro();
        }
    }

    handleLevelClear() {
        audio.playVictory();
        if (this.levelIndex + 1 >= GAME_CONFIG.LEVELS.length) {
            this.state = "VICTORY";
            this.telemetry.sendFinalReport("فوز ساحق وتجاوز كافة المراحل 🏆");
        } else {
            this.state = "LEVEL_CLEAR";
            setTimeout(() => {
                this.setupLevel(this.levelIndex + 1);
                this.startLevelIntro();
            }, 2500);
        }
    }

    restartGame() {
        this.score = 0;
        this.lives = GAME_CONFIG.INITIAL_LIVES;
        this.setupLevel(0);
        this.startLevelIntro();
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Draw Maze Walls
        this.renderMaze(ctx);

        // 2. Draw Collectibles
        this.renderCollectibles(ctx);

        // 3. Draw Entities
        const inSanctuary = this.maze.isSanctuary(this.player.gridX, this.player.gridY);
        this.player.render(ctx, inSanctuary);
        this.ghosts.forEach(g => g.render(ctx));

        // 4. Draw Floating Texts
        this.renderFloatingTexts(ctx);

        // 5. Draw HUD Overlay
        this.renderHUD(ctx);

        // 6. State Specific Overlays
        if (this.state === "INTRO") this.renderIntroOverlay(ctx);
        else if (this.state === "PAUSED") this.renderPausedOverlay(ctx);
        else if (this.state === "LEVEL_CLEAR") this.renderLevelClearOverlay(ctx);
        else if (this.state === "GAME_OVER") this.renderGameOverOverlay(ctx);
        else if (this.state === "VICTORY") this.renderVictoryOverlay(ctx);
    }

    renderMaze(ctx) {
        const ts = this.tileSize;
        const cols = this.maze.cols;
        const rows = this.maze.rows;

        // Background
        ctx.fillStyle = "#070d1e";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Central Safe Sanctuary Floor Hologram (مساحة الملاذ الآمن)
        const cx = Math.floor(cols / 2);
        const cy = Math.floor(rows / 2);
        const sx = this.mazeOffsetX + (cx - 2) * ts;
        const sy = this.mazeOffsetY + (cy - 1) * ts;
        const sw = 5 * ts;
        const sh = 3 * ts;

        ctx.save();
        const sGrad = ctx.createRadialGradient(
            sx + sw / 2, sy + sh / 2, ts * 0.4,
            sx + sw / 2, sy + sh / 2, sw * 0.6
        );
        sGrad.addColorStop(0, "rgba(16, 185, 129, 0.22)");
        sGrad.addColorStop(1, "rgba(6, 78, 59, 0.06)");
        ctx.fillStyle = sGrad;
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 8);
        ctx.fill();

        // Neon emerald dashed border
        ctx.strokeStyle = "rgba(52, 211, 153, 0.65)";
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(sx + 2, sy + 2, sw - 4, sh - 4);
        ctx.setLineDash([]);

        // Sanctuary Label Badge
        ctx.fillStyle = "rgba(52, 211, 153, 0.85)";
        ctx.font = `bold ${Math.round(ts * 0.35)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🛡️ ملاذ آمن", sx + sw / 2, sy + sh / 2 + (this.ghosts.some(g => g.state === "WAITING") ? ts * 0.95 : 0));
        ctx.restore();

        // Walls
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = this.maze.grid[r][c];
                const px = this.mazeOffsetX + c * ts;
                const py = this.mazeOffsetY + r * ts;

                if (cell === 1) {
                    ctx.fillStyle = "#0c1a3a";
                    ctx.fillRect(px, py, ts, ts);

                    ctx.strokeStyle = "#3b82f6";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(px + 1, py + 1, ts - 2, ts - 2);

                    ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
                    ctx.fillRect(px + 4, py + 4, ts - 8, ts - 8);
                } else if (cell === 3) {
                    // Ghost Door beam
                    ctx.fillStyle = "rgba(244, 114, 182, 0.85)";
                    ctx.fillRect(px, py + ts * 0.4, ts, ts * 0.2);
                }
            }
        }
    }

    renderCollectibles(ctx) {
        const ts = this.tileSize;

        // Regular Dots
        ctx.fillStyle = "#ffd54f";
        this.missionMgr.dots.forEach(d => {
            const px = this.mazeOffsetX + (d.c + 0.5) * ts;
            const py = this.mazeOffsetY + (d.r + 0.5) * ts;
            ctx.beginPath();
            ctx.arc(px, py, ts * 0.12, 0, Math.PI * 2);
            ctx.fill();
        });

        // Super Dots (Pulsing)
        const pulse = (Math.sin(Date.now() / 150) + 1) * 0.5;
        this.missionMgr.superDots.forEach(sd => {
            const px = this.mazeOffsetX + (sd.c + 0.5) * ts;
            const py = this.mazeOffsetY + (sd.r + 0.5) * ts;
            const r = ts * (0.28 + pulse * 0.08);

            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fillStyle = "#00e5ff";
            ctx.shadowColor = "#00e5ff";
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        // Math Cards: scaled to fit strictly inside corridor tiles (ts * 0.88 by ts * 0.72)
        this.missionMgr.mathTiles.forEach(mt => {
            const px = this.mazeOffsetX + (mt.c + 0.5) * ts;
            const py = this.mazeOffsetY + (mt.r + 0.5) * ts;
            const w = Math.round(ts * 0.88);
            const h = Math.round(ts * 0.72);

            ctx.save();
            ctx.translate(px, py);

            ctx.beginPath();
            ctx.roundRect(-w / 2, -h / 2, w, h, 5);
            ctx.fillStyle = mt.isTarget ? "#0d2644" : "#281232";
            ctx.fill();

            ctx.strokeStyle = mt.isTarget ? "#38bdf8" : "#f472b6";
            ctx.lineWidth = 1.6;
            ctx.stroke();

            // Label text: prepend \u200E so negative numbers like -0.5 are LTR and not reversed
            ctx.fillStyle = "#ffffff";
            ctx.font = `bold ${Math.round(ts * 0.38)}px system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("\u200E" + mt.label, 0, 1);

            ctx.restore();
        });
    }

    renderFloatingTexts(ctx) {
        this.missionMgr.floatingTexts.forEach(ft => {
            const alpha = ft.life / ft.maxLife;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = ft.color;
            ctx.font = "bold 20px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.shadowBlur = 6;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        });
    }

    renderHUD(ctx) {
        const curLvl = GAME_CONFIG.LEVELS[this.levelIndex % GAME_CONFIG.LEVELS.length];
        const hudH = 64;

        // Top Banner
        ctx.fillStyle = "rgba(12, 20, 48, 0.95)";
        ctx.fillRect(0, 0, this.canvas.width, hudH);

        // Mission Prompt & Progress (Right side)
        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 19px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`🎯 ${curLvl.prompt}`, this.canvas.width - 18, 26);

        ctx.fillStyle = "#93c5fd";
        ctx.font = "14px system-ui, sans-serif";
        ctx.fillText(`المرحلة ${this.levelIndex + 1}: ${curLvl.title}  |  المطلوب: ${this.missionMgr.collectedCount}/${this.missionMgr.neededCount}`, this.canvas.width - 18, 48);

        // Score & Lives (Left side)
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.fillText(`النقاط: ${this.score}`, 18, 25);

        let hearts = "";
        for (let i = 0; i < this.lives; i++) hearts += "❤️ ";
        ctx.font = "15px system-ui, sans-serif";
        ctx.fillText(hearts || "💀", 18, 48);

        // Center Time Bar
        const timeRatio = Math.max(0, this.levelTimer / GAME_CONFIG.LEVEL_TIME_LIMIT);
        const barWidth = 130;
        const barX = (this.canvas.width - barWidth) / 2;
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(barX, 16, barWidth, 8);
        ctx.fillStyle = timeRatio > 0.3 ? "#4ade80" : "#ef4444";
        ctx.fillRect(barX, 16, barWidth * timeRatio, 8);

        ctx.fillStyle = "#cbd5e1";
        ctx.font = "bold 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`⏳ ${Math.ceil(this.levelTimer)}ث`, this.canvas.width / 2, 42);
    }

    renderIntroOverlay(ctx) {
        const curLvl = GAME_CONFIG.LEVELS[this.levelIndex % GAME_CONFIG.LEVELS.length];
        
        ctx.fillStyle = "rgba(7, 13, 30, 0.88)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const cardW = 540;
        const cardH = 340;
        const cx = (this.canvas.width - cardW) / 2;
        const cy = (this.canvas.height - cardH) / 2;

        ctx.fillStyle = "#0c1430";
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(cx, cy, cardW, cardH, 16);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.fillStyle = "#60a5fa";
        ctx.font = "bold 26px system-ui, sans-serif";
        ctx.fillText(`المرحلة ${this.levelIndex + 1}: ${curLvl.title}`, this.canvas.width / 2, cy + 60);

        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 20px system-ui, sans-serif";
        ctx.fillText(curLvl.prompt, this.canvas.width / 2, cy + 115);

        ctx.fillStyle = "#cbd5e1";
        ctx.font = "16px system-ui, sans-serif";
        ctx.fillText(`التقط ${this.missionMgr.neededCount} أعداد صحيحة وتجنب التمويهات الرياضية!`, this.canvas.width / 2, cy + 160);

        // Countdown Circle
        const count = Math.ceil(this.introTimer);
        ctx.beginPath();
        ctx.arc(this.canvas.width / 2, cy + 240, 36, 0, Math.PI * 2);
        ctx.fillStyle = "#2563eb";
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 32px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(count.toString(), this.canvas.width / 2, cy + 242);
        ctx.textBaseline = "alphabetic";
    }

    renderPausedOverlay(ctx) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 36px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("⏸️ اللعبة متوقفة مؤقتاً", this.canvas.width / 2, this.canvas.height / 2);
    }

    renderLevelClearOverlay(ctx) {
        ctx.fillStyle = "rgba(7, 13, 30, 0.85)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = "#4ade80";
        ctx.font = "bold 40px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🎉 أحسنت! اكتملت المرحلة", this.canvas.width / 2, this.canvas.height / 2 - 20);

        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 24px system-ui, sans-serif";
        ctx.fillText("جاري الانتقال للمرحلة التالية... ⏳", this.canvas.width / 2, this.canvas.height / 2 + 35);
    }

    renderGameOverOverlay(ctx) {
        ctx.fillStyle = "rgba(7, 13, 30, 0.94)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        ctx.textAlign = "center";
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 42px system-ui, sans-serif";
        ctx.fillText("💀 انتهت المحاولة!", cx, cy - 100);

        ctx.fillStyle = "#ffffff";
        ctx.font = "22px system-ui, sans-serif";
        ctx.fillText(`النقاط النهائية: ${this.score}`, cx, cy - 40);
        ctx.fillText(`نسبة الدقة الرياضية: ${this.telemetry.getAccuracyRate()}`, cx, cy);

        // Misconceptions summary
        const miscs = this.telemetry.getMisconceptions();
        if (miscs.length > 0) {
            ctx.fillStyle = "#f87171";
            ctx.font = "16px system-ui, sans-serif";
            ctx.fillText(`⚠️ مواضيع للمراجعة: ${miscs[0]}`, cx, cy + 45);
        }

        // Restart Prompt
        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 22px system-ui, sans-serif";
        ctx.fillText("انقر على الشاشة للبدء من جديد 🔄", cx, cy + 120);

        this.canvas.onclick = () => {
            this.canvas.onclick = null;
            this.restartGame();
        };
    }

    renderVictoryOverlay(ctx) {
        ctx.fillStyle = "rgba(7, 13, 30, 0.94)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        ctx.textAlign = "center";
        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 44px system-ui, sans-serif";
        ctx.fillText("🏆 مبروك يا بطل الرياضيات!", cx, cy - 100);

        ctx.fillStyle = "#4ade80";
        ctx.font = "bold 26px system-ui, sans-serif";
        ctx.fillText("أتقنت كافة معايير الأعداد النسبية بنجاح 🌟", cx, cy - 45);

        ctx.fillStyle = "#ffffff";
        ctx.font = "22px system-ui, sans-serif";
        ctx.fillText(`مجموع نقاطك: ${this.score}  |  الدقة: ${this.telemetry.getAccuracyRate()}`, cx, cy + 15);

        ctx.fillStyle = "#60a5fa";
        ctx.font = "bold 20px system-ui, sans-serif";
        ctx.fillText("انقر على الشاشة لخوض التحدي من جديد 🎮", cx, cy + 100);

        this.canvas.onclick = () => {
            this.canvas.onclick = null;
            this.restartGame();
        };
    }
}

// Auto-boot game when DOM is ready
window.addEventListener("DOMContentLoaded", () => {
    window.gameInstance = new CaptainQGame();
});
