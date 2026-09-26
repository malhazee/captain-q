/**
 * Entities Module for Captain Q HTML5
 * Implements Captain Q (Player) and the 4 Ghosts with classical AI and exit routines
 */

const DIR = {
    NONE: { dx: 0, dy: 0, angle: 0 },
    NORTH: { dx: 0, dy: -1, angle: -Math.PI / 2 },
    SOUTH: { dx: 0, dy: 1, angle: Math.PI / 2 },
    EAST: { dx: 1, dy: 0, angle: 0 },
    WEST: { dx: -1, dy: 0, angle: Math.PI }
};

class Player {
    constructor(startCell, tileSize, offsetX = 0, offsetY = 0) {
        this.tileSize = tileSize;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.gridX = startCell.c;
        this.gridY = startCell.r;
        this.pixelX = this.offsetX + (this.gridX + 0.5) * tileSize;
        this.pixelY = this.offsetY + (this.gridY + 0.5) * tileSize;
        
        this.dir = DIR.NONE;
        this.nextDir = DIR.NONE;
        this.facingDir = DIR.EAST;
        this.speed = 3.2; // pixels per frame
        
        // Animation
        this.mouthAngle = 0.2;
        this.mouthOpening = true;
        this.radius = tileSize * 0.44;
    }

    reset(startCell, offsetX = this.offsetX, offsetY = this.offsetY) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.gridX = startCell.c;
        this.gridY = startCell.r;
        this.pixelX = this.offsetX + (this.gridX + 0.5) * this.tileSize;
        this.pixelY = this.offsetY + (this.gridY + 0.5) * this.tileSize;
        this.dir = DIR.NONE;
        this.nextDir = DIR.NONE;
        this.facingDir = DIR.EAST;
    }

    setNextDir(direction) {
        this.nextDir = direction;
    }

    update(maze) {
        // Mouth animation
        if (this.dir !== DIR.NONE) {
            if (this.mouthOpening) {
                this.mouthAngle += 0.05;
                if (this.mouthAngle >= 0.45) this.mouthOpening = false;
            } else {
                this.mouthAngle -= 0.05;
                if (this.mouthAngle <= 0.05) this.mouthOpening = true;
            }
        }

        const centerPixelX = this.offsetX + (this.gridX + 0.5) * this.tileSize;
        const centerPixelY = this.offsetY + (this.gridY + 0.5) * this.tileSize;
        const distToCenter = Math.hypot(this.pixelX - centerPixelX, this.pixelY - centerPixelY);

        // Immediate 180-degree reverse anywhere
        if (this.nextDir !== DIR.NONE && this.nextDir.dx === -this.dir.dx && this.nextDir.dy === -this.dir.dy) {
            this.dir = this.nextDir;
            this.facingDir = this.dir;
            this.nextDir = DIR.NONE;
        }

        // Start immediately if idle and target cell is passable
        if (this.dir === DIR.NONE && this.nextDir !== DIR.NONE) {
            const targetC = this.gridX + this.nextDir.dx;
            const targetR = this.gridY + this.nextDir.dy;
            if (maze.isPassable(targetC, targetR, false)) {
                this.dir = this.nextDir;
                this.facingDir = this.dir;
                this.nextDir = DIR.NONE;
            }
        }

        // Turn check at tile center
        if (distToCenter <= this.speed) {
            // Check nextDir
            if (this.nextDir !== DIR.NONE && this.nextDir !== this.dir) {
                const targetC = this.gridX + this.nextDir.dx;
                const targetR = this.gridY + this.nextDir.dy;
                if (maze.isPassable(targetC, targetR, false)) {
                    this.dir = this.nextDir;
                    this.facingDir = this.dir;
                    this.nextDir = DIR.NONE;
                    this.pixelX = centerPixelX;
                    this.pixelY = centerPixelY;
                }
            }

            // Check if current dir is blocked
            if (this.dir !== DIR.NONE) {
                const targetC = this.gridX + this.dir.dx;
                const targetR = this.gridY + this.dir.dy;
                if (!maze.isPassable(targetC, targetR, false)) {
                    this.dir = DIR.NONE;
                    this.pixelX = centerPixelX;
                    this.pixelY = centerPixelY;
                }
            }
        }

        // Apply movement
        this.pixelX += this.dir.dx * this.speed;
        this.pixelY += this.dir.dy * this.speed;

        // Tunnel Wrap-around
        const minX = this.offsetX;
        const maxX = this.offsetX + maze.cols * this.tileSize;
        if (this.pixelX < minX) this.pixelX = maxX;
        if (this.pixelX > maxX) this.pixelX = minX;

        // Update grid position
        this.gridX = Math.floor((this.pixelX - this.offsetX) / this.tileSize);
        this.gridY = Math.floor((this.pixelY - this.offsetY) / this.tileSize);
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.pixelX, this.pixelY);

        // Handle direction & prevent upside-down Pacman when moving West
        const fDir = this.facingDir || DIR.EAST;
        if (fDir === DIR.WEST) {
            ctx.scale(-1, 1); // Flip horizontally: mouth faces left, eye stays upright!
        } else if (fDir === DIR.NORTH) {
            ctx.rotate(-Math.PI / 2);
        } else if (fDir === DIR.SOUTH) {
            ctx.rotate(Math.PI / 2);
        }

        // Captain Q Pacman Body
        ctx.beginPath();
        const angle = this.mouthAngle * Math.PI;
        ctx.arc(0, 0, this.radius, angle, Math.PI * 2 - angle);
        ctx.lineTo(0, 0);
        ctx.fillStyle = "#ffd700"; // Rich Gold
        ctx.fill();

        // Eye (always placed at upper part of face)
        ctx.beginPath();
        ctx.arc(this.radius * 0.2, -this.radius * 0.55, this.radius * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = "#0c1430";
        ctx.fill();

        ctx.restore();
    }
}

