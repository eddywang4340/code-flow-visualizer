export interface Position {
    x: number;
    y: number;
    vx?: number;
    vy?: number;
}

export interface FunctionInfo {
    name: string;
    calls: string[];
    calledBy: string[];
    fileName?: string;
    complexity?: number;
}

export function calculateForceLayout(
    functions: FunctionInfo[],
    width: number,
    height: number
): Position[] {
    const cols = Math.ceil(Math.sqrt(functions.length));
    const spacing = Math.min(width, height) / (cols + 1);
    
    const positions = functions.map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return {
            x: spacing * (col + 1) + (Math.random() - 0.5) * 20,
            y: spacing * (row + 1) + (Math.random() - 0.5) * 20,
            vx: 0,
            vy: 0
        };
    });

    if (width <= 0 || height <= 0) {
        return positions.map(() => ({ x: 100, y: 100, vx: 0, vy: 0 }));
    }

    // Run force simulation
    for (let iter = 0; iter < 150; iter++) {
        // Repulsion between all nodes
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const dx = positions[j].x - positions[i].x;
                const dy = positions[j].y - positions[i].y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                const minDistance = 100;
                
                if (distance < minDistance) {
                    const force = (minDistance - distance) / distance * 3;
                    positions[i].vx! -= (dx / distance) * force;
                    positions[i].vy! -= (dy / distance) * force;
                    positions[j].vx! += (dx / distance) * force;
                    positions[j].vy! += (dy / distance) * force;
                } else {
                    const force = 2500 / (distance * distance);
                    positions[i].vx! -= (dx / distance) * force;
                    positions[i].vy! -= (dy / distance) * force;
                    positions[j].vx! += (dx / distance) * force;
                    positions[j].vy! += (dy / distance) * force;
                }
            }
        }

        // Attraction for function calls
        functions.forEach((func, i) => {
            func.calls.forEach(calledFunc => {
                const j = functions.findIndex(f => f.name === calledFunc);
                if (j !== -1) {
                    const dx = positions[j].x - positions[i].x;
                    const dy = positions[j].y - positions[i].y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = distance * 0.008;
                    
                    positions[i].vx! += (dx / distance) * force;
                    positions[i].vy! += (dy / distance) * force;
                    positions[j].vx! -= (dx / distance) * force;
                    positions[j].vy! -= (dy / distance) * force;
                }
            });
        });

        // Update positions with damping
        positions.forEach(pos => {
            pos.x += pos.vx!;
            pos.y += pos.vy!;
            pos.vx! *= 0.85;
            pos.vy! *= 0.85;

            pos.x = Math.max(80, Math.min(width - 80, pos.x));
            pos.y = Math.max(80, Math.min(height - 80, pos.y));
        });
    }

    return positions;
}

export function calculateClusteredLayout(
    functions: FunctionInfo[],
    width: number,
    height: number
): Position[] {
    const clusters = new Map<string, Array<{ func: FunctionInfo; index: number }>>();
    
    functions.forEach((func, i) => {
        const fileName = func.fileName || 'default';
        if (!clusters.has(fileName)) {
            clusters.set(fileName, []);
        }
        clusters.get(fileName)!.push({ func, index: i });
    });

    const clusterArray = Array.from(clusters.entries());
    const numClusters = clusterArray.length;
    
    // Better grid calculation with more spacing
    const cols = Math.ceil(Math.sqrt(numClusters * 1.5));
    const rows = Math.ceil(numClusters / cols);
    
    const horizontalMargin = 400;
    const verticalMargin = 300;
    const clusterWidth = Math.max(250, (width - horizontalMargin) / cols);
    const clusterHeight = Math.max(200, (height - verticalMargin) / rows);

    const positions: Position[] = new Array(functions.length);

    clusterArray.forEach(([fileName, nodes], clusterIndex) => {
        const col = clusterIndex % cols;
        const row = Math.floor(clusterIndex / cols);
        
        const clusterCenterX = horizontalMargin / 2 + col * clusterWidth + clusterWidth / 2;
        const clusterCenterY = verticalMargin / 2 + row * clusterHeight + clusterHeight / 2;

        // Initialize positions within cluster
        const clusterPositions = nodes.map(() => ({
            x: clusterCenterX + (Math.random() - 0.5) * (clusterWidth * 0.4),
            y: clusterCenterY + (Math.random() - 0.5) * (clusterHeight * 0.4),
            vx: 0,
            vy: 0
        }));

        // Force simulation within cluster
        for (let iter = 0; iter < 120; iter++) {
            // Repulsion between nodes in same cluster
            for (let i = 0; i < clusterPositions.length; i++) {
                for (let j = i + 1; j < clusterPositions.length; j++) {
                    const dx = clusterPositions[j].x - clusterPositions[i].x;
                    const dy = clusterPositions[j].y - clusterPositions[i].y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    const minDistance = 80;
                    
                    if (distance < minDistance) {
                        const force = (minDistance - distance) / distance * 2;
                        clusterPositions[i].vx -= (dx / distance) * force;
                        clusterPositions[i].vy -= (dy / distance) * force;
                        clusterPositions[j].vx += (dx / distance) * force;
                        clusterPositions[j].vy += (dy / distance) * force;
                    } else {
                        const force = 800 / (distance * distance);
                        clusterPositions[i].vx -= (dx / distance) * force;
                        clusterPositions[i].vy -= (dy / distance) * force;
                        clusterPositions[j].vx += (dx / distance) * force;
                        clusterPositions[j].vy += (dy / distance) * force;
                    }
                }
            }

            // Attraction for function calls within cluster
            nodes.forEach(({ func }, i) => {
                func.calls.forEach(calledFunc => {
                    const j = nodes.findIndex(n => n.func.name === calledFunc);
                    if (j !== -1) {
                        const dx = clusterPositions[j].x - clusterPositions[i].x;
                        const dy = clusterPositions[j].y - clusterPositions[i].y;
                        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                        const force = distance * 0.008;
                        
                        clusterPositions[i].vx += (dx / distance) * force;
                        clusterPositions[i].vy += (dy / distance) * force;
                        clusterPositions[j].vx -= (dx / distance) * force;
                        clusterPositions[j].vy -= (dy / distance) * force;
                    }
                });
            });

            // Center attraction
            clusterPositions.forEach(pos => {
                const dx = clusterCenterX - pos.x;
                const dy = clusterCenterY - pos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const force = distance * 0.003;
                
                pos.vx += (dx / distance) * force;
                pos.vy += (dy / distance) * force;
            });

            // Update positions with damping
            clusterPositions.forEach(pos => {
                pos.x += pos.vx;
                pos.y += pos.vy;
                pos.vx *= 0.8;
                pos.vy *= 0.8;

                const margin = 30;
                pos.x = Math.max(clusterCenterX - clusterWidth / 2 + margin,
                    Math.min(clusterCenterX + clusterWidth / 2 - margin, pos.x));
                pos.y = Math.max(clusterCenterY - clusterHeight / 2 + margin,
                    Math.min(clusterCenterY + clusterHeight / 2 - margin, pos.y));
            });
        }

        // Assign final positions
        nodes.forEach(({ index }, i) => {
            positions[index] = clusterPositions[i];
        });
    });

    return positions;
}

