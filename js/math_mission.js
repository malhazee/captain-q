/**
 * Math Mission & Collectibles Module for Captain Q HTML5
 * Manages Curriculum Targets, Traps, Misconceptions, Dots & Super Dots
 */

class MathMissionManager {
    constructor() {
        this.levelIndex = 0;
        this.currentLevel = null;
        this.collectedCount = 0;
        this.neededCount = 4;
        
        // Active maze collectibles
        this.dots = [];         // [{ c, r }]
        this.superDots = [];    // [{ c, r }]
        this.mathTiles = [];    // [{ c, r, label, isTarget, misconception, pulse }]
        this.floatingTexts = []; // [{ x, y, text, color, life, maxLife }]
    }

    loadLevel(levelIndex, maze) {
        this.levelIndex = levelIndex;
        this.currentLevel = GAME_CONFIG.LEVELS[levelIndex % GAME_CONFIG.LEVELS.length];
        this.collectedCount = 0;
        this.neededCount = this.currentLevel.neededCount || 4;
        this.floatingTexts = [];

        this.spawnCollectibles(maze);
    }

    spawnCollectibles(maze) {
        this.dots = [];
        this.superDots = [];
        this.mathTiles = [];

        // Filter walkable cells strictly excluding the Safe Sanctuary
        const walkable = maze.getWalkableCells().filter(cell => !maze.isSanctuary(cell.c, cell.r));
        if (walkable.length === 0) return;

        // Shuffle cells
        const shuffled = [...walkable].sort(() => Math.random() - 0.5);

        // 1. Place 4 Super Dots near the 4 corners
        const corners = [
            { c: 2, r: 2 },
            { c: maze.cols - 3, r: 2 },
            { c: 2, r: maze.rows - 3 },
            { c: maze.cols - 3, r: maze.rows - 3 }
        ];
        corners.forEach(corner => {
            if (maze.isPassable(corner.c, corner.r)) {
                this.superDots.push({ c: corner.c, r: corner.r });
            }
        });

        // 2. Prepare Math Target & Trap Cards
        const targets = this.currentLevel.targets || [];
        const traps = this.currentLevel.traps || [];
        const cardsToPlace = [];

        // Add all targets
        targets.forEach(t => cardsToPlace.push({ label: t, isTarget: true, misconception: "" }));
        // Add all traps
        traps.forEach(t => cardsToPlace.push({
            label: t,
            isTarget: false,
            misconception: GAME_CONFIG.MISCONCEPTIONS[t] || "مفهوم رياضي بحاجة لتدريب"
        }));

        // Shuffle cards
        cardsToPlace.sort(() => Math.random() - 0.5);

        // 3. Place Math Cards evenly in maze
        const usedCells = new Set();
        this.superDots.forEach(sd => usedCells.add(`${sd.c},${sd.r}`));
        const playerSpawn = maze.getPlayerSpawn();
        usedCells.add(`${playerSpawn.c},${playerSpawn.r}`);

        let cardIdx = 0;
        for (let cell of shuffled) {
            const key = `${cell.c},${cell.r}`;
            if (usedCells.has(key)) continue;

            if (cardIdx < cardsToPlace.length) {
                const card = cardsToPlace[cardIdx++];
                this.mathTiles.push({
                    c: cell.c,
                    r: cell.r,
                    label: card.label,
                    isTarget: card.isTarget,
                    misconception: card.misconception,
                    pulse: Math.random() * Math.PI * 2
                });
                usedCells.add(key);
            } else if (this.dots.length < 35) {
                // Place regular pac-dots
                this.dots.push({ c: cell.c, r: cell.r });
                usedCells.add(key);
            }
        }
    }

    addFloatingText(x, y, text, color = "#ffd700") {
        this.floatingTexts.push({
            x, y,
            text,
            color,
            life: 45,
            maxLife: 45
        });
    }

    updateFloatingTexts() {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y -= 0.8;
            ft.life--;
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    checkCollisions(player, telemetry) {
        const pc = Math.round(player.gridX);
        const pr = Math.round(player.gridY);
        let result = {
            pointsDelta: 0,
            superDotEaten: false,
            missionCleared: false
        };

        // 1. Regular dots
        for (let i = this.dots.length - 1; i >= 0; i--) {
            const d = this.dots[i];
            if (d.c === pc && d.r === pr) {
                this.dots.splice(i, 1);
                result.pointsDelta += GAME_CONFIG.POINTS_PER_DOT;
                break;
            }
        }

        // 2. Super dots (Energizer)
        for (let i = this.superDots.length - 1; i >= 0; i--) {
            const sd = this.superDots[i];
            if (sd.c === pc && sd.r === pr) {
                this.superDots.splice(i, 1);
                result.superDotEaten = true;
                this.addFloatingText(player.pixelX, player.pixelY - 15, "⚡ طاقة خارقة!", "#00e5ff");
                break;
            }
        }

        // 3. Math Tiles (Targets & Traps)
        for (let i = this.mathTiles.length - 1; i >= 0; i--) {
            const mt = this.mathTiles[i];
            if (mt.c === pc && mt.r === pr) {
                this.mathTiles.splice(i, 1);
                if (mt.isTarget) {
                    this.collectedCount++;
                    result.pointsDelta += GAME_CONFIG.POINTS_PER_TARGET;
                    this.addFloatingText(player.pixelX, player.pixelY - 18, `+100 🎯 (${mt.label})`, "#4ade80");
                    if (telemetry) telemetry.recordAnswer(mt.label, true);

                    if (this.collectedCount >= this.neededCount) {
                        result.missionCleared = true;
                    }
                } else {
                    result.pointsDelta += GAME_CONFIG.PENALTY_PER_TRAP;
                    this.addFloatingText(player.pixelX, player.pixelY - 18, `-30 ⚠️ ${mt.label}`, "#ef4444");
                    if (telemetry) telemetry.recordAnswer(mt.label, false, mt.misconception);
                }
                break;
            }
        }

        return result;
    }
}