class Ghost {
    constructor(id, name, color, cornerCell, tileSize, offsetX = 0, offsetY = 0) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.cornerCell = cornerCell;
        this.tileSize = tileSize;
        this.offsetX = offsetX;
        this.offsetY = offsetY;

        this.gridX = cornerCell.c;
        this.gridY = cornerCell.r;
        this.pixelX = this.offsetX + (this.gridX + 0.5) * tileSize;
        this.pixelY = this.offsetY + (this.gridY + 0.5) * tileSize;

        this.dir = DIR.NORTH;
        this.speed = 2.2;
        this.state = "CHASE"; // WAITING, EXITING, CHASE, SCATTER, FRIGHTENED, EATEN
        this.exitDelay = 0;
        this.frightenedTimer = 0;
        this.radius = tileSize * 0.42;
        this.bobAngle = Math.random() * Math.PI * 2;
        this.lastDecisionCell = null;
    }

    reset(spawnCell, state = "CHASE", exitDelay = 0, offsetX = this.offsetX, offsetY = this.offsetY) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.gridX = spawnCell.c;
        this.gridY = spawnCell.r;
        this.pixelX = this.offsetX + (this.gridX + 0.5) * this.tileSize;
        this.pixelY = this.offsetY + (this.gridY + 0.5) * this.tileSize;
        this.dir = DIR.NORTH;
        this.state = state;
        this.exitDelay = exitDelay;
        this.frightenedTimer = 0;
        this.lastDecisionCell = null;
    }

    setFrightened(durationSec) {
        if (this.state !== "EATEN" && this.state !== "WAITING" && this.state !== "EXITING") {
            this.state = "FRIGHTENED";
            this.frightenedTimer = durationSec * 60; // frames
        }
    }

    update(maze, player, sanctuaryCenter) {
        const cx = sanctuaryCenter.c;
        const cy = sanctuaryCenter.r;

        // 1. If WAITING inside house:
        if (this.state === "WAITING") {
            this.exitDelay--;
            this.bobAngle += 0.08;
            this.pixelY = this.offsetY + (this.gridY + 0.5) * this.tileSize + Math.sin(this.bobAngle) * 3;
            if (this.exitDelay <= 0) {
                this.state = "EXITING";
            }
            return;
        }

        // 2. If EXITING house:
        if (this.state === "EXITING") {
            const exitR = cy - 3;
            const centerTargetX = this.offsetX + (cx + 0.5) * this.tileSize;
            const exitTargetY = this.offsetY + (exitR + 0.5) * this.tileSize;

            // Center horizontally first
            if (Math.abs(this.pixelX - centerTargetX) > 1.5) {
                this.pixelX += Math.sign(centerTargetX - this.pixelX) * 1.5;
                this.dir = centerTargetX > this.pixelX ? DIR.EAST : DIR.WEST;
            } else {
                this.pixelX = centerTargetX;
                this.dir = DIR.NORTH;
                this.pixelY -= 2.0; // Move up through door
                if (this.pixelY <= exitTargetY) {
                    this.pixelY = exitTargetY;
                    this.gridX = cx;
                    this.gridY = exitR;
                    this.dir = Math.random() > 0.5 ? DIR.WEST : DIR.EAST;
                    this.lastDecisionCell = `${this.gridX},${this.gridY}`;
                    this.state = "CHASE";
                }
            }
            this.gridX = Math.floor((this.pixelX - this.offsetX) / this.tileSize);
            this.gridY = Math.floor((this.pixelY - this.offsetY) / this.tileSize);
            return;
        }

        // 3. Normal roaming (CHASE, SCATTER, FRIGHTENED, EATEN)
        if (this.state === "FRIGHTENED") {
            this.frightenedTimer--;
            if (this.frightenedTimer <= 0) {
                this.state = "CHASE";
            }
        }

        const currentSpeed = this.state === "FRIGHTENED" ? this.speed * 0.65 :
                             this.state === "EATEN" ? this.speed * 2.2 : this.speed;

        const cellKey = `${this.gridX},${this.gridY}`;
        const centerPixelX = this.offsetX + (this.gridX + 0.5) * this.tileSize;
        const centerPixelY = this.offsetY + (this.gridY + 0.5) * this.tileSize;

        // Check if ghost reached or passed tile center
        let reachedCenter = false;
        if (this.lastDecisionCell !== cellKey) {
            if (this.dir === DIR.NONE) {
                reachedCenter = true;
            } else if (this.dir === DIR.EAST && this.pixelX >= centerPixelX) {
                reachedCenter = true;
            } else if (this.dir === DIR.WEST && this.pixelX <= centerPixelX) {
                reachedCenter = true;
            } else if (this.dir === DIR.SOUTH && this.pixelY >= centerPixelY) {
                reachedCenter = true;
            } else if (this.dir === DIR.NORTH && this.pixelY <= centerPixelY) {
                reachedCenter = true;
            }
        }

        // Failsafe: if blocked ahead in current direction, trigger turn
        if (!reachedCenter && this.dir !== DIR.NONE) {
            const nextAheadC = this.gridX + this.dir.dx;
            const nextAheadR = this.gridY + this.dir.dy;
            if (!maze.isPassable(nextAheadC, nextAheadR, this.state === "EATEN")) {
                reachedCenter = true;
            }
        }

        if (reachedCenter) {
            this.pixelX = centerPixelX;
            this.pixelY = centerPixelY;
            this.lastDecisionCell = cellKey;
            this.chooseNextDirection(maze, player, sanctuaryCenter);
        }

        this.pixelX += this.dir.dx * currentSpeed;
        this.pixelY += this.dir.dy * currentSpeed;

        // Tunnel Wrap
        const minX = this.offsetX;
        const maxX = this.offsetX + maze.cols * this.tileSize;
        if (this.pixelX < minX) this.pixelX = maxX;
        if (this.pixelX > maxX) this.pixelX = minX;

        this.gridX = Math.floor((this.pixelX - this.offsetX) / this.tileSize);
        this.gridY = Math.floor((this.pixelY - this.offsetY) / this.tileSize);

        // Check if Eaten reached sanctuary door
        if (this.state === "EATEN") {
            if (this.gridX === cx && this.gridY === cy - 2) {
                this.state = "EXITING";
            }
        }
    }

    chooseNextDirection(maze, player, sanctuaryCenter) {
        let target = { c: player.gridX, r: player.gridY };

        if (this.state === "SCATTER") {
            target = this.cornerCell;
        } else if (this.state === "FRIGHTENED") {
            target = {
                c: Math.floor(Math.random() * maze.cols),
                r: Math.floor(Math.random() * maze.rows)
            };
        } else if (this.state === "EATEN") {
            target = { c: sanctuaryCenter.c, r: sanctuaryCenter.r - 2 };
        } else {
            // Distinct Ghost AI:
            if (this.id === 1) { // Blinky (Red): Direct chase
                target = { c: player.gridX, r: player.gridY };
            } else if (this.id === 2) { // Pinky (Pink): Ambush 3 tiles ahead
                target = { c: player.gridX + player.dir.dx * 3, r: player.gridY + player.dir.dy * 3 };
            } else if (this.id === 3) { // Inky (Cyan): Flanker
                target = { c: player.gridX - player.dir.dx * 2, r: player.gridY - player.dir.dy * 2 };
            } else if (this.id === 4) { // Clyde (Orange): Shy
                const distToP = Math.hypot(this.gridX - player.gridX, this.gridY - player.gridY);
                target = distToP > 6 ? { c: player.gridX, r: player.gridY } : this.cornerCell;
            }
        }

        const validDirs = [];
        const candidates = [DIR.NORTH, DIR.EAST, DIR.SOUTH, DIR.WEST];

        for (let d of candidates) {
            // Avoid immediate reverse at standard intersection
            if (d.dx === -this.dir.dx && d.dy === -this.dir.dy) continue;

            const nextC = this.gridX + d.dx;
            const nextR = this.gridY + d.dy;
            const canPassDoor = (this.state === "EATEN");
            if (maze.isPassable(nextC, nextR, canPassDoor)) {
                const dist = Math.hypot(nextC - target.c, nextR - target.r);
                validDirs.push({ dir: d, dist });
            }
        }

        if (validDirs.length > 0) {
            validDirs.sort((a, b) => a.dist - b.dist);
            this.dir = validDirs[0].dir;
        } else {
            // Dead-end fallback
            for (let d of candidates) {
                const nextC = this.gridX + d.dx;
                const nextR = this.gridY + d.dy;
                if (maze.isPassable(nextC, nextR, this.state === "EATEN")) {
                    this.dir = d;
                    break;
                }
            }
        }
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.pixelX, this.pixelY);

        if (this.state === "EATEN") {
            this.renderEyes(ctx);
            ctx.restore();
            return;
        }

        // Ghost Body
        let bodyColor = this.color;
        if (this.state === "FRIGHTENED") {
            if (this.frightenedTimer < 120 && Math.floor(this.frightenedTimer / 10) % 2 === 0) {
                bodyColor = "#ffffff";
            } else {
                bodyColor = "#2563eb";
            }
        }

        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.arc(0, -this.radius * 0.1, this.radius, Math.PI, 0, false);
        ctx.lineTo(this.radius, this.radius);
        const ripples = 3;
        const ripWidth = (this.radius * 2) / ripples;
        for (let i = ripples; i > 0; i--) {
            const x = -this.radius + i * ripWidth;
            ctx.quadraticCurveTo(x - ripWidth / 2, this.radius * 0.7, x - ripWidth, this.radius);
        }
        ctx.closePath();
        ctx.fill();

        // Eyes
        this.renderEyes(ctx);
        ctx.restore();
    }

    renderEyes(ctx) {
        const eyeOffsetX = this.radius * 0.35;
        const eyeOffsetY = -this.radius * 0.25;
        const eyeRadius = this.radius * 0.28;
        const pupilRadius = this.radius * 0.14;

        // Whites
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(-eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
        ctx.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pupils look towards current movement direction
        const pdx = this.dir.dx * eyeRadius * 0.45;
        const pdy = this.dir.dy * eyeRadius * 0.45;

        ctx.fillStyle = this.state === "FRIGHTENED" ? "#f59e0b" : "#1e3a8a";
        ctx.beginPath();
        ctx.arc(-eyeOffsetX + pdx, eyeOffsetY + pdy, pupilRadius, 0, Math.PI * 2);
        ctx.arc(eyeOffsetX + pdx, eyeOffsetY + pdy, pupilRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}
