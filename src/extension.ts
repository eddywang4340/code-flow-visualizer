import * as vscode from 'vscode';
import { CodeAnalyzer } from './analyzer';
import { FlowVisualizer } from './visualizer-refactored';
    
let currentVisualizer: FlowVisualizer | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Flow Visualizer is now active!');

    // Create status bar button
    const statusBarButton = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right, 
        100 // Priority (higher = more to the left)
    );
    statusBarButton.text = "$(graph-scatter) Code Flow"; // $(graph) is a built-in icon
    statusBarButton.tooltip = "Open Code Flow Visualizer";
    statusBarButton.command = 'codeFlowVisualizer.start';
    statusBarButton.show();
    
    context.subscriptions.push(statusBarButton);

     // Add this new command to reset welcome
    let resetWelcomeCommand = vscode.commands.registerCommand('codeFlowVisualizer.resetWelcome', () => {
        context.globalState.update('codeFlowVisualizer.showWelcome', true);
        vscode.window.showInformationMessage('Welcome screen will show on next launch');
    });

    // Register command to start visualization
    let startCommand = vscode.commands.registerCommand('codeFlowVisualizer.start', () => {
        if (currentVisualizer) {
            currentVisualizer.reveal();
        } else {
            currentVisualizer = new FlowVisualizer(context.extensionUri, context);
            currentVisualizer.onDidDispose(() => {
                currentVisualizer = undefined;
            });
        }
        vscode.window.showInformationMessage('Code Flow Visualizer started!');
    });

    // Register command to analyze current file
    let analyzeFileCommand = vscode.commands.registerCommand('codeFlowVisualizer.analyzeCurrentFile', async () => {
        let editor = vscode.window.activeTextEditor;
        
        // If no active editor, let user pick a file
        if (!editor) {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
                return;
            }

            // Find all supported files
            const files = await vscode.workspace.findFiles(
                '**/*.{js,ts,py,java}', 
                '**/node_modules/**'
            );

            if (files.length === 0) {
                vscode.window.showInformationMessage('No supported files found. Try analyzing the entire workspace instead.');
                return;
            }

            // Show quick pick to select a file
            const fileItems = files.map(file => ({
                label: vscode.workspace.asRelativePath(file),
                description: file.fsPath,
                uri: file
            }));

            const selected = await vscode.window.showQuickPick(fileItems, {
                placeHolder: 'Select a file to analyze',
                matchOnDescription: true
            });

            if (!selected) {
                return; // User cancelled
            }

            // Open the selected file
            const document = await vscode.workspace.openTextDocument(selected.uri);
            editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
        }

        const document = editor.document;
        const analyzer = new CodeAnalyzer();
        const analysis = await analyzer.analyzeDocument(document);

        // Create or show visualizer
        if (!currentVisualizer) {
            currentVisualizer = new FlowVisualizer(context.extensionUri, context);
            currentVisualizer.onDidDispose(() => {
                currentVisualizer = undefined;
            });
        }

        currentVisualizer.updateVisualization(analysis);
        currentVisualizer.reveal();
    });

    // Register command to analyze entire workspace
    let analyzeWorkspaceCommand = vscode.commands.registerCommand('codeFlowVisualizer.analyzeWorkspace', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found!');
            return;
        }

        vscode.window.showInformationMessage('Analyzing workspace... This may take a moment.');

        const analyzer = new CodeAnalyzer();
        const files = await vscode.workspace.findFiles('**/*.{js,ts,py,java}', '**/node_modules/**');
        
        let allAnalysis: any[] = [];
        
        for (const file of files.slice(0, 50)) { // Limit to 50 files for performance
            const document = await vscode.workspace.openTextDocument(file);
            const analysis = await analyzer.analyzeDocument(document);
            allAnalysis.push(analysis);
        }

        // Merge all analyses
        const mergedAnalysis = analyzer.mergeAnalyses(allAnalysis);

        // Create or show visualizer
        if (!currentVisualizer) {
            currentVisualizer = new FlowVisualizer(context.extensionUri, context);
            currentVisualizer.onDidDispose(() => {
                currentVisualizer = undefined;
            });
        }

        currentVisualizer.updateVisualization(mergedAnalysis);
        currentVisualizer.reveal();
        vscode.window.showInformationMessage(`Analyzed ${files.length} files in workspace`);
    });

    // Auto-analyze on file save
    let saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
        if (currentVisualizer && document === vscode.window.activeTextEditor?.document) {
            const analyzer = new CodeAnalyzer();
            analyzer.analyzeDocument(document).then(analysis => {
                currentVisualizer?.updateVisualization(analysis);
            });
        }
    });

    context.subscriptions.push(resetWelcomeCommand, startCommand, analyzeFileCommand, analyzeWorkspaceCommand, saveListener);
}

export function deactivate() {
    if (currentVisualizer) {
        currentVisualizer.dispose();
    }
}