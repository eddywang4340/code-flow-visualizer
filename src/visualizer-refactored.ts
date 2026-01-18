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

        // Create webview panell
        this._panel = vscode.window.createWebviewPanel(
            'codeFlowVisualizer',
            'Code Flow Visualizer',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this._extensionUri, 'out'),
                    vscode.Uri.joinPath(this._extensionUri, 'src', 'webview'),
                    vscode.Uri.joinPath(this._extensionUri) // Ensure root is accessible for the icon
                ]
            }
        );

        // --- ADD THIS LINE ---
        this._panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'CodeFlowIcon.png');
        // Set initial HTML content (welcome screen or visualization)
        this._updateContent();

        // Handle messages from webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'analyzeCurrentFile':
                        vscode.commands.executeCommand('codeFlowVisualizer.analyzeCurrentFile');
                        break;
                    case 'analyzeWorkspace':
                        vscode.commands.executeCommand('codeFlowVisualizer.analyzeWorkspace');
                        break;
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
                    case 'analyzeComplexity':
                        // Call your LLM here
                        try {
                            const response = await fetch('http://127.0.0.1:8000/analyze', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ 
                                    code: message.code 
                                })
                            });

                            if (!response.ok) {
                                throw new Error(`Backend error: ${response.statusText}`);
                            }

                            const result: any = await response.json();
                            
                            // Send result back to WebView
                            this._panel.webview.postMessage({
                                command: 'updateComplexity',
                                complexity: result.bigO || "Unknown",
                                description: result.description || "Unknown"
                            });
                        } catch (err: any) {
                            vscode.window.showErrorMessage(`LLM Analysis failed: ${err.message}`);
                            this._panel.webview.postMessage({
                                command: 'updateComplexity',
                                complexity: "Error"
                            });
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
    <style>
        /* Additional styles for tools menu and zoom indicator */
        .tools-menu {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
        }

        .tools-toggle {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .tools-toggle:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .tools-dropdown {
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 8px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 8px;
            min-width: 180px;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .tools-dropdown.show {
            display: block;
        }

        .tools-section {
            margin-bottom: 12px;
        }

        .tools-section:last-child {
            margin-bottom: 0;
        }

        .tools-section-title {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.5px;
        }

        .tools-dropdown button {
            width: 100%;
            text-align: left;
            margin-bottom: 4px;
            padding: 6px 10px;
            font-size: 12px;
        }

        .tools-dropdown button:last-child {
            margin-bottom: 0;
        }

        .zoom-indicator {
            position: absolute;
            bottom: 20px;
            right: 20px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 6px 14px;
            border-radius: 14px;
            font-size: 12px;
            font-weight: 600;
            z-index: 1001;
            border: 1px solid var(--vscode-panel-border);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            pointer-events: none;
            flex-shrink: 0;
        }

        #controls {
            padding: 10px 20px;
            margin-bottom: 0;
        }

        .info-panel {
            max-width: 260px;
            padding: 14px;
        }

        .info-panel h3 {
            font-size: 15px;
            margin-bottom: 10px;
        }

        .info-panel li {
            margin: 7px 0;
            font-size: 12px;
        }

        /* Simplified node styling */
        .node circle {
            transition: filter 0.2s, stroke-width 0.2s;
        }

        .node:hover circle {
            filter: brightness(1.2);
            stroke: white;
            stroke-width: 2px;
        }

        /* Improved file blocks */
        .file-block {
            fill: rgba(59, 130, 246, 0.06);
            stroke: rgba(59, 130, 246, 0.3);
            stroke-width: 2;
            transition: all 0.2s ease;
        }

        .file-block:hover {
            fill: rgba(59, 130, 246, 0.12);
            stroke: rgba(59, 130, 246, 0.6);
            stroke-width: 2.5;
        }

        .file-block-label {
            fill: var(--vscode-foreground);
            font-size: 13px;
            font-weight: 600;
            pointer-events: none;
        }

        .file-block-count {
            fill: var(--vscode-descriptionForeground);
            font-size: 11px;
            pointer-events: none;
        }

        .file-block-hint {
            fill: var(--vscode-textLink-foreground);
            font-size: 10px;
            opacity: 0;
            transition: opacity 0.2s;
        }

        .file-block-group:hover .file-block-hint {
            opacity: 1;
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="controls">
            <label style="font-size: 12px;">
                <input type="checkbox" id="nav-mode-toggle" checked />
                Auto Navigate on Hover
            </label>
            <button onClick=zoomIn() title="Zoom In" style="margin-left: 12px; font-size: 12px; padding: 4px 8px;"></button>
            <button onClick=zoomOut() title="Zoom Out" style="margin-left: 4px; font-size: 12px; padding: 4px 8px;"></button>

            <span id="layout-info" style="margin-left: 20px; padding: 4px 10px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 3px; font-size: 11px; font-weight: 600;">Force Layout</span>
            <span id="layout-description" style="margin-left: 12px; font-size: 11px; color: var(--vscode-descriptionForeground);">Showing all connected functions</span>
        </div>
        
        <!-- Tools Menu -->
        <div class="tools-menu">
            <button class="tools-toggle" onclick="toggleToolsMenu()">
                <span>⚙️</span>
                <span>Tools</span>
            </button>
            <div class="tools-dropdown" id="tools-dropdown">
                <div class="tools-section">
                    <button onclick="resetView(); closeToolsMenu();">Reset View</button>
                    <button onclick="toggleLayout(); closeToolsMenu();">Change Layout</button>
                </div>
            </div>
        </div>

        <div id="canvas">
            <svg id="main-svg"></svg>
        </div>
        <div id="info-panel" class="info-panel"></div>
        <div id="zoom-indicator" class="zoom-indicator">100%</div>
    </div>
    <script>
    ${this._getFullVisualizationScript()}
    </script>
</body>
</html>`;
    }

    private _getFullVisualizationScript(): string {
        return `
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

        // Significance-based progressive disclosure system
        const SIGNIFICANCE_LEVELS = {
            0.5: 70,   // Very zoomed out: high significance
            0.8: 50,   // Zoomed out: medium-high
            1.0: 30,   // Normal: LOW threshold (was 50 - too strict!)
            1.3: 20,   // Zoomed in: include most
            1.8: 10,   // Very zoomed in: helpers
            2.5: 0     // Maximum zoom: everything
        };

        function showAllFunctionsBypass() {
            // Call this from console if you want to see all functions regardless of significance
            const oldShouldShow = window.shouldShowFunction;
            window.shouldShowFunction = () => true;
            renderVisualization();
            console.log('Showing all functions (bypass enabled)');
        }

        window.showAllFunctionsBypass = showAllFunctionsBypass;
        window.debugSignificance = function() {
            if (!currentData) {
                console.log('No data loaded');
                return;
            }
            
            const funcs = Object.values(currentData.functions);
            console.log(\`Total functions: \${funcs.length}\`);
            console.log(\`Current zoom: \${scale.toFixed(2)}x\`);
            console.log(\`Min significance needed: \${getMinSignificance(scale)}\`);
            console.log('\nFunction significance scores:');
            
            funcs.forEach(f => {
                const sig = f.significance !== undefined ? f.significance : 'MISSING';
                console.log(\`  \${f.name}: \${sig}\`);
            });
            
            const withSig = funcs.filter(f => f.significance !== undefined).length;
            const withoutSig = funcs.length - withSig;
            console.log(\`\\nFunctions WITH significance: \${withSig}\`);
            console.log(\`Functions WITHOUT significance: \${withoutSig}\`);
        };

        console.log('Significance debugging enabled. Type debugSignificance() to inspect function scores.');
        console.log('Type showAllFunctionsBypass() to temporarily show all functions.');

        function getMinSignificance(zoomLevel) {
            // Find the appropriate threshold based on current zoom
            const thresholds = Object.keys(SIGNIFICANCE_LEVELS)
                .map(k => parseFloat(k))
                .sort((a, b) => a - b);
            
            for (let i = thresholds.length - 1; i >= 0; i--) {
                if (zoomLevel >= thresholds[i]) {
                    return SIGNIFICANCE_LEVELS[thresholds[i]];
                }
            }
            
            return SIGNIFICANCE_LEVELS[thresholds[0]];
        }

        function shouldShowFunction(func, zoomLevel, isWorkspaceMode, expandedFiles, filesToShow) {
            // DEBUG: Log what we're checking
            if (!func.significance) {
                console.warn('Function missing significance:', func.name, func);
            }
            
            // Always respect file filtering in workspace mode
            if (isWorkspaceMode && expandedFiles.size > 0 && !filesToShow.has(func.fileName)) {
                return false;
            }
            
            // Get minimum significance required at this zoom level
            const minSignificance = getMinSignificance(zoomLevel);
            
            // DEFAULT TO SHOWING if significance is missing (fail-open)
            const funcSignificance = func.significance !== undefined ? func.significance : 100;
            
            const shouldShow = funcSignificance >= minSignificance;
            
            // DEBUG logging
            if (!shouldShow) {
                console.log(\`Hiding \${func.name}: significance \${funcSignificance} < \${minSignificance} at zoom \${zoomLevel.toFixed(2)}\`);
            }
            
            return shouldShow;
        }

        // Tools menu functions
        function toggleToolsMenu() {
            const dropdown = document.getElementById('tools-dropdown');
            dropdown.classList.toggle('show');
        }

        function closeToolsMenu() {
            const dropdown = document.getElementById('tools-dropdown');
            dropdown.classList.remove('show');
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const menu = document.querySelector('.tools-menu');
            if (menu && !menu.contains(e.target)) {
                closeToolsMenu();
            }
        });

        // Update zoom indicator
        function updateZoomIndicator() {
            const indicator = document.getElementById('zoom-indicator');
            if (indicator) {
                indicator.textContent = Math.round(scale * 100) + '%';
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            const toggle = document.getElementById('nav-mode-toggle');
            toggle.addEventListener('change', () => {
                autoNavigate = toggle.checked;
            });
        });

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

            positions.forEach((pos, i) => {
                if (isNaN(pos.x) || isNaN(pos.y) || pos.x === undefined || pos.y === undefined) {
                    pos.x = width / 2 + (Math.random() - 0.5) * 100;
                    pos.y = height / 2 + (Math.random() - 0.5) * 100;
                }
            });

            if (isWorkspaceMode && currentLayout === 'force') {
                const showDetails = scale > ZOOM_THRESHOLD || expandedFiles.size > 0;
                
                if (showDetails) {
                    renderDetailedView(g, functions, positions);
                } else {
                    renderOverviewBlocks(g, functions, positions);
                }
            } else {
                renderStandardView(g, functions, positions);
            }

            updateLayoutDescription();
            updateLinkVisibility();
        }

        function renderOverviewBlocks(g, functions, positions) {
            fileClusters.clear();
            clusterBounds.clear();
            
            functions.forEach((func, i) => {
                if (func.fileName && positions[i].x > -1000) {
                    if (!fileClusters.has(func.fileName)) {
                        fileClusters.set(func.fileName, []);
                    }
                    fileClusters.get(func.fileName).push({func, pos: positions[i], index: i});
                }
            });

            fileClusters.forEach((nodes, fileName) => {
                if (nodes.length === 0) return;
                
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                nodes.forEach(node => {
                    minX = Math.min(minX, node.pos.x);
                    minY = Math.min(minY, node.pos.y);
                    maxX = Math.max(maxX, node.pos.x);
                    maxY = Math.max(maxY, node.pos.y);
                });

                const MIN_WIDTH = 180;
                const MIN_HEIGHT = 100;
                const padding = 30;

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

                const blockG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                blockG.setAttribute('class', 'file-block-group');
                blockG.setAttribute('data-file-name', fileName);

                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('class', 'file-block');
                rect.setAttribute('x', bounds.x.toString());
                rect.setAttribute('y', bounds.y.toString());
                rect.setAttribute('width', bounds.width.toString());
                rect.setAttribute('height', bounds.height.toString());
                rect.setAttribute('rx', '8');
                blockG.appendChild(rect);

                // Extract filename from path - fix for hash names
                const fileNameOnly = fileName.split('\\\\').at(-1);
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

                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('class', 'file-block-label');
                label.setAttribute('x', (bounds.x + bounds.width / 2).toString());
                label.setAttribute('y', (bounds.y + bounds.height / 2 - 8).toString());
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('dominant-baseline', 'middle');
                label.textContent = displayName;
                blockG.appendChild(label);

                const count = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                count.setAttribute('class', 'file-block-count');
                count.setAttribute('x', (bounds.x + bounds.width / 2).toString());
                count.setAttribute('y', (bounds.y + bounds.height / 2 + 10).toString());
                count.setAttribute('text-anchor', 'middle');
                count.setAttribute('dominant-baseline', 'middle');
                
                const funcCount = nodes.length;
                count.textContent = funcCount === 1 ? '1 function' : funcCount + ' functions';
                blockG.appendChild(count);
                
                const hoverHint = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                hoverHint.setAttribute('class', 'file-block-hint');
                hoverHint.setAttribute('x', (bounds.x + bounds.width / 2).toString());
                hoverHint.setAttribute('y', (bounds.y + bounds.height - 12).toString());
                hoverHint.setAttribute('text-anchor', 'middle');
                hoverHint.textContent = 'Click to expand';
                blockG.appendChild(hoverHint);
                
                blockG.style.cursor = 'pointer';
                blockG.addEventListener('click', (e) => {
                    e.stopPropagation();
                    zoomToFile(fileName, bounds);
                });

                g.appendChild(blockG);
            });
        }

        function renderDetailedView(g, functions, positions) {
            const filesToShow = expandedFiles.size > 0 ? expandedFiles : new Set(fileClusters.keys());
            
            // Filter functions by significance AND file visibility
            const visibleFunctions = functions.filter((func, i) => 
                positions[i].x > -1000 && 
                shouldShowFunction(func, scale, isWorkspaceMode, expandedFiles, filesToShow)
            );
            
            const visibleIndices = new Set(
                visibleFunctions.map(func => functions.indexOf(func))
            );

            // Draw links only between visible functions
            functions.forEach((func, i) => {
                if (!visibleIndices.has(i)) return;

                func.calls.forEach(calledFunc => {
                    const targetIndex = functions.findIndex(f => f.name === calledFunc);
                    const targetFunc = functions[targetIndex];

                    if (targetIndex !== -1 && 
                        visibleIndices.has(targetIndex) &&
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
                        
                        // Add fade-in animation for newly revealed functions
                        line.style.opacity = '0';
                        line.style.transition = 'opacity 0.3s ease';
                        setTimeout(() => { line.style.opacity = '0.4'; }, 10);
                        
                        g.appendChild(line);
                    }
                });
            });

            // Draw only visible nodes
            visibleFunctions.forEach(func => {
                const i = functions.indexOf(func);
                if (!filesToShow.has(func.fileName)) return;
                
                const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                nodeG.setAttribute('class', 'node');
                nodeG.setAttribute('data-function-name', func.name);
                nodeG.setAttribute('data-line', func.startLine.toString());
                nodeG.setAttribute('data-node-index', i.toString());
                nodeG.setAttribute('data-significance', (func.significance || 50).toString());
                
                // Fade in animation
                nodeG.style.opacity = '0';
                nodeG.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', positions[i].x);
                circle.setAttribute('cy', positions[i].y);
                
                // Vary size by significance (higher significance = slightly larger)
                const significance = func.significance || 50;
                const baseRadius = 10 + func.complexity * 1.2;
                const significanceBonus = (significance / 100) * 4; // 0-4px bonus
                circle.setAttribute('r', (baseRadius + significanceBonus).toString());
                
                if (func.complexity < 3) {
                    circle.setAttribute('fill', '#4CAF50');
                } else if (func.complexity < 7) {
                    circle.setAttribute('fill', '#FFC107');
                } else {
                    circle.setAttribute('fill', '#FF5722');
                }
                
                // Add subtle glow to high-significance functions
                if (significance >= 70) {
                    circle.style.filter = 'drop-shadow(0 0 3px rgba(102, 126, 234, 0.5))';
                }
                
                nodeG.appendChild(circle);

                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('class', 'node-text');
                text.setAttribute('x', positions[i].x);
                text.setAttribute('y', positions[i].y - 16);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', 'var(--vscode-foreground)');
                text.textContent = func.displayName && func.displayName.length > 15 
                    ? func.displayName.substring(0, 12) + '...' 
                    : (func.displayName || func.name);
                nodeG.appendChild(text);

                // Event handlers (same as before)
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

                nodeG.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    isDraggingNode = true;
                    draggedNodeIndex = i;
                    nodeG.classList.add('dragging');
                });

                g.appendChild(nodeG);
                
                // Trigger fade-in
                setTimeout(() => { 
                    nodeG.style.opacity = '1'; 
                }, 10);
            });
        }


        function renderStandardView(g, functions, positions) {
            // Filter by significance
            const visibleFunctions = functions.filter((func, i) => 
                positions[i].x > -1000 && 
                shouldShowFunction(func, scale, isWorkspaceMode, expandedFiles, new Set())
            );
            
            const visibleIndices = new Set(
                visibleFunctions.map(func => functions.indexOf(func))
            );

            // Draw links only between visible functions
            functions.forEach((func, i) => {
                if (!visibleIndices.has(i) || positions[i].x < -1000) return;
                
                func.calls.forEach(calledFunc => {
                    const targetIndex = functions.findIndex(f => f.name === calledFunc);
                    if (targetIndex !== -1 && visibleIndices.has(targetIndex) && positions[targetIndex].x > -1000) {
                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        line.setAttribute('class', 'link');
                        line.setAttribute('data-source-index', i.toString());
                        line.setAttribute('data-target-index', targetIndex.toString());
                        line.setAttribute('x1', positions[i].x);
                        line.setAttribute('y1', positions[i].y);
                        line.setAttribute('x2', positions[targetIndex].x);
                        line.setAttribute('y2', positions[targetIndex].y);
                        
                        line.style.opacity = '0';
                        line.style.transition = 'opacity 0.3s ease';
                        setTimeout(() => { line.style.opacity = '0.4'; }, 10);
                        
                        g.appendChild(line);
                    }
                });
            });

            // Draw only visible nodes
            visibleFunctions.forEach(func => {
                const i = functions.indexOf(func);
                if (positions[i].x < -1000) return;
                
                const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                nodeG.setAttribute('class', 'node');
                nodeG.setAttribute('data-function-name', func.name);
                nodeG.setAttribute('data-line', func.startLine.toString());
                nodeG.setAttribute('data-node-index', i.toString());
                nodeG.setAttribute('data-significance', (func.significance || 50).toString());
                
                nodeG.style.opacity = '0';
                nodeG.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', positions[i].x);
                circle.setAttribute('cy', positions[i].y);
                
                const significance = func.significance || 50;
                const baseRadius = 10 + func.complexity * 1.2;
                const significanceBonus = (significance / 100) * 4;
                circle.setAttribute('r', (baseRadius + significanceBonus).toString());
                
                if (func.complexity < 3) {
                    circle.setAttribute('fill', '#4CAF50');
                } else if (func.complexity < 7) {
                    circle.setAttribute('fill', '#FFC107');
                } else {
                    circle.setAttribute('fill', '#FF5722');
                }
                
                if (significance >= 70) {
                    circle.style.filter = 'drop-shadow(0 0 3px rgba(102, 126, 234, 0.5))';
                }
                
                nodeG.appendChild(circle);

                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('class', 'node-text');
                text.setAttribute('x', positions[i].x);
                text.setAttribute('y', positions[i].y - 16);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', 'var(--vscode-foreground)');
                text.textContent = func.displayName && func.displayName.length > 15 
                    ? func.displayName.substring(0, 12) + '...' 
                    : (func.displayName || func.name);
                nodeG.appendChild(text);

                // Same event handlers as detailed view
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

                nodeG.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    isDraggingNode = true;
                    draggedNodeIndex = i;
                    nodeG.classList.add('dragging');
                });

                g.appendChild(nodeG);
                
                setTimeout(() => { 
                    nodeG.style.opacity = '1'; 
                }, 10);
            });
        }

        function zoomToFile(fileName, bounds) {
            expandedFiles.clear();
            expandedFiles.add(fileName);

            const canvas = document.getElementById('canvas');
            const rect = canvas.getBoundingClientRect();
            
            const targetScale = Math.min(
                (rect.width * 0.7) / bounds.width,
                (rect.height * 0.7) / bounds.height,
                3
            );
            
            const targetTranslateX = rect.width / 2 - bounds.centerX * targetScale;
            const targetTranslateY = rect.height / 2 - bounds.centerY * targetScale;

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
                
                const eased = progress < 0.5 
                    ? 2 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

                scale = startScale + (targetScale - startScale) * eased;
                translateX = startX + (targetX - startX) * eased;
                translateY = startY + (targetY - startY) * eased;

                if (gElement) {
                    gElement.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
                }

                updateZoomIndicator();

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    renderVisualization();
                }
            }

            animate();
        }

        function updateLayoutDescription() {
            const layoutDesc = document.getElementById('layout-description');
            if (!layoutDesc) return;

            const minSig = getMinSignificance(scale);
            
            if (!currentData || !currentData.functions) {
                layoutDesc.textContent = 'No data loaded';
                return;
            }
            
            const allFuncs = Object.values(currentData.functions);
            const funcCount = allFuncs.filter(f => 
                (f.significance !== undefined ? f.significance : 100) >= minSig
            ).length;
            
            const totalFuncs = allFuncs.length;

            if (isWorkspaceMode && currentLayout === 'force') {
                if (scale > ZOOM_THRESHOLD || expandedFiles.size > 0) {
                    layoutDesc.textContent = \`Showing \${funcCount}/\${totalFuncs} functions (sig ≥ \${minSig}, zoom: \${scale.toFixed(2)}x)\`;
                } else {
                    layoutDesc.textContent = 'File overview - zoom in or click a file to see details';
                }
            } else if (currentLayout === 'hierarchical') {
                layoutDesc.textContent = \`Hierarchical - \${funcCount}/\${totalFuncs} functions (sig ≥ \${minSig})\`;
            } else {
                layoutDesc.textContent = \`Showing \${funcCount}/\${totalFuncs} functions visible (sig ≥ \${minSig}, zoom: \${scale.toFixed(2)}x)\`;
            }
        }



        function updateNodePositions() {
            if (!gElement || !currentData) return;

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
                        text.setAttribute('y', nodePositions[i].y - 16);
                    }
                }
            });

            const links = gElement.querySelectorAll('.link');
            links.forEach(line => {
                const sourceIdx = parseInt(line.getAttribute('data-source-index'));
                const targetIdx = parseInt(line.getAttribute('data-target-index'));

                if (!isNaN(sourceIdx) && !isNaN(targetIdx)) {
                    const sourcePos = nodePositions[sourceIdx];
                    const targetPos = nodePositions[targetIdx];

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
            
            const cols = Math.ceil(Math.sqrt(numClusters * 1.5));
            const rows = Math.ceil(numClusters / cols);
            
            const horizontalMargin = 400;
            const verticalMargin = 300;
            const clusterWidth = Math.max(250, (width - horizontalMargin) / cols);
            const clusterHeight = Math.max(200, (height - verticalMargin) / rows);

            const positions = new Array(functions.length);

            clusterArray.forEach(([fileName, nodes], clusterIndex) => {
                const col = clusterIndex % cols;
                const row = Math.floor(clusterIndex / cols);
                
                const clusterCenterX = horizontalMargin/2 + col * clusterWidth + clusterWidth / 2;
                const clusterCenterY = verticalMargin/2 + row * clusterHeight + clusterHeight / 2;

                const clusterPositions = nodes.map(() => ({
                    x: clusterCenterX + (Math.random() - 0.5) * (clusterWidth * 0.4),
                    y: clusterCenterY + (Math.random() - 0.5) * (clusterHeight * 0.4),
                    vx: 0,
                    vy: 0
                }));

                for (let iter = 0; iter < 120; iter++) {
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

                    clusterPositions.forEach(pos => {
                        const dx = clusterCenterX - pos.x;
                        const dy = clusterCenterY - pos.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const force = distance * 0.003;
                        
                        pos.vx += (dx / distance) * force;
                        pos.vy += (dy / distance) * force;
                    });

                    clusterPositions.forEach(pos => {
                        pos.x += pos.vx;
                        pos.y += pos.vy;
                        pos.vx *= 0.8;
                        pos.vy *= 0.8;

                        const margin = 30;
                        pos.x = Math.max(clusterCenterX - clusterWidth/2 + margin, 
                                        Math.min(clusterCenterX + clusterWidth/2 - margin, pos.x));
                        pos.y = Math.max(clusterCenterY - clusterHeight/2 + margin, 
                                        Math.min(clusterCenterY + clusterHeight/2 - margin, pos.y));
                    });
                }

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
                            positions[i].vy -= (dy / distance) * force;
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
            vscode.postMessage({
                command: 'analyzeComplexity',
                functionName: func.name,
                code: func.code
            });

            const panel = document.getElementById('info-panel');
            const fileName = func.fileName ? func.fileName.split('/').pop() : 'Unknown';
            
            // Get significance level description
            const significance = func.significance || 50;
            let sigLabel = 'Medium';
            let sigColor = '#FFC107';
            if (significance >= 70) {
                sigLabel = 'High (Entry Point/Export)';
                sigColor = '#4CAF50';
            } else if (significance < 40) {
                sigLabel = 'Low (Helper Function)';
                sigColor = '#9CA3AF';
            }
            
            panel.innerHTML = \`
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <h3 style="margin: 0;">\${func.displayName || func.name}</h3>
                    <button onclick="hideInfo()" style="background: transparent; color: var(--vscode-foreground); border: none; cursor: pointer; font-size: 18px; padding: 0; margin: 0; line-height: 1;">×</button>
                </div>
                <ul>
                    <li><strong>File:</strong> \${fileName}</li>
                    <li><strong>Lines:</strong> \${func.startLine} - \${func.endLine}</li>
                    <li><strong>Significance:</strong> <span style="color: \${sigColor}; font-weight: bold;">\${sigLabel} (\${significance})</span></li>
                    <li><strong>Complexity:</strong> <span id="complexity-value">Analyzing...</span></li>
                    <li><strong>Description:</strong> <span id="description-value">Analyzing...</span></li>
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

            svg.addEventListener('wheel', (e) => {
                e.preventDefault();
                const oldScale = scale;
                const delta = e.deltaY > 0 ? 0.95 : 1.05;
                const newScale = Math.max(0.1, Math.min(5, oldScale * delta));
                
                const rect = svg.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                translateX = mouseX - (mouseX - translateX) * (newScale / oldScale);
                translateY = mouseY - (mouseY - translateY) * (newScale / oldScale);
                
                scale = newScale;
                
                if (gElement) {
                    gElement.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
                }

                updateZoomIndicator();

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
            updateZoomIndicator();
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
            
            const canvas = document.getElementById('canvas');
            const rect = canvas.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            translateX = centerX - (centerX - translateX) * (newScale / oldScale);
            translateY = centerY - (centerY - translateY) * (newScale / oldScale);
            
            scale = newScale;
            
            if (gElement) {
                gElement.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
            }

            updateZoomIndicator();

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
            
            const canvas = document.getElementById('canvas');
            const rect = canvas.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            translateX = centerX - (centerX - translateX) * (newScale / oldScale);
            translateY = centerY - (centerY - translateY) * (newScale / oldScale);
            
            scale = newScale;
            
            if (gElement) {
                gElement.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
            }

            updateZoomIndicator();

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
        renderVisualization();
        `;
    }
}