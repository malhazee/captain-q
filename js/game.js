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

        // Shield button
        const shieldBtn = document.getElementById("btn_shield");
        if (shieldBtn) {
            const onShield = (e) => {
                if (e) e.preventDefault();
                this.toggleShield();
            };
            shieldBtn.addEventListener("click", onShield);
            shieldBtn.addEventListener("touchstart", onShield, { passive: false });
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

        // Canvas Click & Touch interaction for Intro Skip & Results Return
        this.canvas.addEventListener("click", (e) => this.handleCanvasInteraction(e));
        this.canvas.addEventListener("touchend", (e) => {
            e.preventDefault();
            this.handleCanvasInteraction(e);
        });

        // Keyboard Space/Enter to Skip Intro or Return to Menu
        window.addEventListener("keydown", (e) => {
            if (e.code === "Space" || e.code === "Enter") {
                this.handleCanvasInteraction(e);
            }
        });
    }

    handleCanvasInteraction(e) {
        if (this.state === "INTRO") {
            this.skipIntro();
        } else if (this.state === "GAME_OVER" || this.state === "VICTORY") {
            this.returnToMainMenu();
        }
    }

    skipIntro() {
        if (this.state === "INTRO") {
            this.introTimer = 0;
            this.state = "PLAYING";
            audio.playLevelStart();
        }
    }

    returnToMainMenu() {
        this.state = "REGISTRATION";
        this.score = 0;
        this.lives = GAME_CONFIG.INITIAL_LIVES;
        this.levelIndex = 0;
        this.levelTimer = GAME_CONFIG.LEVEL_TIME_LIMIT;
        this.introTimer = GAME_CONFIG.INTRO_COUNTDOWN;
        if (this.telemetry) {
            this.telemetry.resetSession();
        }
        this.setupLevel(0);
        const modal = document.getElementById("mobile_reg_modal");
        if (modal) {
            modal.style.display = "flex";
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
        const prevPermanentShield = this.player ? this.player.permanentShield : false;
        if (!this.player) {
            this.player = new Player(pSpawn, tileSize, this.mazeOffsetX, this.mazeOffsetY);
        } else {
            this.player.tileSize = tileSize;
            this.player.reset(pSpawn, this.mazeOffsetX, this.mazeOffsetY);
        }
        this.player.permanentShield = prevPermanentShield;
        this.player.speed = levelConfig.playerSpeed || 1.35;

        // Ghosts: Start from the 4 outer corners!
        const gColors = [
            { id: 1, name: "بلينكي", color: "#ef4444", ...this.maze.getCornerSpawn(1) },
            { id: 2, name: "بينكي", color: "#f472b6", ...this.maze.getCornerSpawn(2) },
            { id: 3, name: "إنكي", color: "#06b6d4", ...this.maze.getCornerSpawn(3) },
            { id: 4, name: "كلايد", color: "#f97316", ...this.maze.getCornerSpawn(4) }
        ];

        this.ghosts = [];
        for (let i = 0; i < 4; i++) {
            const gInfo = gColors[i];
            const corner = { c: gInfo.c, r: gInfo.r };
            const g = new Ghost(gInfo.id, gInfo.name, gInfo.color, corner, tileSize, this.mazeOffsetX, this.mazeOffsetY, gInfo.dir);
            g.reset(corner, "CHASE", 0, this.mazeOffsetX, this.mazeOffsetY, gInfo.dir);
            g.speed = levelConfig.ghostSpeed || 0.85;
            this.ghosts.push(g);
        }

        // Mission & Collectibles
        this.missionMgr.loadLevel(this.levelIndex, this.maze);
        this.levelTimer = GAME_CONFIG.LEVEL_TIME_LIMIT;
    }

    toggleShield() {
        if (!this.player) return;
        const isActive = this.player.togglePermanentShield();
        audio.playSuperDot();
        if (isActive) {
            this.missionMgr.addFloatingText(this.player.pixelX, this.player.pixelY, "🛡️ الدرع: مفعّل دائماً!", "#38bdf8");
        } else {
            this.missionMgr.addFloatingText(this.player.pixelX, this.player.pixelY, "🛡️ تم إيقاف الدرع", "#f87171");
        }
    }

    activateShield(durationSec = 7) {
        if (!this.player) return;
        this.player.activateShield(durationSec);
        audio.playSuperDot();
        this.missionMgr.addFloatingText(this.player.pixelX, this.player.pixelY, "🛡️ درع الحماية مفعّل!", "#38bdf8");
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

        // Update shield button visual state
        const shieldBtn = document.getElementById("btn_shield");
        if (shieldBtn && this.player) {
            if (this.player.isShieldActive()) {
                shieldBtn.classList.add("active");
                shieldBtn.setAttribute("title", "🛡️ الدرع الخارق: مفعّل دائماً (انقر للإلغاء)");
            } else {
                shieldBtn.classList.remove("active");
                shieldBtn.setAttribute("title", "🛡️ تفعيل درع الحماية الدائم");
            }
        }

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

        // Level Timer: when time runs out, end game directly and show results!
        this.levelTimer -= dt;
        if (this.levelTimer <= 0) {
            this.levelTimer = 0;
            this.handleTimeOut();
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
            this.player.activateShield(GAME_CONFIG.SUPER_DOT_DURATION);
            this.ghosts.forEach(g => g.setFrightened(GAME_CONFIG.SUPER_DOT_DURATION));
            this.missionMgr.addFloatingText(this.player.pixelX, this.player.pixelY, "🛡️ سوبر باكغم (الدرع مفعل)!", "#38bdf8");
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

            // Announce regeneration when ghost arrives back at corner
            if (ghost.justRegenerated) {
                ghost.justRegenerated = false;
                audio.playTarget();
                this.missionMgr.addFloatingText(ghost.pixelX, ghost.pixelY, `✨ تجدد ${ghost.name}!`, ghost.color);
            }

            // Safe Sanctuary Immunity: player inside sanctuary is 100% immune from ghost attacks
            if (this.maze.isSanctuary(this.player.gridX, this.player.gridY)) {
                continue;
            }

            // Distance to player
            const dist = Math.hypot(ghost.pixelX - this.player.pixelX, ghost.pixelY - this.player.pixelY);
            if (dist < (this.player.radius + ghost.radius) * 0.75) {
                // If ghost is frightened OR player has active Shield Mode!
                if (ghost.state === "FRIGHTENED" || this.player.isShieldActive()) {
                    // Eat ghost: 0 points (points only on correct math answers)
                    ghost.state = "EATEN";
                    audio.playGhostEaten();
                    this.missionMgr.addFloatingText(ghost.pixelX, ghost.pixelY, "🛡️👻 تم أكل الشبح!", "#38bdf8");
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

    handleTimeOut() {
        audio.playGameOver();
        this.state = "GAME_OVER";
        this.gameOverReason = "نفاد وقت المرحلة";
        if (this.telemetry) {
            this.telemetry.score = this.score;
            this.telemetry.level = this.levelIndex + 1;
            this.telemetry.lives = this.lives;
            this.telemetry.sendFinalReport("نفاد وقت المرحلة ⏳");
        }
    }

    handlePlayerDeath(reason) {
        audio.playGameOver();
        this.lives--;
        this.telemetry.lives = this.lives;

        if (this.lives <= 0) {
            this.state = "GAME_OVER";
            this.gameOverReason = `انتهاء الأرواح (${reason})`;
            this.telemetry.sendFinalReport(`انتهت المحاولات (${reason})`);
        } else {
            // Respawn player in center and ghosts at their 4 corners
            const pSpawn = this.maze.getPlayerSpawn();
            this.player.reset(pSpawn, this.mazeOffsetX, this.mazeOffsetY);

            this.ghosts.forEach((g) => {
                const cornerSpawn = this.maze.getCornerSpawn(g.id);
                const corner = { c: cornerSpawn.c, r: cornerSpawn.r };
                g.reset(corner, "CHASE", 0, this.mazeOffsetX, this.mazeOffsetY, cornerSpawn.dir);
            });
            this.startLevelIntro();
        }
    }

    handleLevelClear() {
        audio.playVictory();
        if (this.levelIndex + 1 >= GAME_CONFIG.LEVELS.length) {
            this.state = "VICTORY";
            this.gameOverReason = "فوز وتفوق تام 🏆";
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
            ctx.roundRect(-w / 2, -h / 2, w, h, 6);
            ctx.fillStyle = "#0c2144";
            ctx.fill();

            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 1.8;
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

        let statusText = "";
        for (let i = 0; i < this.lives; i++) statusText += "❤️ ";
        if (this.player && this.player.isShieldActive()) {
            if (this.player.permanentShield) {
                statusText += ` | 🛡️ درع دائم`;
            } else {
                const sSec = Math.ceil(this.player.shieldTimer / 60);
                statusText += ` | 🛡️ ${sSec}ث`;
            }
        }
        ctx.font = "15px system-ui, sans-serif";
        ctx.fillStyle = (this.player && this.player.isShieldActive()) ? "#38bdf8" : "#ffffff";
        ctx.fillText(statusText || "💀", 18, 48);

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
        
        ctx.fillStyle = "rgba(7, 13, 30, 0.92)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const cardW = 760;
        const cardH = 580;
        const cx = (this.canvas.width - cardW) / 2;
        const cy = (this.canvas.height - cardH) / 2;

        // Card Container
        ctx.save();
        ctx.fillStyle = "#0c1736";
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 3;
        ctx.shadowColor = "rgba(56, 189, 248, 0.35)";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.roundRect(cx, cy, cardW, cardH, 20);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Level Header
        ctx.textAlign = "center";
        ctx.fillStyle = "#94a3b8";
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.fillText(`المرحلة ${this.levelIndex + 1} من ${GAME_CONFIG.LEVELS.length}`, this.canvas.width / 2, cy + 42);

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 30px system-ui, sans-serif";
        ctx.fillText(curLvl.title, this.canvas.width / 2, cy + 82);

        // Mission Prompt Box
        const promptBoxW = cardW - 60;
        const promptBoxX = cx + 30;
        const promptBoxY = cy + 105;
        ctx.fillStyle = "rgba(30, 58, 138, 0.4)";
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(promptBoxX, promptBoxY, promptBoxW, 52, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#fef08a";
        ctx.font = "bold 20px system-ui, sans-serif";
        ctx.fillText(`🎯 المطلوب: ${curLvl.prompt}`, this.canvas.width / 2, promptBoxY + 33);

        // Target Section
        ctx.fillStyle = "#34d399";
        ctx.font = "bold 17px system-ui, sans-serif";
        ctx.fillText("✅ الإجابات الصحيحة المستهدفة (+100 نقطة لكل منها):", this.canvas.width / 2, cy + 190);

        // Render Targets chips
        const targets = curLvl.targets || [];
        const chipW = 88;
        const chipH = 38;
        const chipGap = 12;
        const totalTargetsW = targets.length * chipW + (targets.length - 1) * chipGap;
        let startTargetX = (this.canvas.width - totalTargetsW) / 2;
        const targetY = cy + 206;

        targets.forEach(t => {
            ctx.fillStyle = "#064e3b";
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(startTargetX, targetY, chipW, chipH, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 18px system-ui, sans-serif";
            ctx.textBaseline = "middle";
            ctx.fillText("\u200E" + t, startTargetX + chipW / 2, targetY + chipH / 2 + 1);
            ctx.textBaseline = "alphabetic";

            startTargetX += chipW + chipGap;
        });

        // Traps Section
        ctx.fillStyle = "#f87171";
        ctx.font = "bold 17px system-ui, sans-serif";
        ctx.fillText("❌ الإجابات الخاطئة / التمويهات (تجنبها - 0 نقطة):", this.canvas.width / 2, cy + 280);

        const traps = curLvl.traps || [];
        const totalTrapsW = traps.length * chipW + (traps.length - 1) * chipGap;
        let startTrapX = (this.canvas.width - totalTrapsW) / 2;
        const trapY = cy + 296;

        traps.forEach(t => {
            ctx.fillStyle = "#450a0a";
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(startTrapX, trapY, chipW, chipH, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 18px system-ui, sans-serif";
            ctx.textBaseline = "middle";
            ctx.fillText("\u200E" + t, startTrapX + chipW / 2, trapY + chipH / 2 + 1);
            ctx.textBaseline = "alphabetic";

            startTrapX += chipW + chipGap;
        });

        // Note about uniform card styling
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px system-ui, sans-serif";
        ctx.fillText("ℹ️ تنبيه: جميع البطاقات داخل المتاهة متطابقة في اللون لتختبر مهارتك الذهنية!", this.canvas.width / 2, cy + 368);

        // Countdown & Skip CTA
        const count = Math.ceil(this.introTimer);
        const timerY = cy + 428;

        // Circular Timer Indicator
        ctx.beginPath();
        ctx.arc(this.canvas.width / 2, timerY, 32, 0, Math.PI * 2);
        ctx.fillStyle = "#1e3a8a";
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 3;
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 26px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(count.toString(), this.canvas.width / 2, timerY + 1);
        ctx.textBaseline = "alphabetic";

        // Skip Button Prompt
        const btnW = 440;
        const btnH = 46;
        const btnX = (this.canvas.width - btnW) / 2;
        const btnY = cy + 482;

        ctx.fillStyle = "#1d4ed8";
        ctx.strokeStyle = "#60a5fa";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnW, btnH, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 17px system-ui, sans-serif";
        ctx.fillText("⚡ انقر على الشاشة أو اضغط [مسافة] للبدء فوراً", this.canvas.width / 2, btnY + 29);

        ctx.fillStyle = "#64748b";
        ctx.font = "13px system-ui, sans-serif";
        ctx.fillText("وقت القراءة: 10 ثوانٍ  •  زر الدرع الخارق متاح بالأسفل 🛡️", this.canvas.width / 2, cy + 555);
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

    renderResultsOverlay(ctx, isVictory, reason) {
        ctx.fillStyle = "rgba(7, 13, 30, 0.94)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const cardW = 760;
        const cardH = 640;
        const cx = (this.canvas.width - cardW) / 2;
        const cy = (this.canvas.height - cardH) / 2;

        // Card Container
        const borderColor = isVictory ? "#10b981" : (reason === "نفاد وقت المرحلة" ? "#f59e0b" : "#ef4444");
        ctx.save();
        ctx.fillStyle = "#0c1533";
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = borderColor;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.roundRect(cx, cy, cardW, cardH, 20);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.textAlign = "center";

        // Title Header
        let titleText = isVictory ? "🏆 مبروك يا بطل الرياضيات!" : (reason === "نفاد وقت المرحلة" ? "⏳ انتهى الوقت المحدد!" : "💀 انتهت المحاولة!");
        let titleColor = isVictory ? "#ffd700" : (reason === "نفاد وقت المرحلة" ? "#fbbf24" : "#f87171");
        ctx.fillStyle = titleColor;
        ctx.font = "bold 34px system-ui, sans-serif";
        ctx.fillText(titleText, this.canvas.width / 2, cy + 50);

        // Student Info
        ctx.fillStyle = "#93c5fd";
        ctx.font = "bold 20px system-ui, sans-serif";
        ctx.fillText(`👤 الطالب: ${this.telemetry.studentName}   |   ${this.telemetry.studentSection}`, this.canvas.width / 2, cy + 90);

        // 4 Diagnostic Metric Cards (2x2 grid)
        const metrics = [
            { label: "مجموع النقاط (إجابات صحيحة)", val: `${this.score} نقطة`, col: "#38bdf8" },
            { label: "نسبة الدقة الرياضية", val: `${this.telemetry.getAccuracyRate()}`, col: "#34d399" },
            { label: "الإجابات الصحيحة الملتقطة", val: `+${this.telemetry.getCorrectCount()} صحيحة`, col: "#4ade80" },
            { label: "التمويهات الخاطئة (0 نقطة)", val: `${this.telemetry.getWrongCount()} أخطاء`, col: "#f87171" }
        ];

        const mBoxW = 320;
        const mBoxH = 68;
        const gapX = 30;
        const startX = cx + (cardW - (mBoxW * 2 + gapX)) / 2;
        const startY = cy + 120;

        metrics.forEach((m, idx) => {
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            const bx = startX + col * (mBoxW + gapX);
            const by = startY + row * (mBoxH + 16);

            ctx.fillStyle = "#070e24";
            ctx.strokeStyle = "#1e3a8a";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(bx, by, mBoxW, mBoxH, 10);
            ctx.fill();
            ctx.stroke();

            ctx.textAlign = "center";
            ctx.fillStyle = "#94a3b8";
            ctx.font = "14px system-ui, sans-serif";
            ctx.fillText(m.label, bx + mBoxW / 2, by + 24);

            ctx.fillStyle = m.col;
            ctx.font = "bold 24px system-ui, sans-serif";
            ctx.fillText(m.val, bx + mBoxW / 2, by + 54);
        });

        // Misconceptions Analysis
        const miscs = this.telemetry.getMisconceptions();
        const miscBoxY = cy + 295;
        const miscBoxW = cardW - 70;
        const miscBoxX = cx + 35;

        ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
        ctx.strokeStyle = miscs.length > 0 ? "#7f1d1d" : "#065f46";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(miscBoxX, miscBoxY, miscBoxW, 76, 10);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "center";
        if (miscs.length > 0) {
            ctx.fillStyle = "#fca5a5";
            ctx.font = "bold 15px system-ui, sans-serif";
            ctx.fillText("⚠️ مواضيع ومفاهيم بحاجة للمراجعة والتدريب:", this.canvas.width / 2, miscBoxY + 28);
            ctx.fillStyle = "#ffffff";
            ctx.font = "14px system-ui, sans-serif";
            const line = miscs.slice(0, 2).join("  •  ");
            ctx.fillText(line, this.canvas.width / 2, miscBoxY + 54);
        } else {
            ctx.fillStyle = "#86efac";
            ctx.font = "bold 16px system-ui, sans-serif";
            ctx.fillText("🌟 أداء ممتاز ومفاهيم رياضية متقنة بنسبة 100%!", this.canvas.width / 2, miscBoxY + 34);
            ctx.fillStyle = "#cbd5e1";
            ctx.font = "14px system-ui, sans-serif";
            ctx.fillText("لم تسجل أي خطأ في التمويهات الرياضية 👏", this.canvas.width / 2, miscBoxY + 58);
        }

        // Google Sheets Confirmation Banner
        const bannerY = cy + 395;
        const bannerW = cardW - 70;
        const bannerX = cx + 35;

        ctx.fillStyle = "#064e3b";
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bannerX, bannerY, bannerW, 56, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ecfdf5";
        ctx.font = "bold 16px system-ui, sans-serif";
        ctx.fillText("☁️ تم توثيق النتيجة وإرسالها إلى سجل المعلم (Google Sheets) بنجاح ✅", this.canvas.width / 2, bannerY + 34);

        // Big Action Button: Return to Main Menu
        const actBtnW = 480;
        const actBtnH = 56;
        const actBtnX = (this.canvas.width - actBtnW) / 2;
        const actBtnY = cy + 480;

        ctx.fillStyle = "#1d4ed8";
        ctx.strokeStyle = "#60a5fa";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(actBtnX, actBtnY, actBtnW, actBtnH, 14);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px system-ui, sans-serif";
        ctx.fillText("🔄 العودة للقائمة الرئيسية وبدء محاولة جديدة", this.canvas.width / 2, actBtnY + 35);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px system-ui, sans-serif";
        ctx.fillText("انقر في أي مكان على الشاشة أو اضغط [مسافة] للعودة فوراً", this.canvas.width / 2, cy + 575);
    }

    renderGameOverOverlay(ctx) {
        this.renderResultsOverlay(ctx, false, this.gameOverReason || "انتهاء المحاولات");
    }

    renderVictoryOverlay(ctx) {
        this.renderResultsOverlay(ctx, true, "فوز وتفوق تام");
    }
}

// Auto-boot game when DOM is ready
window.addEventListener("DOMContentLoaded", () => {
    window.gameInstance = new CaptainQGame();
});
