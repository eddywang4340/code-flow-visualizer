export function getWebviewStyles(): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            min-height: 100vh;
        }

        #container {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
            position: relative;
            overflow: visible;
        }

        #controls {
            flex-shrink: 0;
            margin-bottom: 20px;
            padding: 15px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 5px;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
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
            width: 100%;
        }

        #canvas {
            flex: 1;
            border: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
            cursor: grab;
            overflow: visible;
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
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s ease;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
            transform: translateY(-1px);
        }

        button:active {
            transform: translateY(0);
        }

        label {
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            user-select: none;
        }

        input[type="checkbox"] {
            cursor: pointer;
        }

        .info-panel {
            position: fixed;
            top: 80px;
            right: 20px;
            background-color: var(--vscode-editor-background);
            padding: 20px;
            border-radius: 8px;
            max-width: 320px;
            display: none;
            z-index: 9999;
            border: 2px solid var(--vscode-textLink-foreground);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
            animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(20px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        .info-panel h3 {
            margin-bottom: 16px;
            color: var(--vscode-textLink-foreground);
            font-size: 18px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }

        .info-panel ul {
            list-style: none;
            padding-left: 0;
        }

        .info-panel li {
            margin: 10px 0;
            font-size: 13px;
            display: flex;
            align-items: start;
            gap: 8px;
        }

        .info-panel li strong {
            color: var(--vscode-textLink-activeForeground);
            min-width: 100px;
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
            filter: brightness(1.4);
            stroke: var(--vscode-textLink-activeForeground);
            stroke-width: 3px;
        }

        .node-text {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            font-weight: 500;
            pointer-events: none;
            user-select: none;
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
        }

        .link {
            stroke: var(--vscode-textLink-foreground);
            stroke-opacity: 0.5;
            stroke-width: 2px;
            fill: none;
            pointer-events: none;
            transition: stroke-opacity 0.2s;
        }

        .link.highlighted {
            stroke-opacity: 1;
            stroke-width: 3px;
        }

        .file-block {
            fill: rgba(59, 130, 246, 0.08);
            stroke: rgba(59, 130, 246, 0.4);
            stroke-width: 1.5;
            transition: all 0.2s ease;
        }

        .file-block:hover {
            fill: rgba(59, 130, 246, 0.15);
            stroke: rgba(59, 130, 246, 0.8);
            stroke-width: 3;
        }

        .file-block-label {
            fill: #e5e7eb;
            font-size: 14px;
            font-weight: 600;
            pointer-events: none;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }

        .file-block-count {
            fill: #9ca3af;
            font-size: 12px;
            pointer-events: none;
        }

        .file-block-hint {
            opacity: 0;
            transition: opacity 0.2s;
            fill: rgba(255, 255, 255, 0.4);
            font-size: 10px;
        }

        .file-block-group {
            transition: all 0.2s ease;
        }

        .file-block-group:hover .file-block-hint {
            opacity: 1;
        }

        /* Complexity colors */
        .complexity-low {
            fill: #4CAF50;
        }

        .complexity-medium {
            fill: #FFC107;
        }

        .complexity-high {
            fill: #FF5722;
        }

        /* Loading state */
        .loading-spinner {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
        }

        .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid var(--vscode-panel-border);
            border-top-color: var(--vscode-textLink-foreground);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .loading-text {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }

        /* Tooltip */
        .tooltip {
            position: fixed;
            background: var(--vscode-editorHoverWidget-background);
            border: 1px solid var(--vscode-editorHoverWidget-border);
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            display: none;
        }

        /* Zoom indicator */
        .zoom-indicator {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
        }

        .zoom-indicator.visible {
            opacity: 1;
        }
    `;
}