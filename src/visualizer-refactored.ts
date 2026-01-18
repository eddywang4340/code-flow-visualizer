import * as vscode from 'vscode';
import { CodeAnalysis } from './analyzer';
import { getWelcomeHTML } from './webview/welcome-content';
import { getWebviewStyles } from './webview/styles';

export class FlowVisualizer {
    public static currentPanel: FlowVisualizer | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];
    private _currentDecoration?: vscode.TextEditorDecorationType;
    private _showWelcome: boolean = true;
    private _hasAnalyzedData: boolean = false;

    constructor(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this._extensionUri = extensionUri;
        this._context = context;
        
        // Check if user has dismissed welcome before
        this._showWelcome = context.globalState.get('codeFlowVisualizer.showWelcome', true);

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

        // Set initial HTML content (welcome screen or visualization)
        this._updateContent();

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
                    case 'openCommandPalette':
                        vscode.commands.executeCommand('workbench.action.showCommands');
                        break;
                    case 'dismissWelcome':
                        this._showWelcome = false;
                        this._context.globalState.update('codeFlowVisualizer.showWelcome', false);
                        if (this._hasAnalyzedData) {
                            this._updateContent();
                        }
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
        this._hasAnalyzedData = true;
        this._showWelcome = false; // Auto-hide welcome when data arrives

        // Convert Map to plain object for JSON serialization
        const functionsObj: any = {};
        analysis.functions.forEach((value, key) => {
            functionsObj[key] = value;
        });

        const data = {
            ...analysis,
            functions: functionsObj
        };

        // Update content to show visualization
        this._updateContent();

        // Send data to webview
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

    private _updateContent(): void {
        if (this._showWelcome && !this._hasAnalyzedData) {
            this._panel.webview.html = this._getWelcomeHtml();
        } else {
            this._panel.webview.html = this._getVisualizationHtml();
        }
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

    private _getWelcomeHtml(): string {
        const vscodeScript = `
            const vscode = acquireVsCodeApi();
        `;

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Flow Visualizer - Welcome</title>
    <style>${getWebviewStyles()}</style>
</head>
<body>
    <script>${vscodeScript}</script>
    ${getWelcomeHTML()}
</body>
</html>`;
    }

    private _getVisualizationHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Flow Visualizer</title>
    <style>${getWebviewStyles()}</style>
</head>
<body>
    <div id="container">
        <div id="controls">
            <button onclick="resetView()">Reset View</button>
            <button onclick="toggleLayout()">Change Layout</button>
            <button onclick="zoomIn()">Zoom In</button>
            <button onclick="zoomOut()">Zoom Out</button>

            <label style="margin-left: 20px; font-size: 12px;">
                <input type="checkbox" id="nav-mode-toggle" checked />
                Auto Navigate on Hover
            </label>

            <span id="layout-info">Force Layout</span>
            <span id="layout-description">Showing all connected functions</span>
        </div>
        <div id="canvas">
            <svg id="main-svg"></svg>
        </div>
        <div id="info-panel" class="info-panel"></div>
        <div id="zoom-indicator" class="zoom-indicator"></div>
    </div>

    ${this._getVisualizationScript()}
</body>
</html>`;
    }

    private _getVisualizationScript(): string {
        // This is a condensed version - you can split this further into modules if needed
        return `<script>
        const vscode = acquireVsCodeApi();
        let currentData = null;
        let currentLayout = 'force';
        let scale = 1;
        let autoNavigate = true;
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
        let isWorkspaceMode = false;
        let fileClusters = new Map();
        let clusterBounds = new Map();
        const ZOOM_THRESHOLD = 1.5;
        let expandedFiles = new Set();

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateData') {
                currentData = message.data;
                renderVisualization();
            }
        });

        document.addEventListener('DOMContentLoaded', () => {
            const toggle = document.getElementById('nav-mode-toggle');
            if (toggle) {
                toggle.addEventListener('change', () => {
                    autoNavigate = toggle.checked;
                });
            }
        });

        // ... [Rest of the visualization script - I'll continue in next message]
        // For now, I'm showing the structure - you can keep your existing script here
        // or we can split it into more modules
        
        ${this._getFullVisualizationScript()}
    </script>`;
    }

    private _getFullVisualizationScript(): string {
        // Return the complete visualization script from the original visualizer
        // This is where all your existing JavaScript logic goes
        // I'll provide a placeholder - you can copy the script from your current visualizer.ts
        return `
        console.log('Visualization script loaded');
        const vscode = acquireVsCodeApi();
        let currentData = null;
        let currentLayout = 'force';
        let scale = 1;
        let autoNavigate = true;
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
        let isWorkspaceMode = false;
        let fileClusters = new Map();
        let clusterBounds = new Map(); // Store cluster boundaries
        
        // Zoom threshold for showing detailed nodes
        const ZOOM_THRESHOLD = 1.5;
        let expandedFiles = new Set(); // Track which files are manually expanded

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

        // Handle auto-navigate toggle
        document.addEventListener('DOMContentLoaded', () => {
            const toggle = document.getElementById('nav-mode-toggle');
            toggle.addEventListener('change', () => {
                autoNavigate = toggle.checked;
            });
        });

        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                updateSVGDimensions();
            }, 150);
        });

        function updateLinkVisibility() {
            const canvas = document.getElementById('canvas');
            if (!canvas || !gElement) return;

            const rect = canvas.getBoundingClientRect();
            const screenW = rect.width;
            const screenH = rect.height;

            const links = gElement.querySelectorAll('.link');
            links.forEach(line => {
                const sIdx = parseInt(line.getAttribute('data-source-index'));
                const tIdx = parseInt(line.getAttribute('data-target-index'));

                const sPos = nodePositions[sIdx];
                const tPos = nodePositions[tIdx];

                if (sPos && tPos) {
                    // FIX: If either node is explicitly hidden by layout, hide the link
                    if (sPos.x < -1000 || tPos.x < -1000) {
                        line.style.display = 'none';
                        return;
                    }

                    const sX = sPos.x * scale + translateX;
                    const sY = sPos.y * scale + translateY;
                    const tX = tPos.x * scale + translateX;
                    const tY = tPos.y * scale + translateY;

                    const sVisible = sX >= 0 && sX <= screenW && sY >= 0 && sY <= screenH;
                    const tVisible = tX >= 0 && tX <= screenW && tY >= 0 && tY <= screenH;

                    line.style.display = (sVisible && tVisible) ? 'block' : 'none';
                }
            });
        }

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

            // Detect workspace mode
            isWorkspaceMode = functions.some(f => f.fileName !== undefined);

            let positions;
            if (nodePositions.length === functions.length) {
                positions = nodePositions;
            } else if (currentLayout === 'force') {
                if (isWorkspaceMode) {
                    positions = calculateClusteredLayout(functions, width, height);
                } else {
                    positions = calculateForceLayout(functions, width, height);
                }
                nodePositions = positions;
            } else {
                positions = calculateHierarchicalLayout(functions, width, height);
                nodePositions = positions;
            }

            // Validate positions
            positions.forEach((pos, i) => {
                if (isNaN(pos.x) || isNaN(pos.y) || pos.x === undefined || pos.y === undefined) {
                    pos.x = width / 2 + (Math.random() - 0.5) * 100;
                    pos.y = height / 2 + (Math.random() - 0.5) * 100;
                }
            });

            // Workspace mode with hierarchical zoom
            if (isWorkspaceMode && currentLayout === 'force') {
                const showDetails = scale > ZOOM_THRESHOLD || expandedFiles.size > 0;
                
                if (showDetails) {
                    // Detailed view: show nodes and links for expanded files
                    renderDetailedView(g, functions, positions);
                } else {
                    // Overview: show file blocks only
                    renderOverviewBlocks(g, functions, positions);
                }
            } else {
                // Original behavior for single file or hierarchical layout
                renderStandardView(g, functions, positions);
            }

            updateLayoutDescription();
            updateLinkVisibility();
        }

        function renderOverviewBlocks(g, functions, positions) {
            fileClusters.clear();
            clusterBounds.clear();
            
            // Group functions by file
            functions.forEach((func, i) => {
                if (func.fileName && positions[i].x > -1000) {
                    if (!fileClusters.has(func.fileName)) {
                        fileClusters.set(func.fileName, []);
                    }
                    fileClusters.get(func.fileName).push({func, pos: positions[i], index: i});
                }
            });

            // Draw file blocks with improved styling
            fileClusters.forEach((nodes, fileName) => {
                if (nodes.length === 0) return;
                
                // Calculate bounding box
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                nodes.forEach(node => {
                    minX = Math.min(minX, node.pos.x);
                    minY = Math.min(minY, node.pos.y);
                    maxX = Math.max(maxX, node.pos.x);
                    maxY = Math.max(maxY, node.pos.y);
                });

                // IMPROVED: Better sizing with minimum dimensions
                const MIN_WIDTH = 200;
                const MIN_HEIGHT = 120;
                const padding = 35;

                let width = Math.max(MIN_WIDTH, maxX - minX + 2 * padding);
                let height = Math.max(MIN_HEIGHT, maxY - minY + 2 * padding);

                const bounds = {
                    x: minX - padding,
                    y: minY - padding,
                    width,
                    height,
                    centerX: (minX + maxX) / 2,
                    centerY: (minY + maxY) / 2
                };
                clusterBounds.set(fileName, bounds);

                // Create block group
                const blockG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                blockG.setAttribute('class', 'file-block-group');
                blockG.setAttribute('data-file-name', fileName);

                // Draw rounded rectangle
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('class', 'file-block');
                rect.setAttribute('x', bounds.x.toString());
                rect.setAttribute('y', bounds.y.toString());
                rect.setAttribute('width', bounds.width.toString());
                rect.setAttribute('height', bounds.height.toString());
                rect.setAttribute('rx', '12');
                blockG.appendChild(rect);

                // IMPROVED: Extract and truncate filename intelligently
                const fileNameOnly = fileName.split(/[\\/]/).pop() || fileName;
                let displayName = fileNameOnly;
                if (displayName.length > 28) {
                    const ext = displayName.split('.').pop();
                    const nameWithoutExt = displayName.substring(0, displayName.lastIndexOf('.'));
                    if (ext && nameWithoutExt.length > 20) {
                        displayName = nameWithoutExt.substring(0, 20) + '...' + ext;
                    } else {
                        displayName = displayName.substring(0, 25) + '...';
                    }
                }

                // File name label - centered vertically in the block
                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('class', 'file-block-label');
                label.setAttribute('x', (bounds.x + bounds.width / 2).toString());
                label.setAttribute('y', (bounds.y + bounds.height / 2 - 5).toString());
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('dominant-baseline', 'middle');
                label.textContent = displayName;
                blockG.appendChild(label);

                // Function count below filename
                const count = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                count.setAttribute('class', 'file-block-count');
                count.setAttribute('x', (bounds.x + bounds.width / 2).toString());
                count.setAttribute('y', (bounds.y + bounds.height / 2 + 18).toString());
                count.setAttribute('text-anchor', 'middle');
                count.setAttribute('dominant-baseline', 'middle');
                
                // IMPROVED: Better function count display
                const funcCount = nodes.length;
                if (funcCount === 1) {
                    count.textContent = '1 function';
                } else if (funcCount < 10) {
                    count.textContent = funcCount + ' functions';
                } else {
                    count.textContent = funcCount + ' functions';
                }
                blockG.appendChild(count);
                
                // IMPROVED: Add hover effect hint
                const hoverHint = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                hoverHint.setAttribute('class', 'file-block-hint');
                hoverHint.setAttribute('x', (bounds.x + bounds.width / 2).toString());
                hoverHint.setAttribute('y', (bounds.y + bounds.height - 15).toString());
                hoverHint.setAttribute('text-anchor', 'middle');
                hoverHint.setAttribute('fill', 'rgba(255, 255, 255, 0.4)');
                hoverHint.setAttribute('font-size', '10px');
                hoverHint.textContent = 'Click to expand';
                blockG.appendChild(hoverHint);
                
                // Click handler to zoom into this file
                blockG.style.cursor = 'pointer';
                blockG.addEventListener('click', (e) => {
                    e.stopPropagation();
                    zoomToFile(fileName, bounds);
                });

                // IMPROVED: Add hover effect
                blockG.addEventListener('mouseenter', () => {
                    rect.style.strokeWidth = '3';
                    rect.style.filter = 'brightness(1.2)';
                });
                
                blockG.addEventListener('mouseleave', () => {
                    rect.style.strokeWidth = '1.5';
                    rect.style.filter = 'none';
                });

                g.appendChild(blockG);
            });
        }

        function renderDetailedView(g, functions, positions) {
            // Determine which files to show
            const filesToShow = expandedFiles.size > 0 ? expandedFiles : new Set(fileClusters.keys());

           // Draw links
            functions.forEach((func, i) => {
                // Skip drawing links from hidden nodes (matches your existing logic)
                if (positions[i].x < -1000 || !filesToShow.has(func.fileName)) return;

                func.calls.forEach(calledFunc => {
                    const targetIndex = functions.findIndex(f => f.name === calledFunc);
                    const targetFunc = functions[targetIndex];

                    // Skip hidden targets
                    if (targetIndex !== -1 && 
                        positions[targetIndex].x > -1000 && 
                        targetFunc && 
                        filesToShow.has(targetFunc.fileName)) {
                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        line.setAttribute('class', 'link');
                        line.setAttribute('data-source-index', i.toString());
                        line.setAttribute('data-target-index', targetIndex.toString());

                        line.setAttribute('x1', positions[i].x);
                        line.setAttribute('y1', positions[i].y);
                        line.setAttribute('x2', positions[targetIndex].x);
                        line.setAttribute('y2', positions[targetIndex].y);
                        line.setAttribute('data-link', 'true');
                        g.appendChild(line);
                    }
                });
            });

            // Draw nodes for visible functions
            functions.forEach((func, i) => {
                if (positions[i].x < -1000) return;
                if (!filesToShow.has(func.fileName)) return;
                
                const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                nodeG.setAttribute('class', 'node');
                nodeG.setAttribute('data-function-name', func.name);
                nodeG.setAttribute('data-line', func.startLine.toString());
                nodeG.setAttribute('data-node-index', i.toString());
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', positions[i].x);
                circle.setAttribute('cy', positions[i].y);
                circle.setAttribute('r', (12 + func.complexity * 1.5).toString());
                
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
                text.textContent = func.displayName && func.displayName.length > 15 
                    ? func.displayName.substring(0, 12) + '...' 
                    : (func.displayName || func.name);
                nodeG.appendChild(text);

                nodeG.addEventListener('mouseenter', () => {
                    if (!isDraggingNode) {
                        nodeG.classList.add('highlighted');
                        if (autoNavigate) {
                            vscode.postMessage({
                                command: 'navigateToFunction',
                                functionName: func.name,
                                line: func.startLine,
                                fileName: func.fileName
                            });
                        }
                    }
                });

                nodeG.addEventListener('mouseleave', () => {
                    nodeG.classList.remove('highlighted');
                    vscode.postMessage({
                        command: 'clearHighlight'
                    });
                });

                nodeG.addEventListener('click', (e) => {
                    if (!isDraggingNode) {
                        e.stopPropagation();
                        showInfo(func);
                    }
                });

                nodeG.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    if (!autoNavigate) {
                        vscode.postMessage({
                            command: 'navigateToFunction',
                            functionName: func.name,
                            line: func.startLine,
                            fileName: func.fileName
                        });
                    }
                });


                // Node dragging - mousedown on node
                nodeG.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    isDraggingNode = true;
                    draggedNodeIndex = i;
                    nodeG.classList.add('dragging');
                });

                g.appendChild(nodeG);
            });
        }

        function renderStandardView(g, functions, positions) {
            // Draw links
            functions.forEach((func, i) => {
                if (positions[i].x < -1000) return;
                
                func.calls.forEach(calledFunc => {
                    const targetIndex = functions.findIndex(f => f.name === calledFunc);
                    if (targetIndex !== -1 && positions[targetIndex].x > -1000) {
                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        line.setAttribute('class', 'link');
                        line.setAttribute('data-source-index', i.toString());
                        line.setAttribute('data-target-index', targetIndex.toString());
                        line.setAttribute('x1', positions[i].x);
                        line.setAttribute('y1', positions[i].y);
                        line.setAttribute('x2', positions[targetIndex].x);
                        line.setAttribute('y2', positions[targetIndex].y);
                        g.appendChild(line);
                    }
                });
            });

            // Draw nodes
            functions.forEach((func, i) => {
                if (positions[i].x < -1000) return;
                
                const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                nodeG.setAttribute('class', 'node');
                nodeG.setAttribute('data-function-name', func.name);
                nodeG.setAttribute('data-line', func.startLine.toString());
                nodeG.setAttribute('data-node-index', i.toString());
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', positions[i].x);
                circle.setAttribute('cy', positions[i].y);
                circle.setAttribute('r', (12 + func.complexity * 1.5).toString());
                
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
                text.textContent = func.displayName && func.displayName.length > 15 
                ? func.displayName.substring(0, 12) + '...' 
                : (func.displayName || func.name);
                nodeG.appendChild(text);

                nodeG.addEventListener('mouseenter', () => {
                    if (!isDraggingNode) {
                        nodeG.classList.add('highlighted');
                        if (autoNavigate) {
                            vscode.postMessage({
                                command: 'navigateToFunction',
                                functionName: func.name,
                                line: func.startLine,
                                fileName: func.fileName
                            });
                        }
                    }
                });

                nodeG.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    if (!autoNavigate) {  // Only navigate on double-click when auto-navigate is OFF
                        vscode.postMessage({
                            command: 'navigateToFunction',
                            functionName: func.name,
                            line: func.startLine,
                            fileName: func.fileName
                        });
                    }
                });

                nodeG.addEventListener('mouseleave', () => {
                    nodeG.classList.remove('highlighted');
                    vscode.postMessage({
                        command: 'clearHighlight'
                    });
                });

                nodeG.addEventListener('click', (e) => {
                    if (!isDraggingNode) {
                        e.stopPropagation();
                        showInfo(func);
                    }
                });

                nodeG.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    isDraggingNode = true;
                    draggedNodeIndex = i;
                    nodeG.classList.add('dragging');
                });

                g.appendChild(nodeG);
            });
        }

        function zoomToFile(fileName, bounds) {
            expandedFiles.clear();
            expandedFiles.add(fileName);

            // Calculate zoom and pan to fit this file block
            const canvas = document.getElementById('canvas');
            const rect = canvas.getBoundingClientRect();
            
            // Target scale to make the file take up ~70% of the view
            const targetScale = Math.min(
                (rect.width * 0.7) / bounds.width,
                (rect.height * 0.7) / bounds.height,
                3 // Max zoom
            );
            
            // Target translation to center the file
            const targetTranslateX = rect.width / 2 - bounds.centerX * targetScale;
            const targetTranslateY = rect.height / 2 - bounds.centerY * targetScale;

            // Animate zoom
            animateZoom(targetScale, targetTranslateX, targetTranslateY);
        }

        function animateZoom(targetScale, targetX, targetY, duration = 500) {
            const startScale = scale;
            const startX = translateX;
            const startY = translateY;
            const startTime = Date.now();

            function animate() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing function (ease-in-out)
                const eased = progress < 0.5 
                    ? 2 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

                scale = startScale + (targetScale - startScale) * eased;
                translateX = startX + (targetX - startX) * eased;
                translateY = startY + (targetY - startY) * eased;

                if (gElement) {
                    gElement.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Re-render with details after animation
                    renderVisualization();
                }
            }

            animate();
        }

        function updateLayoutDescription() {
            const layoutDesc = document.getElementById('layout-description');
            if (!layoutDesc) return;

            if (isWorkspaceMode && currentLayout === 'force') {
                if (scale > ZOOM_THRESHOLD || expandedFiles.size > 0) {
                    layoutDesc.textContent = 'Detailed view - showing function nodes and links';
                } else {
                    layoutDesc.textContent = 'File overview - zoom in or click a file to see details';
                }
            } else if (currentLayout === 'hierarchical') {
                layoutDesc.textContent = 'Showing only deep call chains (depth ≥ 2) and important hubs';
            } else {
                layoutDesc.textContent = 'Showing all connected functions';
            }
        }

        function updateNodePositions() {
            if (!gElement || !currentData) return;

            // 1. Update Nodes (using the data-node-index fix from before)
            const nodes = gElement.querySelectorAll('.node');
            nodes.forEach((nodeG) => {
                const indexStr = nodeG.getAttribute('data-node-index');
                const i = indexStr ? parseInt(indexStr) : -1;

                if (i >= 0 && i < nodePositions.length) {
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

            // 2. Update Links (NEW: Use data attributes for direct lookup)
            const links = gElement.querySelectorAll('.link');
            links.forEach(line => {
                // Read the indices we saved during render
                const sourceIdx = parseInt(line.getAttribute('data-source-index'));
                const targetIdx = parseInt(line.getAttribute('data-target-index'));

                // Check if we have valid numbers
                if (!isNaN(sourceIdx) && !isNaN(targetIdx)) {
                    const sourcePos = nodePositions[sourceIdx];
                    const targetPos = nodePositions[targetIdx];

                    // Safety check to ensure positions exist
                    if (sourcePos && targetPos) {
                        line.setAttribute('x1', sourcePos.x);
                        line.setAttribute('y1', sourcePos.y);
                        line.setAttribute('x2', targetPos.x);
                        line.setAttribute('y2', targetPos.y);
                    }
                }
            });
        }

        function calculateClusteredLayout(functions, width, height) {
            const clusters = new Map();
            functions.forEach((func, i) => {
                const fileName = func.fileName || 'default';
                if (!clusters.has(fileName)) {
                    clusters.set(fileName, []);
                }
                clusters.get(fileName).push({func, index: i});
            });

            const clusterArray = Array.from(clusters.entries());
            const numClusters = clusterArray.length;
            
            // IMPROVED: Better grid calculation with more spacing
            const cols = Math.ceil(Math.sqrt(numClusters * 1.5)); // Wider grid
            const rows = Math.ceil(numClusters / cols);
            
            // IMPROVED: Much larger spacing between clusters
            const horizontalMargin = 400;
            const verticalMargin = 300;
            const clusterWidth = Math.max(250, (width - horizontalMargin) / cols);
            const clusterHeight = Math.max(200, (height - verticalMargin) / rows);

            const positions = new Array(functions.length);

            clusterArray.forEach(([fileName, nodes], clusterIndex) => {
                const col = clusterIndex % cols;
                const row = Math.floor(clusterIndex / cols);
                
                // IMPROVED: Better starting position with more margin
                const clusterCenterX = horizontalMargin/2 + col * clusterWidth + clusterWidth / 2;
                const clusterCenterY = verticalMargin/2 + row * clusterHeight + clusterHeight / 2;

                // Initialize positions within cluster with tighter initial spread
                const clusterPositions = nodes.map(() => ({
                    x: clusterCenterX + (Math.random() - 0.5) * (clusterWidth * 0.4),
                    y: clusterCenterY + (Math.random() - 0.5) * (clusterHeight * 0.4),
                    vx: 0,
                    vy: 0
                }));

                // IMPROVED: Better force simulation parameters
                for (let iter = 0; iter < 120; iter++) {
                    // Repulsion between nodes in same cluster
                    for (let i = 0; i < clusterPositions.length; i++) {
                        for (let j = i + 1; j < clusterPositions.length; j++) {
                            const dx = clusterPositions[j].x - clusterPositions[i].x;
                            const dy = clusterPositions[j].y - clusterPositions[i].y;
                            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                            const minDistance = 80; // Minimum spacing between nodes
                            
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

                    // Attraction for function calls (within same cluster)
                    nodes.forEach(({func}, i) => {
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

                    // Center attraction (keep cluster together)
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

                        // Keep within cluster bounds with margin
                        const margin = 30;
                        pos.x = Math.max(clusterCenterX - clusterWidth/2 + margin, 
                                        Math.min(clusterCenterX + clusterWidth/2 - margin, pos.x));
                        pos.y = Math.max(clusterCenterY - clusterHeight/2 + margin, 
                                        Math.min(clusterCenterY + clusterHeight/2 - margin, pos.y));
                    });
                }

                // Assign final positions
                nodes.forEach(({index}, i) => {
                    positions[index] = clusterPositions[i];
                });
            });

            fileClusters = clusters;
            return positions;
        }


        function calculateForceLayout(functions, width, height) {
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

            for (let iter = 0; iter < 150; iter++) {
                for (let i = 0; i < positions.length; i++) {
                    for (let j = i + 1; j < positions.length; j++) {
                        const dx = positions[j].x - positions[i].x;
                        const dy = positions[j].y - positions[i].y;
                        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                        const minDistance = 100;
                        
                        if (distance < minDistance) {
                            const force = (minDistance - distance) / distance * 3;
                            positions[i].vx -= (dx / distance) * force;
                            positions[i].vy -= (dx / distance) * force;
                            positions[j].vx += (dx / distance) * force;
                            positions[j].vy += (dy / distance) * force;
                        } else {
                            const force = 2500 / (distance * distance);
                            positions[i].vx -= (dx / distance) * force;
                            positions[i].vy -= (dy / distance) * force;
                            positions[j].vx += (dx / distance) * force;
                            positions[j].vy += (dy / distance) * force;
                        }
                    }
                }

                functions.forEach((func, i) => {
                    func.calls.forEach(calledFunc => {
                        const j = functions.findIndex(f => f.name === calledFunc);
                        if (j !== -1) {
                            const dx = positions[j].x - positions[i].x;
                            const dy = positions[j].y - positions[i].y;
                            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                            const force = distance * 0.008;
                            
                            positions[i].vx += (dx / distance) * force;
                            positions[i].vy += (dy / distance) * force;
                            positions[j].vx -= (dx / distance) * force;
                            positions[j].vy -= (dy / distance) * force;
                        }
                    });
                });

                positions.forEach(pos => {
                    pos.x += pos.vx;
                    pos.y += pos.vy;
                    pos.vx *= 0.85;
                    pos.vy *= 0.85;

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

            const meaningfulNodes = new Set();
            
            functions.forEach(func => {
                const depth = getMaxDepth(func);
                if (depth >= 2 || func.calledBy.length >= 2) {
                    meaningfulNodes.add(func.name);
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

            for (let i = 0; i < functions.length; i++) {
                const func = functions[i];
                if (visited.has(func.name)) {
                    positions[i] = { x: 0, y: 0 };
                } else {
                    positions[i] = { x: -10000, y: -10000 };
                }
            }

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
            const fileName = func.fileName ? func.fileName.split('/').pop() : 'Unknown'; // Add this line
            panel.innerHTML = \`
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <h3 style="margin: 0;">\${func.displayName || func.name}</h3>
                    <button onclick="hideInfo()" style="background: transparent; color: var(--vscode-foreground); border: none; cursor: pointer; font-size: 18px; padding: 0; margin: 0; line-height: 1;">×</button>
                </div>
                <ul>
                    <li><strong>File:</strong> \${fileName}</li>
                    <li><strong>Lines:</strong> \${func.startLine} - \${func.endLine}</li>
                    <li><strong>Complexity:</strong> \${func.complexity}</li>
                    <li><strong>Parameters:</strong> \${func.params.length}</li>
                    <li><strong>Calls:</strong> \${func.calls.length} function(s)</li>
                    <li><strong>Called by:</strong> \${func.calledBy.length} function(s)</li>
                    \${func.fileName ? '<li><strong>File:</strong> ' + func.fileName + '</li>' : ''}
                </ul>
            \`;
            panel.style.display = 'block';
        }

        function hideInfo() {
            const panel = document.getElementById('info-panel');
            panel.style.display = 'none';
        }

        function initializeGlobalEvents() {
            const svg = document.getElementById('main-svg');
            const canvas = document.getElementById('canvas');

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

            svg.addEventListener('click', (e) => {
                if (!isElementInNode(e.target)) {
                    hideInfo();
                }
            });

            function handlePanStart(e) {
                if (!isElementInNode(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                    isPanning = true;
                    panStartX = e.clientX - translateX;
                    panStartY = e.clientY - translateY;
                    canvas.classList.add('panning');
                }
            }

            svg.addEventListener('mousedown', handlePanStart);
            canvas.addEventListener('mousedown', handlePanStart);

            window.addEventListener('mousemove', (e) => {
                if (isPanning && !isDraggingNode) {
                    translateX = e.clientX - panStartX;
                    translateY = e.clientY - panStartY;
                    // FIX: Use global gElement
                    if (gElement) {
                        gElement.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
                    }
                    updateLinkVisibility();
                } else if (isDraggingNode && draggedNodeIndex >= 0) {
                    const pt = svg.createSVGPoint();
                    pt.x = e.clientX;
                    pt.y = e.clientY;
                    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
                    
                    const x = (svgP.x - translateX) / scale;
                    const y = (svgP.y - translateY) / scale;
                    
                    nodePositions[draggedNodeIndex].x = x;
                    nodePositions[draggedNodeIndex].y = y;
                    
                    updateNodePositions();
                    updateLinkVisibility();
                }
            });

            window.addEventListener('mouseup', () => {
                if (isPanning) {
                    isPanning = false;
                    canvas.classList.remove('panning');
                }
                
                if (isDraggingNode) {
                    isDraggingNode = false;
                    draggedNodeIndex = -1;
                    canvas.style.cursor = 'grab';
                    
                    if (gElement) {
                        const nodes = gElement.querySelectorAll('.node');
                        nodes.forEach(node => node.classList.remove('dragging'));
                    }
                }
            });

            // Wheel zoom
            svg.addEventListener('wheel', (e) => {
                e.preventDefault();
                const oldScale = scale;
                const delta = e.deltaY > 0 ? 0.95 : 1.05;
                const newScale = Math.max(0.1, Math.min(5, oldScale * delta));
                
                // Get mouse position in screen coordinates
                const rect = svg.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                // Adjust translation to zoom toward mouse cursor
                translateX = mouseX - (mouseX - translateX) * (newScale / oldScale);
                translateY = mouseY - (mouseY - translateY) * (newScale / oldScale);
                
                scale = newScale;
                
                if (gElement) {
                    gElement.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
                }

                if (isWorkspaceMode && currentLayout === 'force' && expandedFiles.size === 0) {
                    const wasBelow = oldScale <= ZOOM_THRESHOLD;
                    const isAbove = scale > ZOOM_THRESHOLD;
                    
                    if (wasBelow && isAbove) {
                        renderVisualization();
                    } else if (!wasBelow && !isAbove) {
                        renderVisualization();
                    }
                }
                updateLayoutDescription();
            });
        }

        function resetView() {
            scale = 1;
            translateX = 0;
            translateY = 0;
            expandedFiles.clear();
            nodePositions = [];
            renderVisualization();
        }

        function toggleLayout() {
            currentLayout = currentLayout === 'force' ? 'hierarchical' : 'force';
            expandedFiles.clear();
            nodePositions = [];
            
            const layoutInfo = document.getElementById('layout-info');
            
            if (layoutInfo) {
                if (currentLayout === 'hierarchical') {
                    layoutInfo.textContent = 'Hierarchical Layout';
                } else {
                    layoutInfo.textContent = 'Force Layout';
                }
            }
            
            renderVisualization();
        }

        function zoomIn() {
            const oldScale = scale;
            const newScale = oldScale * 1.2;
            
            // Get canvas center in screen coordinates
            const canvas = document.getElementById('canvas');
            const rect = canvas.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // Adjust translation to zoom toward center
            translateX = centerX - (centerX - translateX) * (newScale / oldScale);
            translateY = centerY - (centerY - translateY) * (newScale / oldScale);
            
            scale = newScale;
            
            if (gElement) {
                gElement.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
            }

            // Check threshold crossing only if no file is explicitly selected
            if (isWorkspaceMode && currentLayout === 'force' && expandedFiles.size === 0) {
                const wasBelow = oldScale <= ZOOM_THRESHOLD;
                const isAbove = scale > ZOOM_THRESHOLD;
                
                if (wasBelow && isAbove) {
                    renderVisualization();
                }
            }
            
            updateLayoutDescription();
        }

        function zoomOut() {
            const oldScale = scale;
            const newScale = oldScale * 0.8;
            
            // Get canvas center in screen coordinates
            const canvas = document.getElementById('canvas');
            const rect = canvas.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // Adjust translation to zoom toward center
            translateX = centerX - (centerX - translateX) * (newScale / oldScale);
            translateY = centerY - (centerY - translateY) * (newScale / oldScale);
            
            scale = newScale;
            
            if (gElement) {
                gElement.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
            }

            // Check threshold crossing only if no file is explicitly selected
            if (isWorkspaceMode && currentLayout === 'force' && expandedFiles.size === 0) {
                const wasAbove = oldScale > ZOOM_THRESHOLD;
                const isBelow = scale <= ZOOM_THRESHOLD;
                
                if (wasAbove && isBelow) {
                    renderVisualization();
                }
            }
            
            updateLayoutDescription();
}
        initializeGlobalEvents();
        // Initial render
        renderVisualization();
        `;
    }
}