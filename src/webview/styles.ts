export function getWebviewStyles(): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            min-height: 100vh;
            overflow: hidden;
        }
        .cta-button.secondary {
            background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
            width: 80%;
            justify-content: center;
            align-items: cent
        }

        .cta-button {
            margin: 5px;
            width: 80%;
            justify-content: center;
            align-items: center;
        }

        #container {
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
            position: relative;
        }

        /* ========== CONTROLS BAR ========== */
        #controls {
            flex-shrink: 0;
            padding: 16px 24px;
            background: linear-gradient(135deg, 
                var(--vscode-editor-background) 0%, 
                var(--vscode-sideBar-background) 100%);
            border-bottom: 2px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            z-index: 100;
        }

        .controls-section {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 0 12px;
            border-right: 1px solid var(--vscode-panel-border);
        }

        .controls-section:last-child {
            border-right: none;
        }

        #layout-info {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            background: linear-gradient(135deg, 
                var(--vscode-button-background) 0%, 
                var(--vscode-button-hoverBackground) 100%);
            color: var(--vscode-button-foreground);
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
        }

        #layout-info::before {
            content: "📊";
            font-size: 14px;
        }

        #layout-description {
            display: block;
            margin-top: 8px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            width: 100%;
            padding-left: 4px;
        }

        /* ========== BUTTONS ========== */
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 18px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            position: relative;
            overflow: hidden;
        }

        button::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            transform: translate(-50%, -50%);
            transition: width 0.6s, height 0.6s;
        }

        button:hover::before {
            width: 300px;
            height: 300px;
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        button:active {
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        /* Button icons */
        button.icon-btn {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        button.icon-btn::after {
            font-size: 14px;
        }

        button[onclick="resetView()"]::after { content: "🔄"; }
        button[onclick="toggleLayout()"]::after { content: "🔀"; }
        button[onclick="zoomIn()"]::after { content: "🔍+"; }
        button[onclick="zoomOut()"]::after { content: "🔍−"; }

        /* ========== CHECKBOX/TOGGLE ========== */
        label {
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            user-select: none;
            padding: 6px 10px;
            border-radius: 6px;
            transition: background 0.2s;
        }

        label:hover {
            background: var(--vscode-list-hoverBackground);
        }

        input[type="checkbox"] {
            cursor: pointer;
            width: 16px;
            height: 16px;
            accent-color: var(--vscode-button-background);
        }

        /* ========== CANVAS ========== */
        #canvas {
            flex: 1;
            background: radial-gradient(circle at 20% 50%, 
                var(--vscode-editor-background) 0%, 
                var(--vscode-sideBar-background) 100%);
            cursor: grab;
            position: relative;
            overflow: hidden;
        }

        #canvas.panning {
            cursor: grabbing;
        }

        #main-svg {
            width: 100%;
            height: 100%;
        }

        /* ========== INFO PANEL ========== */
        .info-panel {
            position: fixed;
            top: 90px;
            right: 24px;
            background: var(--vscode-editor-background);
            padding: 24px;
            border-radius: 12px;
            max-width: 360px;
            min-width: 300px;
            display: none;
            z-index: 9999;
            border: 2px solid var(--vscode-textLink-foreground);
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5);
            animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
        }

        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(30px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        .info-panel::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, 
                var(--vscode-textLink-foreground), 
                var(--vscode-textLink-activeForeground));
            border-radius: 12px 12px 0 0;
        }

        .info-panel h3 {
            margin-bottom: 18px;
            color: var(--vscode-textLink-foreground);
            font-size: 20px;
            font-weight: 700;
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .info-panel h3::before {
            content: "ƒ";
            font-family: monospace;
            font-size: 24px;
            color: var(--vscode-textLink-activeForeground);
        }

        .info-panel ul {
            list-style: none;
            padding-left: 0;
        }

        .info-panel li {
            margin: 12px 0;
            font-size: 14px;
            display: grid;
            grid-template-columns: 110px 1fr;
            gap: 12px;
            align-items: start;
            padding: 8px;
            border-radius: 6px;
            transition: background 0.2s;
        }

        .info-panel li:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .info-panel li strong {
            color: var(--vscode-textLink-activeForeground);
            font-weight: 600;
        }

        .info-panel li span {
            word-break: break-word;
        }

        .close-info-btn {
            position: absolute;
            top: 16px;
            right: 16px;
            background: transparent;
            color: var(--vscode-foreground);
            border: none;
            cursor: pointer;
            font-size: 24px;
            padding: 4px 8px;
            line-height: 1;
            border-radius: 6px;
            transition: all 0.2s;
        }

        .close-info-btn:hover {
            background: var(--vscode-list-hoverBackground);
            color: var(--vscode-errorForeground);
            transform: rotate(90deg);
        }

        /* ========== NODES ========== */
        .node {
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
        }

        .node:hover {
            filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.4)) brightness(1.2);
        }

        .node.dragging {
            cursor: grabbing;
            filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5));
        }

        .node.highlighted {
            filter: drop-shadow(0 8px 16px rgba(102, 126, 234, 0.6)) brightness(1.3);
        }

        .node circle {
            /* Use a vibrant gradient similar to the purple in your logo */
            fill: #9d66e5; 
            
            /* A semi-transparent white stroke gives it a "glass" edge */
            stroke: rgba(255, 255, 255, 0.4);
            stroke-width: 1.5px;
            
            /* The Glow: matches the button shadow in your image */
            filter: drop-shadow(0 0 8px rgba(157, 102, 229, 0.6));
            
            /* Smooth interaction */
            transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
            cursor: pointer;
        }

        .node:hover circle {
            /* Brighten and expand the glow on hover */
            fill: #b98eff;
            filter: drop-shadow(0 0 12px rgba(157, 102, 229, 0.9));
        }

        /* ========== NODE TEXT ========== */
        .node-text {
            font-family: 'Segoe UI', system-ui, sans-serif;
            font-size: 13px;
            font-weight: 600;
            pointer-events: none;
            user-select: none;
            text-shadow: 
                0 1px 2px rgba(0, 0, 0, 0.8),
                0 0 8px rgba(0, 0, 0, 0.5);
            paint-order: stroke fill;
            stroke: rgba(0, 0, 0, 0.8);
            stroke-width: 3px;
            stroke-linecap: round;
            stroke-linejoin: round;
        }

        /* Multi-line text support */
        .node-text-line {
            font-family: 'Segoe UI', system-ui, sans-serif;
            font-size: 12px;
            font-weight: 600;
            pointer-events: none;
            user-select: none;
            text-shadow: 
                0 1px 2px rgba(0, 0, 0, 0.8),
                0 0 8px rgba(0, 0, 0, 0.5);
            paint-order: stroke fill;
            stroke: rgba(0, 0, 0, 0.8);
            stroke-width: 3px;
            stroke-linecap: round;
            stroke-linejoin: round;
        }

        /* ========== LINKS ========== */
        .link {
            stroke: var(--vscode-textLink-foreground);
            stroke-opacity: 0.4;
            stroke-width: 2px;
            fill: none;
            pointer-events: none;
            transition: all 0.3s;
        }

        .link.highlighted {
            stroke-opacity: 0.9;
            stroke-width: 4px;
            filter: drop-shadow(0 0 8px var(--vscode-textLink-foreground));
        }

        /* Animated flow */
        .link.animated {
            stroke-dasharray: 8, 4;
            animation: dashFlow 1s linear infinite;
        }

        @keyframes dashFlow {
            to {
                stroke-dashoffset: -12;
            }
        }

        /* ========== FILE BLOCKS ========== */
        .file-block {
            fill: rgba(59, 130, 246, 0.08);
            stroke: rgba(59, 130, 246, 0.5);
            stroke-width: 2;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
        }

        .file-block:hover {
            fill: rgba(59, 130, 246, 0.18);
            stroke: rgba(59, 130, 246, 0.9);
            stroke-width: 3;
            filter: drop-shadow(0 8px 16px rgba(59, 130, 246, 0.4));
        }

        .file-block-label {
            fill: #e5e7eb;
            font-size: 16px;
            font-weight: 700;
            pointer-events: none;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
            letter-spacing: 0.5px;
        }

        .file-block-count {
            fill: #9ca3af;
            font-size: 13px;
            pointer-events: none;
            font-weight: 500;
        }

        .file-block-hint {
            opacity: 0;
            transition: opacity 0.3s;
            fill: rgba(255, 255, 255, 0.5);
            font-size: 11px;
            font-weight: 500;
        }

        .file-block-group {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
        }

        .file-block-group:hover .file-block-hint {
            opacity: 1;
        }

        .file-block-group:hover {
            transform: translateY(-2px);
        }

        /* ========== COMPLEXITY COLORS ========== */
        .complexity-low {
            fill: #10b981;
        }

        .complexity-medium {
            fill: #f59e0b;
        }

        .complexity-high {
            fill: #ef4444;
        }

        /* Add glow effects */
        .complexity-low:hover {
            fill: #34d399;
            filter: drop-shadow(0 0 12px #10b981);
        }

        .complexity-medium:hover {
            fill: #fbbf24;
            filter: drop-shadow(0 0 12px #f59e0b);
        }

        .complexity-high:hover {
            fill: #f87171;
            filter: drop-shadow(0 0 12px #ef4444);
        }

        /* ========== TOOLTIP ========== */
        .tooltip {
            position: fixed;
            background: var(--vscode-editorHoverWidget-background);
            border: 2px solid var(--vscode-editorHoverWidget-border);
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            pointer-events: none;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            display: none;
            max-width: 300px;
            word-wrap: break-word;
            animation: fadeIn 0.2s;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* ========== ZOOM INDICATOR ========== */
        .zoom-indicator {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(135deg, 
                var(--vscode-button-background), 
                var(--vscode-button-hoverBackground));
            color: var(--vscode-button-foreground);
            padding: 10px 20px;
            border-radius: 24px;
            font-size: 14px;
            font-weight: 700;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .zoom-indicator::before {
            content: "🔍";
            font-size: 16px;
        }

        .zoom-indicator.visible {
            opacity: 1;
        }

        /* ========== MINI MAP ========== */
        .minimap {
            position: fixed;
            bottom: 30px;
            left: 30px;
            width: 200px;
            height: 150px;
            background: var(--vscode-editor-background);
            border: 2px solid var(--vscode-panel-border);
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            opacity: 0.8;
            transition: opacity 0.3s;
        }

        .minimap:hover {
            opacity: 1;
        }

        .minimap-viewport {
            fill: rgba(59, 130, 246, 0.3);
            stroke: rgba(59, 130, 246, 0.8);
            stroke-width: 2;
        }

        /* ========== LOADING STATE ========== */
        .loading-spinner {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
        }

        .spinner {
            width: 60px;
            height: 60px;
            border: 5px solid var(--vscode-panel-border);
            border-top-color: var(--vscode-textLink-foreground);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 24px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .loading-text {
            color: var(--vscode-descriptionForeground);
            font-size: 16px;
            font-weight: 500;
        }

        /* ========== STATS OVERLAY ========== */
        .stats-overlay {
            position: fixed;
            top: 90px;
            left: 24px;
            background: var(--vscode-editor-background);
            padding: 16px 20px;
            border-radius: 12px;
            border: 2px solid var(--vscode-panel-border);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            font-size: 12px;
            z-index: 1000;
            opacity: 0.9;
            transition: opacity 0.3s;
        }

        .stats-overlay:hover {
            opacity: 1;
        }

        .stats-overlay h4 {
            margin-bottom: 10px;
            color: var(--vscode-textLink-foreground);
            font-size: 14px;
            font-weight: 600;
        }

        .stat-item {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin: 6px 0;
            padding: 4px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .stat-item:last-child {
            border-bottom: none;
        }

        .stat-label {
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
        }

        .stat-value {
            color: var(--vscode-foreground);
            font-weight: 700;
        }

        /* ========== RESPONSIVE ========== */
        @media (max-width: 768px) {
            #controls {
                padding: 12px 16px;
            }

            button {
                padding: 8px 14px;
                font-size: 12px;
            }

            .info-panel {
                max-width: calc(100vw - 48px);
                right: 24px;
                left: 24px;
            }

            .minimap {
                display: none;
            }

            .stats-overlay {
                display: none;
            }
        }

        /* ========== DARK MODE ENHANCEMENTS ========== */
        @media (prefers-color-scheme: dark) {
            .node circle {
                stroke: rgba(255, 255, 255, 0.2);
            }

            .file-block {
                fill: rgba(59, 130, 246, 0.12);
            }
        }
    `;
}