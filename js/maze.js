/**
 * Maze Generator and Collision Grid for Captain Q HTML5
 * Generates symmetrical, braided, dead-end-free mazes with central Safe Sanctuary Zone
 */

class Maze {
    constructor(cols = 21, rows = 21, seed = 42) {
        this.cols = cols % 2 === 0 ? cols + 1 : cols;
        this.rows = rows % 2 === 0 ? rows + 1 : rows;
        this.seed = seed;
        
        // 0: Walkable Corridor, 1: Wall, 2: Safe Sanctuary (Safe Haven), 3: Ghost Door
        this.grid = [];
        this.init();
    }

    init() {
        // Pre-fill with walls
        this.grid = Array(this.rows).fill(null).map(() => Array(this.cols).fill(1));
        
        // 1. Carve symmetrical, braided, loop-filled maze
        this.carveSymmetricMaze();
        
        // 2. Carve Central Safe Sanctuary (مساحة الملاذ الآمن)
        this.createSanctuary();

        // 3. Side warp tunnels (Classic Pacman)
        const midRow = Math.floor(this.rows / 2);
        this.grid[midRow][0] = 0;
        this.grid[midRow][1] = 0;
        this.grid[midRow][this.cols - 1] = 0;
        this.grid[midRow][this.cols - 2] = 0;

        // 4. Final braiding & connectivity guarantee
        this.braidMaze();
        this.ensureFullConnectivity();
    }

    pseudoRandom() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    carveSymmetricMaze() {
        const halfCols = Math.floor(this.cols / 2);

        // 1. Outer perimeter corridor
        for (let r = 1; r < this.rows - 1; r++) {
            this.grid[r][1] = 0;
            this.grid[r][this.cols - 2] = 0;
        }
        for (let c = 1; c < this.cols - 1; c++) {
            this.grid[1][c] = 0;
            this.grid[this.rows - 2][c] = 0;
        }

        // 2. Odd-coordinate grid nodes DFS on left half
        const visited = Array(this.rows).fill(null).map(() => Array(this.cols).fill(false));
        const stack = [];

        // Start DFS at top-left corridor node
        const startC = 1;
        const startR = 1;
        visited[startR][startC] = true;
        stack.push({ c: startC, r: startR });

        const dirs = [
            { dc: 0, dr: -2 },
            { dc: 0, dr: 2 },
            { dc: -2, dr: 0 },
            { dc: 2, dr: 0 }
        ];

        while (stack.length > 0) {
            const cur = stack[stack.length - 1];
            // Find unvisited neighbors on left half
            const unvisited = [];
            for (let d of dirs) {
                const nc = cur.c + d.dc;
                const nr = cur.r + d.dr;
                if (nc >= 1 && nc <= halfCols && nr >= 1 && nr < this.rows - 1) {
                    if (!visited[nr][nc]) {
                        unvisited.push({ c: nc, r: nr, dc: d.dc, dr: d.dr });
                    }
                }
            }

            if (unvisited.length > 0) {
                // Pick random neighbor
                const pickIdx = Math.floor(this.pseudoRandom() * unvisited.length);
                const next = unvisited[pickIdx];

                // Knock down path between them
                const midC = cur.c + next.dc / 2;
                const midR = cur.r + next.dr / 2;

                this.grid[cur.r][cur.c] = 0;
                this.grid[midR][midC] = 0;
                this.grid[next.r][next.c] = 0;

                // Symmetrical mirror to right half
                this.grid[cur.r][this.cols - 1 - cur.c] = 0;
                this.grid[midR][this.cols - 1 - midC] = 0;
                this.grid[next.r][this.cols - 1 - next.c] = 0;

                visited[next.r][next.c] = true;
                stack.push({ c: next.c, r: next.r });
            } else {
                stack.pop();
            }
        }

        // 3. Connect center vertical corridors across horizontal midline & key crossbars
        const crossRows = [1, 3, Math.floor(this.rows / 2) - 3, Math.floor(this.rows / 2) + 3, this.rows - 4, this.rows - 2];
        for (let cr of crossRows) {
            if (this.inBounds(halfCols, cr)) {
                this.grid[cr][halfCols - 1] = 0;
                this.grid[cr][halfCols] = 0;
                this.grid[cr][halfCols + 1] = 0;
            }
        }
    }

