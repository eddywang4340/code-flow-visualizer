import * as vscode from 'vscode';
import * as path from 'path';
import { CodeAnalysis } from './analyzer';

export class FlowVisualizer {
    public static currentPanel: FlowVisualizer | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _currentDecoration?: vscode.TextEditorDecorationType;


    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;

        // Create webview panel
        this._panel = vscode.window.createWebviewPanel(
            'codeFlowVisualizer',
            'Code Flow Visualizer',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this._extensionUri, 'out'),
                    vscode.Uri.joinPath(this._extensionUri, 'src', 'webview')
                ]
            }
        );

        // Set HTML content
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        // Handle messages from webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'navigateToFunction':
                        this._navigateToFunction(message.functionName, message.line, message.fileName);
                        break;
                    case 'clearHighlight':
                        this._clearHighlight();
                        break;
                    case 'alert':
                        vscode.window.showInformationMessage(message.text);
                        break;
                }
            },
            null,
            this._disposables
        );

        // Handle panel disposal
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public updateVisualization(analysis: CodeAnalysis): void {
        // Convert Map to plain object for JSON serialization
        const functionsObj: any = {};
        analysis.functions.forEach((value, key) => {
            functionsObj[key] = value;
        });

        const data = {
            ...analysis,
            functions: functionsObj
        };

        this._panel.webview.postMessage({
            command: 'updateData',
            data: data
        });
    }

    public reveal(): void {
        this._panel.reveal(vscode.ViewColumn.Two);
    }

    public dispose(): void {
        FlowVisualizer.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    public onDidDispose(callback: () => void): void {
        this._panel.onDidDispose(callback);
    }

    private _clearHighlight(): void {
        if (this._currentDecoration) {
            this._currentDecoration.dispose();
            this._currentDecoration = undefined;
        }
    }


    private async _navigateToFunction(functionName: string, line: number, fileName?: string): Promise<void> {
        let editor = vscode.window.activeTextEditor;
        
        // If fileName is provided and different from current file, open it
        if (fileName && (!editor || editor.document.fileName !== fileName)) {
            try {
                const document = await vscode.workspace.openTextDocument(fileName);
                editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
            } catch (error) {
                vscode.window.showErrorMessage(`Could not open file: ${fileName}`);
                return;
            }
        }
        
        if (!editor) {
            return;
        }

        const position = new vscode.Position(line, 0);
        const range = new vscode.Range(position, position);

        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

        // Dispose previous highlight instantly
        this._clearHighlight();

        // Highlight the line briefly
        const decoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 255, 0, 0.3)',
            isWholeLine: true
        });

        
        this._currentDecoration = decoration;
        editor.setDecorations(decoration, [range]);

    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Flow Visualizer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            overflow: hidden;
            height: 100vh;
        }

        #container {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            position: relative;
        }

        #controls {
            flex-shrink: 0;
            margin-bottom: 20px;
            padding: 15px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 5px;
        }

        #layout-info {
            display: inline-block;
            margin-left: 20px;
            padding: 6px 12px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 3px;
            font-size: 12px;
            font-weight: 500;
        }

        #layout-description {
            display: block;
            margin-top: 8px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        #canvas {
            flex: 1;
            border: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
            cursor: grab;
            overflow: hidden;
            position: relative;
        }

        #canvas.panning {
            cursor: grabbing;
        }

        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            margin-right: 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .info-panel {
            position: fixed;
            top: 80px;
            right: 20px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 5px;
            max-width: 300px;
            display: none;
            z-index: 9999;
            border: 1px solid var(--vscode-panel-border);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }

        .info-panel h3 {
            margin-bottom: 10px;
            color: var(--vscode-textLink-foreground);
        }

        .info-panel ul {
            list-style: none;
            padding-left: 0;
        }

        .info-panel li {
            margin: 5px 0;
            font-size: 12px;
        }

        .node {
            cursor: pointer;
            transition: all 0.2s;
        }

        .node:hover {
            filter: brightness(1.3);
        }

        .node.dragging {
            cursor: grabbing;
        }

        .node.highlighted {
            filter: brightness(1);
            stroke: var(--vscode-textLink-activeForeground);
            stroke-width: 1px;
        }

        .node-text {
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            pointer-events: none;
            user-select: none;
        }

        .link {
            stroke: var(--vscode-textLink-foreground);
            stroke-opacity: 0.6;
            stroke-width: 2px;
            fill: none;
            pointer-events: none;
        }

        .complexity-low { fill: #4CAF50; }
        .complexity-medium { fill: #FFC107; }
        .complexity-high { fill: #FF5722; }
    </style>
</head>
<body>
    <div id="container">
        <div id="controls">
            <button onclick="resetView()">Reset View</button>
            <button onclick="toggleLayout()">Change Layout</button>
            <button onclick="zoomIn()">Zoom In</button>
            <button onclick="zoomOut()">Zoom Out</button>
            <span id="layout-info">Force Layout</span>
            <span id="layout-description">Showing all connected functions</span>
        </div>
        <div id="canvas">
            <svg id="main-svg"></svg>
        </div>
        <div id="info-panel" class="info-panel"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentData = null;
        let currentLayout = 'force';
        let scale = 1;
        let translateX = 0;
        let translateY = 0;
        let isPanning = false;
        let panStartX = 0;
        let panStartY = 0;
        let isDraggingNode = false;
        let draggedNodeIndex = -1;
        let nodePositions = [];
        let svgElement = null;
        let gElement = null;

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateData':
                    currentData = message.data;
                    renderVisualization();
                    break;
            }
        });

        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            // Debounce resize to avoid too many re-renders
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                updateSVGDimensions();
            }, 150);
        });

        function updateSVGDimensions() {
            const svg = document.getElementById('main-svg');
            const canvas = document.getElementById('canvas');
            
            if (!svg || !canvas) return;
            
            const rect = canvas.getBoundingClientRect();
            svg.setAttribute('width', rect.width);
            svg.setAttribute('height', rect.height);
        }

        function renderVisualization() {
            if (!currentData) {
                return;
            }

            const canvas = document.getElementById('canvas');
            const rect = canvas.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;

            // Clear existing content
            const svg = document.getElementById('main-svg');
            svg.innerHTML = '';
            svg.setAttribute('width', width);
            svg.setAttribute('height', height);

            svgElement = svg;

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
            g.setAttribute('id', 'main-group');
            svg.appendChild(g);

            gElement = g;

            const functions = Object.values(currentData.functions);
            if (functions.length === 0) {
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', width / 2);
                text.setAttribute('y', height / 2);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', 'var(--vscode-foreground)');
                text.textContent = 'No functions found. Try analyzing a file with the command palette.';
                g.appendChild(text);
                return;
            }

            let positions;
            // Use stored positions if available (after user dragged nodes)
            if (nodePositions.length === functions.length) {
                positions = nodePositions;
            } else if (currentLayout === 'force') {
                positions = calculateForceLayout(functions, width, height);
                nodePositions = positions;
            } else {
                positions = calculateHierarchicalLayout(functions, width, height);
                nodePositions = positions;
            }

            // Validate positions - ensure no NaN values
            positions.forEach((pos, i) => {
                if (isNaN(pos.x) || isNaN(pos.y) || pos.x === undefined || pos.y === undefined) {
                    // Fallback to center position
                    pos.x = width / 2 + (Math.random() - 0.5) * 100;
                    pos.y = height / 2 + (Math.random() - 0.5) * 100;
                }
            });

            // Draw links
            functions.forEach((func, i) => {
                // Skip drawing links from/to hidden nodes
                if (positions[i].x < -1000) return;
                
                func.calls.forEach(calledFunc => {
                    const targetIndex = functions.findIndex(f => f.name === calledFunc);
                    if (targetIndex !== -1 && positions[targetIndex].x > -1000) {
                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        line.setAttribute('class', 'link');
                        line.setAttribute('x1', positions[i].x);
                        line.setAttribute('y1', positions[i].y);
                        line.setAttribute('x2', positions[targetIndex].x);
                        line.setAttribute('y2', positions[targetIndex].y);
                        line.setAttribute('data-link', 'true');
                        g.appendChild(line);
                    }
                });
            });

            // Draw nodes (skip hidden nodes in hierarchical mode)
            let visibleCount = 0;
            functions.forEach((func, i) => {
                // Skip drawing hidden nodes (off-screen in hierarchical mode)
                if (positions[i].x < -1000) return;
                
                visibleCount++;
                
                const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                nodeG.setAttribute('class', 'node');
                nodeG.setAttribute('data-function-name', func.name);
                nodeG.setAttribute('data-line', func.startLine.toString());
                nodeG.setAttribute('data-node-index', i.toString());
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', positions[i].x);
                circle.setAttribute('cy', positions[i].y);
                circle.setAttribute('r', (12 + func.complexity * 1.5).toString());
                
                // Color by complexity
                if (func.complexity < 3) {
                    circle.setAttribute('class', 'complexity-low');
                } else if (func.complexity < 7) {
                    circle.setAttribute('class', 'complexity-medium');
                } else {
                    circle.setAttribute('class', 'complexity-high');
                }
                
                nodeG.appendChild(circle);

                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('class', 'node-text');
                text.setAttribute('x', positions[i].x);
                text.setAttribute('y', positions[i].y - 18);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', 'var(--vscode-foreground)');
                text.textContent = func.name.length > 15 ? func.name.substring(0, 12) + '...' : func.name;
                nodeG.appendChild(text);

                // Hover: highlight line in code AND switch files if needed
                nodeG.addEventListener('mouseenter', () => {
                    if (!isDraggingNode) {
                        nodeG.classList.add('highlighted');
                        vscode.postMessage({
                            command: 'navigateToFunction',
                            functionName: func.name,
                            line: func.startLine,
                            fileName: func.fileName  // CHANGED: Now includes fileName
                        });
                    }
                });

                nodeG.addEventListener('mouseleave', () => {
                    nodeG.classList.remove('highlighted');
                    vscode.postMessage({
                        command: 'clearHighlight'
                    })
                });

                // Click: show info panel
                nodeG.addEventListener('click', (e) => {
                    if (!isDraggingNode) {
                        e.stopPropagation();
                        showInfo(func);
                    }
                });

                // Node dragging - mousedown on node
                nodeG.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    isDraggingNode = true;
                    draggedNodeIndex = i;
                    nodeG.classList.add('dragging');
                    canvas.style.cursor = 'grabbing';
                });

                g.appendChild(nodeG);
            });

            setupInteractions(svg, g);
            
            // Update layout description with node count
            const layoutDesc = document.getElementById('layout-description');
            if (layoutDesc) {
                if (currentLayout === 'hierarchical') {
                    if (visibleCount < functions.length) {
                        layoutDesc.textContent = 'Showing ' + visibleCount + ' of ' + functions.length + ' functions (deep call chains and hubs only)';
                    } else {
                        layoutDesc.textContent = 'Showing only deep call chains (depth ≥ 2) and important hubs';
                    }
                } else {
                    layoutDesc.textContent = 'Showing all ' + visibleCount + ' connected functions';
                }
            }
        }

        // Update node positions without full re-render
        function updateNodePositions() {
            if (!gElement || !currentData) return;

            const functions = Object.values(currentData.functions);
            
            // Update all nodes
            const nodes = gElement.querySelectorAll('.node');
            nodes.forEach((nodeG, i) => {
                if (i < nodePositions.length) {
                    const circle = nodeG.querySelector('circle');
                    const text = nodeG.querySelector('text');
                    
                    if (circle) {
                        circle.setAttribute('cx', nodePositions[i].x);
                        circle.setAttribute('cy', nodePositions[i].y);
                    }
                    if (text) {
                        text.setAttribute('x', nodePositions[i].x);
                        text.setAttribute('y', nodePositions[i].y - 18);
                    }
                }
            });

            // Update all links
            const links = gElement.querySelectorAll('.link');
            let linkIndex = 0;
            functions.forEach((func, i) => {
                func.calls.forEach(calledFunc => {
                    const targetIndex = functions.findIndex(f => f.name === calledFunc);
                    if (targetIndex !== -1 && links[linkIndex]) {
                        links[linkIndex].setAttribute('x1', nodePositions[i].x);
                        links[linkIndex].setAttribute('y1', nodePositions[i].y);
                        links[linkIndex].setAttribute('x2', nodePositions[targetIndex].x);
                        links[linkIndex].setAttribute('y2', nodePositions[targetIndex].y);
                        linkIndex++;
                    }
                });
            });
        }

        function calculateForceLayout(functions, width, height) {
            // Initialize positions for all functions
            const positions = functions.map((_, i) => ({
                x: Math.random() * (width - 200) + 100,
                y: Math.random() * (height - 200) + 100,
                vx: 0,
                vy: 0
            }));

            // Ensure we have valid dimensions
            if (width <= 0 || height <= 0) {
                return positions.map(() => ({ x: 100, y: 100, vx: 0, vy: 0 }));
            }

            // Improved force simulation with better spacing
            for (let iter = 0; iter < 150; iter++) {
                // Stronger repulsion between nodes for better spacing
                for (let i = 0; i < positions.length; i++) {
                    for (let j = i + 1; j < positions.length; j++) {
                        const dx = positions[j].x - positions[i].x;
                        const dy = positions[j].y - positions[i].y;
                        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                        const minDistance = 80; // Minimum distance between nodes
                        
                        if (distance < minDistance) {
                            const force = (minDistance - distance) / distance * 2;
                            positions[i].vx -= (dx / distance) * force;
                            positions[i].vy -= (dy / distance) * force;
                            positions[j].vx += (dx / distance) * force;
                            positions[j].vy += (dy / distance) * force;
                        } else {
                            const force = 2000 / (distance * distance);
                            positions[i].vx -= (dx / distance) * force;
                            positions[i].vy -= (dy / distance) * force;
                            positions[j].vx += (dx / distance) * force;
                            positions[j].vy += (dy / distance) * force;
                        }
                    }
                }

                // Moderate attraction for connected nodes
                functions.forEach((func, i) => {
                    func.calls.forEach(calledFunc => {
                        const j = functions.findIndex(f => f.name === calledFunc);
                        if (j !== -1) {
                            const dx = positions[j].x - positions[i].x;
                            const dy = positions[j].y - positions[i].y;
                            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                            const force = distance * 0.005;
                            
                            positions[i].vx += (dx / distance) * force;
                            positions[i].vy += (dy / distance) * force;
                            positions[j].vx -= (dx / distance) * force;
                            positions[j].vy -= (dy / distance) * force;
                        }
                    });
                });

                // Apply velocities with damping
                positions.forEach(pos => {
                    pos.x += pos.vx;
                    pos.y += pos.vy;
                    pos.vx *= 0.85;
                    pos.vy *= 0.85;

                    // Keep in bounds with padding
                    pos.x = Math.max(80, Math.min(width - 80, pos.x));
                    pos.y = Math.max(80, Math.min(height - 80, pos.y));
                });
            }

            return positions;
        }

        function calculateHierarchicalLayout(functions, width, height) {
            const positions = [];
            const levels = new Map();
            const visited = new Set();

            // Calculate max depth reachable from each node
            function getMaxDepth(node, depthVisited = new Set()) {
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

            // Only show nodes that are part of chains with depth >= 2
            // OR nodes that are important hubs (called by 2+ functions)
            const meaningfulNodes = new Set();
            
            functions.forEach(func => {
                const depth = getMaxDepth(func);
                // Include if: part of deep chain (depth >= 2) OR is a hub (called by 2+ functions)
                if (depth >= 2 || func.calledBy.length >= 2) {
                    meaningfulNodes.add(func.name);
                    // Also include all nodes in the chain from this node
                    const toVisit = [func];
                    const chainVisited = new Set();
                    while (toVisit.length > 0) {
                        const current = toVisit.pop();
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

            // Also include all callers of meaningful nodes
            functions.forEach(func => {
                func.calls.forEach(calledName => {
                    if (meaningfulNodes.has(calledName)) {
                        meaningfulNodes.add(func.name);
                    }
                });
            });

            // Use meaningful nodes if found, otherwise fall back to any connected nodes
            const functionsToDisplay = meaningfulNodes.size > 0 
                ? functions.filter(f => meaningfulNodes.has(f.name))
                : functions.filter(f => f.calls.length > 0 || f.calledBy.length > 0);

             // Find root nodes (not called by anyone in our display set)
            const roots = functionsToDisplay.filter(f => 
                f.calledBy.length === 0 || 
                !f.calledBy.some(caller => meaningfulNodes.has(caller))
            );
            
            if (roots.length === 0 && functionsToDisplay.length > 0) {
                roots.push(functionsToDisplay[0]);
            }
            
            // BFS to assign levels
            function assignLevels(node, level) {
                if (visited.has(node.name)) return;
                visited.add(node.name);
                
                if (!levels.has(level)) {
                    levels.set(level, []);
                }
                levels.get(level).push(node);

                node.calls.forEach(calledName => {
                    const called = functionsToDisplay.find(f => f.name === calledName);
                    if (called) {
                        assignLevels(called, level + 1);
                    }
                });
            }

            roots.forEach(root => assignLevels(root, 0));

            // Don't show unvisited nodes in hierarchical mode - they're isolated
            // (This is intentionally removed from hierarchical mode)

            // Initialize all positions (including isolated nodes with off-screen positions)
            for (let i = 0; i < functions.length; i++) {
                const func = functions[i];
                if (visited.has(func.name)) {
                    positions[i] = { x: 0, y: 0 }; // Will be set properly below
                } else {
                    // Hide isolated nodes by positioning them off-screen
                    positions[i] = { x: -10000, y: -10000 };
                }
            }

            // Position only visited (connected) nodes
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

        function showInfo(func) {
            const panel = document.getElementById('info-panel');
            panel.innerHTML = \`
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <h3 style="margin: 0;">\${func.name}</h3>
                    <button onclick="hideInfo()" style="background: transparent; color: var(--vscode-foreground); border: none; cursor: pointer; font-size: 18px; padding: 0; margin: 0; line-height: 1;">×</button>
                </div>
                <ul>
                    <li><strong>Lines:</strong> \${func.startLine} - \${func.endLine}</li>
                    <li><strong>Complexity:</strong> \${func.complexity}</li>
                    <li><strong>Parameters:</strong> \${func.params.length}</li>
                    <li><strong>Calls:</strong> \${func.calls.length} function(s)</li>
                    <li><strong>Called by:</strong> \${func.calledBy.length} function(s)</li>
                </ul>
            \`;
            panel.style.display = 'block';
        }

        function hideInfo() {
            const panel = document.getElementById('info-panel');
            panel.style.display = 'none';
        }

        function setupInteractions(svg, g) {
            const canvas = document.getElementById('canvas');

            // Helper function to check if element is or is inside a node
            function isElementInNode(element) {
                let current = element;
                while (current && current !== svg) {
                    if (current.classList && current.classList.contains('node')) {
                        return true;
                    }
                    current = current.parentElement;
                }
                return false;
            }

            // Background click to hide info panel
            svg.addEventListener('click', (e) => {
                if (!isElementInNode(e.target)) {
                    hideInfo();
                }
            });

            // Function to handle mousedown for panning
            function handlePanStart(e) {
                // Only start panning if NOT clicking on a node
                if (!isElementInNode(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                    isPanning = true;
                    panStartX = e.clientX - translateX;
                    panStartY = e.clientY - translateY;
                    canvas.classList.add('panning');
                }
            }

            // Attach mousedown to both SVG and canvas
            svg.addEventListener('mousedown', handlePanStart);
            canvas.addEventListener('mousedown', handlePanStart);

            // Global mousemove for both panning and node dragging
            window.addEventListener('mousemove', (e) => {
                if (isPanning && !isDraggingNode) {
                    // Background panning
                    translateX = e.clientX - panStartX;
                    translateY = e.clientY - panStartY;
                    g.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
                } else if (isDraggingNode && draggedNodeIndex >= 0) {
                    // Node dragging
                    const pt = svg.createSVGPoint();
                    pt.x = e.clientX;
                    pt.y = e.clientY;
                    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
                    
                    // Apply inverse transform to get position in graph coordinates
                    const x = (svgP.x - translateX) / scale;
                    const y = (svgP.y - translateY) / scale;
                    
                    // Update position
                    nodePositions[draggedNodeIndex].x = x;
                    nodePositions[draggedNodeIndex].y = y;
                    
                    // Update positions without full re-render
                    updateNodePositions();
                }
            });

            // Global mouseup to handle both panning and node dragging
            window.addEventListener('mouseup', () => {
                if (isPanning) {
                    isPanning = false;
                    canvas.classList.remove('panning');
                }
                
                if (isDraggingNode) {
                    isDraggingNode = false;
                    draggedNodeIndex = -1;
                    canvas.style.cursor = 'grab';
                    
                    // Remove dragging class from all nodes
                    const nodes = gElement.querySelectorAll('.node');
                    nodes.forEach(node => node.classList.remove('dragging'));
                }
            });

            // Zoom with mouse wheel
            svg.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                scale *= delta;
                scale = Math.max(0.1, Math.min(5, scale));
                g.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
            });
        }

        function resetView() {
            scale = 1;
            translateX = 0;
            translateY = 0;
            nodePositions = []; // Clear stored positions to recalculate layout
            renderVisualization();
        }

        function toggleLayout() {
            currentLayout = currentLayout === 'force' ? 'hierarchical' : 'force';
            nodePositions = []; // Clear stored positions when changing layouts
            
            // Update layout info badge and description
            const layoutInfo = document.getElementById('layout-info');
            const layoutDesc = document.getElementById('layout-description');
            
            if (layoutInfo && layoutDesc) {
                if (currentLayout === 'hierarchical') {
                    layoutInfo.textContent = 'Hierarchical Layout';
                    layoutDesc.textContent = 'Showing only deep call chains (depth ≥ 2) and important hubs';
                } else {
                    layoutInfo.textContent = 'Force Layout';
                    layoutDesc.textContent = 'Showing all connected functions';
                }
            }
            
            renderVisualization();
        }

        function zoomIn() {
            scale *= 1.2;
            const g = document.querySelector('#main-group');
            if (g) {
                g.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
            }
        }

        function zoomOut() {
            scale *= 0.8;
            const g = document.querySelector('#main-group');
            if (g) {
                g.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
            }
        }

        // Initial render
        renderVisualization();
    </script>
</body>
</html>`;
    }
}