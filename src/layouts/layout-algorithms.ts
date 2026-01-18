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

/**
 * Improved force-directed layout with better spacing and collision avoidance
 */
export function calculateForceLayout(
    functions: FunctionInfo[],
    width: number,
    height: number
): Position[] {
    if (width <= 0 || height <= 0) {
        return functions.map(() => ({ x: 100, y: 100, vx: 0, vy: 0 }));
    }

    // Calculate optimal grid spacing based on node count
    const nodeCount = functions.length;
    const cols = Math.ceil(Math.sqrt(nodeCount * 1.5)); // More horizontal space
    const rows = Math.ceil(nodeCount / cols);
    
    // Much larger spacing - nodes should have plenty of room
    const spacingX = Math.max(180, (width - 200) / (cols + 1));
    const spacingY = Math.max(160, (height - 200) / (rows + 1));
    
    // Initialize positions in a well-spaced grid
    const positions = functions.map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return {
            x: 100 + spacingX * (col + 1) + (Math.random() - 0.5) * 30,
            y: 100 + spacingY * (row + 1) + (Math.random() - 0.5) * 30,
            vx: 0,
            vy: 0
        };
    });

    // Enhanced force simulation with better parameters
    const iterations = 200; // More iterations for better settling
    const nodeRadius = 30; // Base radius for collision detection
    
    for (let iter = 0; iter < iterations; iter++) {
        const decay = 1 - (iter / iterations); // Gradually reduce forces
        
        // Repulsion between all nodes (prevent overlaps)
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const dx = positions[j].x - positions[i].x;
                const dy = positions[j].y - positions[i].y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                
                // Adaptive minimum distance based on complexity
                const complexityI = (functions[i].complexity || 0);
                const complexityJ = (functions[j].complexity || 0);
                const minDistance = 140 + (complexityI + complexityJ) * 5;
                
                if (distance < minDistance) {
                    // Strong repulsion when too close
                    const force = ((minDistance - distance) / distance) * 4 * decay;
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;
                    
                    positions[i].vx! -= fx;
                    positions[i].vy! -= fy;
                    positions[j].vx! += fx;
                    positions[j].vy! += fy;
                } else {
                    // Weak repulsion at distance
                    const force = (3000 / (distance * distance)) * decay;
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;
                    
                    positions[i].vx! -= fx;
                    positions[i].vy! -= fy;
                    positions[j].vx! += fx;
                    positions[j].vy! += fy;
                }
            }
        }

        // Attraction for connected nodes (function calls)
        functions.forEach((func, i) => {
            func.calls.forEach(calledFunc => {
                const j = functions.findIndex(f => f.name === calledFunc);
                if (j !== -1) {
                    const dx = positions[j].x - positions[i].x;
                    const dy = positions[j].y - positions[i].y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    
                    // Moderate attraction - want them close but not too close
                    const optimalDistance = 200;
                    const force = (distance - optimalDistance) * 0.01 * decay;
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;
                    
                    positions[i].vx! += fx;
                    positions[i].vy! += fy;
                    positions[j].vx! -= fx;
                    positions[j].vy! -= fy;
                }
            });
        });

        // Center gravity (keep nodes from flying off screen)
        const centerX = width / 2;
        const centerY = height / 2;
        const gravityStrength = 0.002 * decay;
        
        positions.forEach(pos => {
            const dx = centerX - pos.x;
            const dy = centerY - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                pos.vx! += (dx / distance) * gravityStrength * distance;
                pos.vy! += (dy / distance) * gravityStrength * distance;
            }
        });

        // Update positions with velocity damping
        const damping = 0.82; // Higher damping = slower movement
        positions.forEach(pos => {
            pos.x += pos.vx!;
            pos.y += pos.vy!;
            pos.vx! *= damping;
            pos.vy! *= damping;

            // Keep within bounds with padding
            const padding = 100;
            pos.x = Math.max(padding, Math.min(width - padding, pos.x));
            pos.y = Math.max(padding, Math.min(height - padding, pos.y));
        });
    }

    return positions;
}

/**
 * Improved clustered layout for workspace visualization
 */
