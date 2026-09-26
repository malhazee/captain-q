/**
 * Entities Module for Captain Q HTML5
 * Implements Captain Q (Player) and the 4 Ghosts with classical AI states
 */

const DIR = {
    NONE: { dx: 0, dy: 0, angle: 0 },
    NORTH: { dx: 0, dy: -1, angle: -Math.PI / 2 },
    SOUTH: { dx: 0, dy: 1, angle: Math.PI / 2 },
    EAST: { dx: 1, dy: 0, angle: 0 },
    WEST: { dx: -1, dy: 0, angle: Math.PI }
};

class Player {
    constructor(startCell, tileSize) {
        this.tileSize = tileSize;
        this.gridX = startCell.c;
        this.gridY = startCell.r;
        this.pixelX = (this.gridX + 0.5) * tileSize;
        this.pixelY = (this.gridY + 0.5) * tileSize;
        
        this.dir = DIR.NONE;
        this.nextDir = DIR.NONE;
        this.speed = 3.2; // pixels per frame
        
        // Animation
        this.mouthAngle = 0.2;
        this.mouthOpening = true;
        this.radius = tileSize * 0.44;
    }

    reset(startCell) {
        this.gridX = startCell.c;
        this.gridY = startCell.r;
        this.pixelX = (this.gridX + 0.5) * this.tileSize;
        this.pixelY = (this.gridY + 0.5) * this.tileSize;
        this.dir = DIR.NONE;
        this.nextDir = DIR.NONE;
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

        const centerPixelX = (this.gridX + 0.5) * this.tileSize;
        const centerPixelY = (this.gridY + 0.5) * this.tileSize;
        const distToCenter = Math.hypot(this.pixelX - centerPixelX, this.pixelY - centerPixelY);

        // Turn check at tile center
        if (distToCenter <= this.speed) {
            // Check nextDir
            if (this.nextDir !== DIR.NONE && this.nextDir !== this.dir) {
                const targetC = this.gridX + this.nextDir.dx;
                const targetR = this.gridY + this.nextDir.dy;
                if (maze.isPassable(targetC, targetR, false)) {
                    this.dir = this.nextDir;
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
        const maxPixelX = maze.cols * this.tileSize;
        if (this.pixelX < 0) this.pixelX = maxPixelX;
        if (this.pixelX > maxPixelX) this.pixelX = 0;

        // Update grid position
        this.gridX = Math.floor(this.pixelX / this.tileSize);
        this.gridY = Math.floor(this.pixelY / this.tileSize);
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.pixelX, this.pixelY);
        ctx.rotate(this.dir.angle);

        // Captain Q Pacman Body
        ctx.beginPath();
        const angle = this.mouthAngle * Math.PI;
        ctx.arc(0, 0, this.radius, angle, Math.PI * 2 - angle);
        ctx.lineTo(0, 0);
        ctx.fillStyle = "#ffd700"; // Rich Gold
        ctx.fill();

        // Eye
        ctx.beginPath();
        ctx.arc(this.radius * 0.2, -this.radius * 0.55, this.radius * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = "#0c1430";
        ctx.fill();

        ctx.restore();
    }
}

class Ghost {
    constructor(id, name, color, cornerCell, tileSize) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.cornerCell = cornerCell;
        this.tileSize = tileSize;

        this.gridX = cornerCell.c;
        this.gridY = cornerCell.r;
        this.pixelX = (this.gridX + 0.5) * tileSize;
        this.pixelY = (this.gridY + 0.5) * tileSize;

        this.dir = DIR.NORTH;
        this.speed = 2.2;
        this.state = "CHASE"; // CHASE, SCATTER, FRIGHTENED, EATEN
        this.frightenedTimer = 0;
        this.radius = tileSize * 0.42;
    }

    reset(spawnCell) {
        this.gridX = spawnCell.c;
        this.gridY = spawnCell.r;
        this.pixelX = (this.gridX + 0.5) * this.tileSize;
        this.pixelY = (this.gridY + 0.5) * this.tileSize;
        this.dir = DIR.NORTH;
        this.state = "CHASE";
        this.frightenedTimer = 0;
    }

    setFrightened(durationSec) {
        if (this.state !== "EATEN") {
            this.state = "FRIGHTENED";
            this.frightenedTimer = durationSec * 60; // frames
        }
    }

    update(maze, player, sanctuarySpawn) {
        if (this.state === "FRIGHTENED") {
            this.frightenedTimer--;
            if (this.frightenedTimer <= 0) {
                this.state = "CHASE";
            }
        }

        const currentSpeed = this.state === "FRIGHTENED" ? this.speed * 0.65 :
                             this.state === "EATEN" ? this.speed * 2.0 : this.speed;

        const centerPixelX = (this.gridX + 0.5) * this.tileSize;
        const centerPixelY = (this.gridY + 0.5) * this.tileSize;
        const distToCenter = Math.hypot(this.pixelX - centerPixelX, this.pixelY - centerPixelY);

        if (distToCenter <= currentSpeed) {
            this.pixelX = centerPixelX;
            this.pixelY = centerPixelY;
            this.chooseNextDirection(maze, player, sanctuarySpawn);
        }

        this.pixelX += this.dir.dx * currentSpeed;
        this.pixelY += this.dir.dy * currentSpeed;

        // Tunnel Wrap
        const maxPixelX = maze.cols * this.tileSize;
        if (this.pixelX < 0) this.pixelX = maxPixelX;
        if (this.pixelX > maxPixelX) this.pixelX = 0;

        this.gridX = Math.floor(this.pixelX / this.tileSize);
        this.gridY = Math.floor(this.pixelY / this.tileSize);

        // Check if Eaten reached sanctuary
        if (this.state === "EATEN") {
            if (this.gridX === sanctuarySpawn.c && this.gridY === sanctuarySpawn.r) {
                this.state = "CHASE";
            }
        }
    }

    chooseNextDirection(maze, player, sanctuarySpawn) {
        let target = { c: player.gridX, r: player.gridY };

        if (this.state === "SCATTER") {
            target = this.cornerCell;
        } else if (this.state === "FRIGHTENED") {
            // Random direction at intersections
            target = {
                c: Math.floor(Math.random() * maze.cols),
                r: Math.floor(Math.random() * maze.rows)
            };
        } else if (this.state === "EATEN") {
            target = sanctuarySpawn;
        }

        const validDirs = [];
        const candidates = [DIR.NORTH, DIR.EAST, DIR.SOUTH, DIR.WEST];

        for (let d of candidates) {
            // Avoid immediate 180-degree turn unless dead-end
            if (d.dx === -this.dir.dx && d.dy === -this.dir.dy) continue;

            const nextC = this.gridX + d.dx;
            const nextR = this.gridY + d.dy;
            const canPassDoor = this.state === "EATEN" || this.gridY >= sanctuarySpawn.r - 1 && this.gridY <= sanctuarySpawn.r + 1;
            if (maze.isPassable(nextC, nextR, canPassDoor)) {
                const dist = Math.hypot(nextC - target.c, nextR - target.r);
                validDirs.push({ dir: d, dist });
            }
        }

        if (validDirs.length > 0) {
            validDirs.sort((a, b) => a.dist - b.dist);
            this.dir = validDirs[0].dir;
        } else {
            // Reverse if completely blocked
            this.dir = { dx: -this.dir.dx, dy: -this.dir.dy, angle: (this.dir.angle + Math.PI) % (Math.PI * 2) };
        }
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.pixelX, this.pixelY);

        if (this.state === "EATEN") {
            // Just Draw Eyes
            this.renderEyes(ctx);
            ctx.restore();
            return;
        }

        // Ghost Body
        let bodyColor = this.color;
        if (this.state === "FRIGHTENED") {
            // Flash white near end
            if (this.frightenedTimer < 120 && Math.floor(this.frightenedTimer / 10) % 2 === 0) {
                bodyColor = "#ffffff";
            } else {
                bodyColor = "#2563eb"; // Vulnerable deep blue
            }
        }

        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        // Head dome
        ctx.arc(0, -this.radius * 0.1, this.radius, Math.PI, 0, false);
        // Body skirt with ripples
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
