export function getWelcomeHTML(): string {
    return `
        <div class="welcome-wrapper">
            <!-- Animated Background -->
            <canvas id="bg-canvas" class="background-canvas"></canvas>
            
            <div class="welcome-container">
                <!-- Hero Section -->
                <div class="hero-section">
                    <div class="logo-animated">
                        <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                            <!-- Animated nodes -->
                            <circle class="node node-1" cx="60" cy="30" r="6" fill="#4CAF50"/>
                            <circle class="node node-2" cx="30" cy="60" r="6" fill="#2196F3"/>
                            <circle class="node node-3" cx="90" cy="60" r="6" fill="#FFC107"/>
                            <circle class="node node-4" cx="45" cy="90" r="6" fill="#9C27B0"/>
                            <circle class="node node-5" cx="75" cy="90" r="6" fill="#FF5722"/>
                            
                            <!-- Animated connections -->
                            <path class="link link-1" d="M 60 30 L 30 60" stroke="#667eea" stroke-width="2" opacity="0.4"/>
                            <path class="link link-2" d="M 60 30 L 90 60" stroke="#667eea" stroke-width="2" opacity="0.4"/>
                            <path class="link link-3" d="M 30 60 L 45 90" stroke="#667eea" stroke-width="2" opacity="0.4"/>
                            <path class="link link-4" d="M 90 60 L 75 90" stroke="#667eea" stroke-width="2" opacity="0.4"/>
                            <path class="link link-5" d="M 45 90 L 75 90" stroke="#667eea" stroke-width="2" opacity="0.4"/>
                        </svg>
                    </div>
                    
                    <h1 class="hero-title">
                        <span class="gradient-text">Code Flow</span> Visualizer
                    </h1>
                    
                    <p class="hero-subtitle">Transform your codebase into interactive visual insights</p>
                    
                    <div class="quick-start">
                        <button class="cta-button" onclick="analyzeWorkspace()">
                            <span class="button-icon">📁</span>
                            Analyze Workspace
                        </button>
                        <button class="cta-button secondary" onclick="analyzeCurrentFile()">
                            <span class="button-icon">📄</span>
                            Analyze File
                        </button>
                    </div>

                </div>

                <!-- Interactive Demo Hint -->
                <div class="demo-hint">
                    <div class="hint-content">
                        <span class="hint-icon">💡</span>
                        <div>
                            <strong>Pro Tip:</strong> Try analyzing a complex file to see the magic happen
                        </div>
                    </div>
                </div>


                <!-- Footer -->
                <div class="welcome-footer">
                    <div class="supported-languages">
                        <span class="lang-badge">JavaScript</span>
                        <span class="lang-badge">TypeScript</span>
                        <span class="lang-badge">Python</span>
                        <span class="lang-badge">Java</span>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .welcome-wrapper {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                overflow-y: auto;
                overflow-x: hidden;
            }

            .background-canvas {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 0;
                pointer-events: none;
            }

            .welcome-container {
                position: relative;
                z-index: 1;
                max-width: 800px;
                margin: 0 auto;
                padding: 60px 40px;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                gap: 50px;
            }

            /* Hero Section */
            .hero-section {
                text-align: center;
                padding: 40px 20px;
            }

            .logo-animated {
                width: 120px;
                height: 120px;
                margin: 0 auto 30px;
                filter: drop-shadow(0 10px 30px rgba(102, 126, 234, 0.3));
                animation: float 4s ease-in-out infinite;
            }

            @keyframes float {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                50% { transform: translateY(-20px) rotate(5deg); }
            }

            .logo-animated .node {
                animation: pulse 2s ease-in-out infinite;
            }

            .node-1 { animation-delay: 0s; }
            .node-2 { animation-delay: 0.2s; }
            .node-3 { animation-delay: 0.4s; }
            .node-4 { animation-delay: 0.6s; }
            .node-5 { animation-delay: 0.8s; }

            @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.3); opacity: 0.8; }
            }

            .logo-animated .link {
                animation: linkPulse 3s ease-in-out infinite;
            }

            .link-1 { animation-delay: 0s; }
            .link-2 { animation-delay: 0.3s; }
            .link-3 { animation-delay: 0.6s; }
            .link-4 { animation-delay: 0.9s; }
            .link-5 { animation-delay: 1.2s; }

            @keyframes linkPulse {
                0%, 100% { opacity: 0.2; stroke-width: 2; }
                50% { opacity: 0.8; stroke-width: 3; }
            }

            .hero-title {
                font-size: 48px;
                font-weight: 800;
                margin: 0 0 16px 0;
                letter-spacing: -1px;
            }

            .gradient-text {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                animation: gradientShift 3s ease infinite;
                background-size: 200% 200%;
            }

            @keyframes gradientShift {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }

            .hero-subtitle {
                font-size: 18px;
                color: var(--vscode-descriptionForeground);
                margin: 0 0 40px 0;
                opacity: 0.9;
            }

            /* Quick Start */
            .quick-start {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 16px;
                flex-wrap: wrap;
            }

            .shortcut-badge {
                display: flex;
                gap: 6px;
                align-items: center;
                padding: 12px 20px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 12px;
                border: 2px solid var(--vscode-panel-border);
                transition: all 0.3s ease;
            }

            .shortcut-badge:hover {
                transform: translateY(-2px);
                border-color: #667eea;
                box-shadow: 0 8px 20px rgba(102, 126, 234, 0.2);
            }

            .shortcut-badge kbd {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 6px 12px;
                font-size: 14px;
                font-weight: 600;
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
            }

            .or-text {
                color: var(--vscode-descriptionForeground);
                font-size: 14px;
                font-style: italic;
            }

            .cta-button {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            }

            .cta-button:hover {
                transform: translateY(-3px);
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
            }

            .cta-button:active {
                transform: translateY(-1px);
            }

            .button-icon {
                font-size: 20px;
                animation: sparkle 1.5s ease-in-out infinite;
            }

            @keyframes sparkle {
                0%, 100% { transform: scale(1) rotate(0deg); }
                50% { transform: scale(1.2) rotate(180deg); }
            }

            /* Demo Hint */
            .demo-hint {
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
                border: 2px dashed rgba(102, 126, 234, 0.3);
                border-radius: 16px;
                padding: 20px;
                animation: glow 2s ease-in-out infinite;
            }

            @keyframes glow {
                0%, 100% { box-shadow: 0 0 20px rgba(102, 126, 234, 0.1); }
                50% { box-shadow: 0 0 30px rgba(102, 126, 234, 0.3); }
            }

            .hint-content {
                display: flex;
                align-items: center;
                gap: 16px;
            }

            .hint-icon {
                font-size: 32px;
                animation: wiggle 1s ease-in-out infinite;
            }

            @keyframes wiggle {
                0%, 100% { transform: rotate(0deg); }
                25% { transform: rotate(-10deg); }
                75% { transform: rotate(10deg); }
            }

            .hint-content div {
                flex: 1;
                line-height: 1.6;
            }

            .hint-content strong {
                color: var(--vscode-textLink-foreground);
            }

            /* Actions */
            .welcome-actions {
                display: flex;
                gap: 16px;
                justify-content: center;
                margin-top: 20px;
            }

            .primary-action,
            .secondary-action {
                padding: 14px 32px;
                font-size: 16px;
                font-weight: 600;
                border-radius: 12px;
                border: none;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .primary-action {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            }

            .primary-action:hover {
                transform: translateY(-3px);
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
            }

            .secondary-action {
                background: transparent;
                color: var(--vscode-descriptionForeground);
                border: 2px solid var(--vscode-panel-border);
            }

            .secondary-action:hover {
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-color: var(--vscode-textLink-foreground);
                color: var(--vscode-foreground);
            }

            /* Footer */
            .welcome-footer {
                text-align: center;
                padding-top: 40px;
                border-top: 1px solid var(--vscode-panel-border);
                margin-top: auto;
            }

            .supported-languages {
                display: flex;
                gap: 10px;
                justify-content: center;
                flex-wrap: wrap;
            }

            .lang-badge {
                padding: 6px 14px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 20px;
                font-size: 12px;
                font-weight: 500;
                transition: all 0.2s ease;
            }

            .lang-badge:hover {
                border-color: #667eea;
                transform: scale(1.1);
            }

            /* Responsive */
            @media (max-width: 600px) {
                .welcome-container {
                    padding: 40px 20px;
                }

                .hero-title {
                    font-size: 36px;
                }

                .quick-start {
                    flex-direction: column;
                }

                .welcome-actions {
                    flex-direction: column;
                }

                .primary-action,
                .secondary-action {
                    width: 100%;
                }
            }
        </style>

        <script>
            function analyzeCurrentFile() {
                vscode.postMessage({
                    command: 'analyzeCurrentFile'
                });
            }

            function analyzeWorkspace() {
                vscode.postMessage({
                    command: 'analyzeWorkspace'
                });
            }

            // Animated background
            (function() {
                const canvas = document.getElementById('bg-canvas');
                const ctx = canvas.getContext('2d');
                
                function resize() {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                }
                resize();
                window.addEventListener('resize', resize);

                const particles = [];
                const particleCount = 30;
                
                for (let i = 0; i < particleCount; i++) {
                    particles.push({
                        x: Math.random() * canvas.width,
                        y: Math.random() * canvas.height,
                        vx: (Math.random() - 0.5) * 0.5,
                        vy: (Math.random() - 0.5) * 0.5,
                        radius: Math.random() * 2 + 1
                    });
                }

                function animate() {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Update and draw particles
                    particles.forEach(p => {
                        p.x += p.vx;
                        p.y += p.vy;
                        
                        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
                        
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(102, 126, 234, 0.2)';
                        ctx.fill();
                    });
                    
                    // Draw connections
                    particles.forEach((p1, i) => {
                        particles.slice(i + 1).forEach(p2 => {
                            const dx = p1.x - p2.x;
                            const dy = p1.y - p2.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            if (distance < 150) {
                                ctx.beginPath();
                                ctx.moveTo(p1.x, p1.y);
                                ctx.lineTo(p2.x, p2.y);
                                ctx.strokeStyle = \`rgba(102, 126, 234, \${0.15 * (1 - distance / 150)})\`;
                                ctx.lineWidth = 1;
                                ctx.stroke();
                            }
                        });
                    });
                    
                    requestAnimationFrame(animate);
                }
                
                animate();
            })();
        </script>
    `;
}