export function calculateClusteredLayout(
    functions: FunctionInfo[],
    width: number,
    height: number
): Position[] {
    const clusters = new Map<string, Array<{ func: FunctionInfo; index: number }>>();
    
    // Group functions by file
    functions.forEach((func, i) => {
        const fileName = func.fileName || 'default';
        if (!clusters.has(fileName)) {
            clusters.set(fileName, []);
        }
        clusters.get(fileName)!.push({ func, index: i });
    });

    const clusterArray = Array.from(clusters.entries());
    const numClusters = clusterArray.length;
    
    // Improved grid calculation for better spacing
    const cols = Math.ceil(Math.sqrt(numClusters * 2)); // Even more horizontal space
    const rows = Math.ceil(numClusters / cols);
    
    // Generous margins and spacing
    const horizontalMargin = 500;
    const verticalMargin = 400;
    const clusterWidth = Math.max(300, (width - horizontalMargin) / cols);
    const clusterHeight = Math.max(250, (height - verticalMargin) / rows);

    const positions: Position[] = new Array(functions.length);

    clusterArray.forEach(([fileName, nodes], clusterIndex) => {
        const col = clusterIndex % cols;
        const row = Math.floor(clusterIndex / cols);
        
        const clusterCenterX = horizontalMargin / 2 + col * clusterWidth + clusterWidth / 2;
        const clusterCenterY = verticalMargin / 2 + row * clusterHeight + clusterHeight / 2;

        // Initialize positions within cluster
        const clusterPositions = nodes.map(() => ({
            x: clusterCenterX + (Math.random() - 0.5) * (clusterWidth * 0.5),
            y: clusterCenterY + (Math.random() - 0.5) * (clusterHeight * 0.5),
            vx: 0,
            vy: 0
        }));

        // Force simulation within each cluster
        for (let iter = 0; iter < 150; iter++) {
            const decay = 1 - (iter / 150);
            
            // Repulsion between nodes in same cluster
            for (let i = 0; i < clusterPositions.length; i++) {
                for (let j = i + 1; j < clusterPositions.length; j++) {
                    const dx = clusterPositions[j].x - clusterPositions[i].x;
                    const dy = clusterPositions[j].y - clusterPositions[i].y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    const minDistance = 100; // Minimum spacing within cluster
                    
                    if (distance < minDistance) {
                        const force = ((minDistance - distance) / distance) * 2.5 * decay;
                        const fx = (dx / distance) * force;
                        const fy = (dy / distance) * force;
                        
                        clusterPositions[i].vx -= fx;
                        clusterPositions[i].vy -= fy;
                        clusterPositions[j].vx += fx;
                        clusterPositions[j].vy += fy;
                    } else {
                        const force = (1000 / (distance * distance)) * decay;
                        const fx = (dx / distance) * force;
                        const fy = (dy / distance) * force;
                        
                        clusterPositions[i].vx -= fx;
                        clusterPositions[i].vy -= fy;
                        clusterPositions[j].vx += fx;
                        clusterPositions[j].vy += fy;
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
                        const force = distance * 0.01 * decay;
                        
                        clusterPositions[i].vx += (dx / distance) * force;
                        clusterPositions[i].vy += (dy / distance) * force;
                        clusterPositions[j].vx -= (dx / distance) * force;
                        clusterPositions[j].vy -= (dy / distance) * force;
                    }
                });
            });

            // Center attraction to keep cluster together
            clusterPositions.forEach(pos => {
                const dx = clusterCenterX - pos.x;
                const dy = clusterCenterY - pos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const force = distance * 0.004 * decay;
                
                if (distance > 0) {
                    pos.vx += (dx / distance) * force;
                    pos.vy += (dy / distance) * force;
                }
            });

            // Update positions with damping
            clusterPositions.forEach(pos => {
                pos.x += pos.vx;
                pos.y += pos.vy;
                pos.vx *= 0.8;
                pos.vy *= 0.8;

                // Keep within cluster bounds
                const margin = 40;
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

/**
 * Hierarchical layout with improved spacing
 */
export function calculateHierarchicalLayout(
    functions: FunctionInfo[],
    width: number,
    height: number
): Position[] {
    const positions: Position[] = [];
    const levels = new Map<number, FunctionInfo[]>();
    const visited = new Set<string>();

    function getMaxDepth(node: FunctionInfo, depthVisited = new Set<string>()): number {
        if (depthVisited.has(node.name)) return 0;
        depthVisited.add(node.name);
        
        if (node.calls.length === 0) return 0;
        
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
                if (chainVisited.has(current.name)) continue;
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
        if (visited.has(node.name)) return;
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

    // Position visible nodes by level with better spacing
    const maxLevel = levels.size > 0 ? Math.max(...levels.keys()) : 0;
    const horizontalPadding = 150;
    const verticalPadding = 120;
    
    levels.forEach((nodes, level) => {
        const y = maxLevel > 0 
            ? verticalPadding + (level / maxLevel) * (height - 2 * verticalPadding)
            : height / 2;
            
        nodes.forEach((node, index) => {
            const nodeCount = nodes.length;
            let x: number;
            
            if (nodeCount === 1) {
                x = width / 2;
            } else {
                // Improved horizontal spacing
                const availableWidth = width - 2 * horizontalPadding;
                const spacing = Math.min(250, availableWidth / (nodeCount - 1));
                const totalWidth = spacing * (nodeCount - 1);
                const startX = (width - totalWidth) / 2;
                x = startX + spacing * index;
            }
            
            const funcIndex = functions.indexOf(node);
            if (funcIndex !== -1) {
                positions[funcIndex] = { x, y };
            }
        });
    });

    return positions;
}