export function calculateHierarchicalLayout(
    functions: FunctionInfo[],
    width: number,
    height: number
): Position[] {
    const positions: Position[] = [];
    const levels = new Map<number, FunctionInfo[]>();
    const visited = new Set<string>();

    function getMaxDepth(node: FunctionInfo, depthVisited = new Set<string>()): number {
        if (depthVisited.has(node.name)) {
            return 0;
        }
        depthVisited.add(node.name);
        
        if (node.calls.length === 0) {
            return 0;
        }
        
        let maxDepth = 0;
        node.calls.forEach(calledName => {
            const called = functions.find(f => f.name === calledName);
            if (called) {
                const depth = getMaxDepth(called, new Set(depthVisited));
                maxDepth = Math.max(maxDepth, depth + 1);
            }
        });
        
        return maxDepth;
    }

    // Find meaningful nodes (deep call chains or hubs)
    const meaningfulNodes = new Set<string>();
    
    functions.forEach(func => {
        const depth = getMaxDepth(func);
        if (depth >= 2 || func.calledBy.length >= 2) {
            meaningfulNodes.add(func.name);
            const toVisit = [func];
            const chainVisited = new Set<string>();
            
            while (toVisit.length > 0) {
                const current = toVisit.pop()!;
                if (chainVisited.has(current.name)) {
                    continue;
                }
                chainVisited.add(current.name);
                meaningfulNodes.add(current.name);
                
                current.calls.forEach(calledName => {
                    const called = functions.find(f => f.name === calledName);
                    if (called && !chainVisited.has(called.name)) {
                        toVisit.push(called);
                    }
                });
            }
        }
    });

    // Include callers of meaningful nodes
    functions.forEach(func => {
        func.calls.forEach(calledName => {
            if (meaningfulNodes.has(calledName)) {
                meaningfulNodes.add(func.name);
            }
        });
    });

    const functionsToDisplay = meaningfulNodes.size > 0
        ? functions.filter(f => meaningfulNodes.has(f.name))
        : functions.filter(f => f.calls.length > 0 || f.calledBy.length > 0);

    const roots = functionsToDisplay.filter(f =>
        f.calledBy.length === 0 ||
        !f.calledBy.some(caller => meaningfulNodes.has(caller))
    );
    
    if (roots.length === 0 && functionsToDisplay.length > 0) {
        roots.push(functionsToDisplay[0]);
    }
    
    function assignLevels(node: FunctionInfo, level: number) {
        if (visited.has(node.name)) {
            return;
        }
        visited.add(node.name);
        
        if (!levels.has(level)) {
            levels.set(level, []);
        }
        levels.get(level)!.push(node);

        node.calls.forEach(calledName => {
            const called = functionsToDisplay.find(f => f.name === calledName);
            if (called) {
                assignLevels(called, level + 1);
            }
        });
    }

    roots.forEach(root => assignLevels(root, 0));

    // Initialize all positions
    for (let i = 0; i < functions.length; i++) {
        const func = functions[i];
        if (visited.has(func.name)) {
            positions[i] = { x: 0, y: 0 };
        } else {
            positions[i] = { x: -10000, y: -10000 }; // Hidden
        }
    }

    // Position visible nodes by level
    const maxLevel = levels.size > 0 ? Math.max(...levels.keys()) : 0;
    levels.forEach((nodes, level) => {
        const y = maxLevel > 0 ? (level / maxLevel) * (height - 100) + 50 : height / 2;
        nodes.forEach((node, index) => {
            const x = nodes.length > 1
                ? (index / (nodes.length - 1)) * (width - 100) + 50
                : width / 2;
            const funcIndex = functions.indexOf(node);
            if (funcIndex !== -1) {
                positions[funcIndex] = { x, y };
            }
        });
    });

    return positions;
}