    createSanctuary() {
        const cx = Math.floor(this.cols / 2);
        const cy = Math.floor(this.rows / 2);

        // Sanctuary Room (7 cols x 5 rows bounding box: cx-3 to cx+3, cy-2 to cy+2)
        // Interior (5 cols x 3 rows): cx-2 to cx+2, cy-1 to cy+1 (type 2: Safe Sanctuary)
        for (let r = cy - 2; r <= cy + 2; r++) {
            for (let c = cx - 3; c <= cx + 3; c++) {
                if (r === cy - 2 || r === cy + 2 || c === cx - 3 || c === cx + 3) {
                    this.grid[r][c] = 1; // Sanctuary perimeter wall
                } else {
                    this.grid[r][c] = 2; // Safe Sanctuary Interior (Safe Haven)
                }
            }
        }

        // 4 Doorways for tactical player escape:
        // North Door (Ghost exit door beam): (cx, cy - 2)
        this.grid[cy - 2][cx] = 3;
        // South Door (Player entrance/exit): (cx, cy + 2)
        this.grid[cy + 2][cx] = 0;
        // West Door (Player entrance/exit): (cx - 3, cy)
        this.grid[cy][cx - 3] = 0;
        // East Door (Player entrance/exit): (cx + 3, cy)
        this.grid[cy][cx + 3] = 0;

        // Ensure clear outer perimeter avenue around all 4 doors
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
        // Connect dead ends to eliminate cul-de-sacs and create smooth arcade loops
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        const cx = Math.floor(this.cols / 2);
        const cy = Math.floor(this.rows / 2);

        for (let r = 1; r < this.rows - 1; r++) {
            for (let c = 1; c < this.cols - 1; c++) {
                // Only consider normal corridors
                if (this.grid[r][c] === 0) {
                    let openNeighbors = 0;
                    dirs.forEach(([dc, dr]) => {
                        const nc = c + dc;
                        const nr = r + dr;
                        if (this.inBounds(nc, nr) && (this.grid[nr][nc] === 0 || this.grid[nr][nc] === 2 || this.grid[nr][nc] === 3)) {
                            openNeighbors++;
                        }
                    });

                    if (openNeighbors <= 1) {
                        // Open a wall to an adjacent cell (prefer not into sanctuary wall)
                        for (let [dc, dr] of dirs) {
                            const nr = r + dr;
                            const nc = c + dc;
                            if (this.inBounds(nc, nr) && this.grid[nr][nc] === 1 &&
                                nr > 0 && nr < this.rows - 1 && nc > 0 && nc < this.cols - 1) {
                                // Avoid breaking sanctuary outer walls
                                if (nc >= cx - 3 && nc <= cx + 3 && nr >= cy - 2 && nr <= cy + 2) continue;
                                this.grid[nr][nc] = 0;
                                // Mirror to keep symmetry
                                this.grid[nr][this.cols - 1 - nc] = 0;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    ensureFullConnectivity() {
        // BFS from player spawn to make sure 100% of corridor cells are reachable
        const pSpawn = this.getPlayerSpawn();
        const visited = Array(this.rows).fill(null).map(() => Array(this.cols).fill(false));
        const queue = [pSpawn];
        visited[pSpawn.r][pSpawn.c] = true;

        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];

        while (queue.length > 0) {
            const { c, r } = queue.shift();
            for (let [dc, dr] of dirs) {
                const nc = c + dc;
                const nr = r + dr;
                if (this.inBounds(nc, nr) && !visited[nr][nc] && this.isPassable(nc, nr, true, false)) {
                    visited[nr][nc] = true;
                    queue.push({ c: nc, r: nr });
                }
            }
        }

        // If any corridor is unvisited, bridge it to a visited neighbor
        for (let r = 1; r < this.rows - 1; r++) {
            for (let c = 1; c < this.cols - 1; c++) {
                if (this.grid[r][c] === 0 && !visited[r][c]) {
                    for (let [dc, dr] of dirs) {
                        const nc = c + dc;
                        const nr = r + dr;
                        if (this.inBounds(nc, nr) && visited[nr][nc]) {
                            this.grid[r][c] = 0;
                            visited[r][c] = true;
                            break;
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

    isSanctuary(c, r) {
        if (!this.inBounds(c, r)) return false;
        return this.grid[r][c] === 2;
    }

    isPassable(c, r, canPassGhostDoor = false, isGhost = false) {
        if (!this.inBounds(c, r)) {
            // Check warp tunnel
            const midRow = Math.floor(this.rows / 2);
            if (r === midRow && (c < 0 || c >= this.cols)) return true;
            return false;
        }
        const cell = this.grid[r][c];
        if (cell === 1) return false; // Wall
        if (cell === 3) return canPassGhostDoor || !isGhost; // Doorway
        if (cell === 2) {
            // Safe Sanctuary: strictly barred for active ghosts!
            if (isGhost) return canPassGhostDoor; // only exiting or eaten ghosts returning can traverse
            return true; // Player can always freely enter sanctuary!
        }
        return true;
    }

    getWalkableCells() {
        const list = [];
        for (let r = 1; r < this.rows - 1; r++) {
            for (let c = 1; c < this.cols - 1; c++) {
                // Collectibles are only placed in normal corridors, strictly outside sanctuary
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
