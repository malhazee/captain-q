/**
 * Maze Generator and Collision Grid for Captain Q HTML5
 * Generates symmetrical, braided, dead-end-free mazes with central ghost sanctuary
 */

class Maze {
    constructor(cols = 21, rows = 21, seed = 42) {
        this.cols = cols % 2 === 0 ? cols + 1 : cols;
        this.rows = rows % 2 === 0 ? rows + 1 : rows;
        this.seed = seed;
        
        // 0: Corridor/Empty, 1: Wall, 2: Ghost House, 3: Ghost Door
        this.grid = [];
        this.init();
    }

    init() {
        // Pre-fill with walls
        this.grid = Array(this.rows).fill(null).map(() => Array(this.cols).fill(1));
        
        // Carve classical balanced Pac-Man style layout
        this.carveSymmetricMaze();
        
        // Carve Central Ghost Sanctuary
        this.createSanctuary();

        // Add side warp tunnels (classic Pacman)
        const midRow = Math.floor(this.rows / 2);
        this.grid[midRow][0] = 0;
        this.grid[midRow][1] = 0;
        this.grid[midRow][this.cols - 1] = 0;
        this.grid[midRow][this.cols - 2] = 0;

        // Ensure loops / remove any remaining dead ends (braided)
        this.braidMaze();
    }

    pseudoRandom() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    carveSymmetricMaze() {
        // Simple procedural symmetric carving
        const halfCols = Math.floor(this.cols / 2);

        for (let r = 1; r < this.rows - 1; r++) {
            for (let c = 1; c <= halfCols; c++) {
                // Outer ring corridor
                if (r === 1 || r === this.rows - 2 || c === 1) {
                    this.grid[r][c] = 0;
                    this.grid[r][this.cols - 1 - c] = 0;
                    continue;
                }

                // Grid pathways every 2 units
                if (r % 2 === 1 || c % 2 === 1) {
                    if (this.pseudoRandom() > 0.28) {
                        this.grid[r][c] = 0;
                        this.grid[r][this.cols - 1 - c] = 0;
                    }
                }
            }
        }
    }

    createSanctuary() {
        const cx = Math.floor(this.cols / 2);
        const cy = Math.floor(this.rows / 2);

        // 5x5 room
        for (let r = cy - 2; r <= cy + 2; r++) {
            for (let c = cx - 3; c <= cx + 3; c++) {
                if (r === cy - 2 || r === cy + 2 || c === cx - 3 || c === cx + 3) {
                    this.grid[r][c] = 1; // sanctuary wall
                } else {
                    this.grid[r][c] = 2; // inside house
                }
            }
        }

        // Ghost Door at top
        this.grid[cy - 2][cx] = 3;

        // Ensure open perimeter around house
        for (let c = cx - 4; c <= cx + 4; c++) {
            if (this.inBounds(c, cy - 3)) this.grid[cy - 3][c] = 0;
            if (this.inBounds(c, cy + 3)) this.grid[cy + 3][c] = 0;
        }
        for (let r = cy - 3; r <= cy + 3; r++) {
            if (this.inBounds(cx - 4, r)) this.grid[r][cx - 4] = 0;
            if (this.inBounds(cx + 4, r)) this.grid[r][cx + 4] = 0;
        }
    }

    braidMaze() {
        // Connect dead ends so player and ghosts never get trapped
        for (let r = 1; r < this.rows - 1; r++) {
            for (let c = 1; c < this.cols - 1; c++) {
                if (this.grid[r][c] === 0) {
                    let openNeighbors = 0;
                    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
                    dirs.forEach(([dc, dr]) => {
                        if (this.grid[r + dr][c + dc] === 0) openNeighbors++;
                    });
                    if (openNeighbors <= 1) {
                        // Open a wall to an adjacent cell
                        for (let [dc, dr] of dirs) {
                            const nr = r + dr;
                            const nc = c + dc;
                            if (this.inBounds(nc, nr) && this.grid[nr][nc] === 1 &&
                                nr > 0 && nr < this.rows - 1 && nc > 0 && nc < this.cols - 1) {
                                this.grid[nr][nc] = 0;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    inBounds(c, r) {
        return c >= 0 && c < this.cols && r >= 0 && r < this.rows;
    }

    isWall(c, r) {
        if (!this.inBounds(c, r)) return true;
        return this.grid[r][c] === 1;
    }

    isPassable(c, r, canPassGhostDoor = false) {
        if (!this.inBounds(c, r)) {
            // Check warp tunnel
            const midRow = Math.floor(this.rows / 2);
            if (r === midRow && (c < 0 || c >= this.cols)) return true;
            return false;
        }
        const cell = this.grid[r][c];
        if (cell === 1) return false;
        if (cell === 3) return canPassGhostDoor;
        return true;
    }

    getWalkableCells() {
        const list = [];
        for (let r = 1; r < this.rows - 1; r++) {
            for (let c = 1; c < this.cols - 1; c++) {
                if (this.grid[r][c] === 0) {
                    list.push({ c, r });
                }
            }
        }
        return list;
    }

    getPlayerSpawn() {
        const cx = Math.floor(this.cols / 2);
        const cy = Math.floor(this.rows / 2) + 4;
        if (this.inBounds(cx, cy) && this.grid[cy][cx] === 0) {
            return { c: cx, r: cy };
        }
        const walk = this.getWalkableCells();
        return walk[walk.length - 1] || { c: 1, r: 1 };
    }

    getGhostHouseSpawn() {
        const cx = Math.floor(this.cols / 2);
        const cy = Math.floor(this.rows / 2);
        return { c: cx, r: cy };
    }
}
