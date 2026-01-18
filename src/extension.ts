import * as vscode from 'vscode';
import { CodeAnalyzer } from './analyzer';
import { FlowVisualizer } from './visualizer-refactored';
    
let currentVisualizer: FlowVisualizer | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Flow Visualizer is now active!');

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
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found!');
            return;
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

    context.subscriptions.push(startCommand, analyzeFileCommand, analyzeWorkspaceCommand, saveListener);
}

export function deactivate() {
    if (currentVisualizer) {
        currentVisualizer.dispose();
    }
}