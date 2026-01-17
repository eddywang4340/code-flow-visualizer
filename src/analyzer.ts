import * as vscode from 'vscode';

export interface FunctionNode {
    name: string;
    displayName: string; // Add this - clean name for display
    startLine: number;
    endLine: number;
    calls: string[];
    calledBy: string[];
    params: string[];
    complexity: number;
    fileName?: string; // Added for clustering
}

export interface CodeAnalysis {
    fileName: string;
    language: string;
    functions: Map<string, FunctionNode>;
    imports: string[];
    exports: string[];
}

export class CodeAnalyzer {
    
    async analyzeDocument(document: vscode.TextDocument): Promise<CodeAnalysis> {
        const language = document.languageId;
        const text = document.getText();
        const fileName = document.fileName;

        const analysis: CodeAnalysis = {
            fileName,
            language,
            functions: new Map(),
            imports: [],
            exports: []
        };

        switch (language) {
            case 'javascript':
            case 'typescript':
                this.analyzeJavaScript(text, analysis);
                break;
            case 'python':
                this.analyzePython(text, analysis);
                break;
            case 'java':
                this.analyzeJava(text, analysis);
                break;
            default:
                this.analyzeGeneric(text, analysis);
        }

        return analysis;
    }

    private analyzeJavaScript(text: string, analysis: CodeAnalysis): void {
        const lines = text.split('\n');
        
        // Find imports
        const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(text)) !== null) {
            analysis.imports.push(match[1]);
        }

        // Find exports
        const exportRegex = /export\s+(function|class|const|let|var)\s+(\w+)/g;
        while ((match = exportRegex.exec(text)) !== null) {
            analysis.exports.push(match[2]);
        }

        // Find functions
        const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(\w+)\s*:\s*(?:async\s*)?\([^)]*\)\s*=>)/g;
        
        while ((match = functionRegex.exec(text)) !== null) {
            const functionName = match[1] || match[2] || match[3];
            if (!functionName) continue;

            const startIndex = match.index;
            const startLine = text.substring(0, startIndex).split('\n').length - 1;
            
            // Find function end (simplified - looks for closing brace)
            let braceCount = 0;
            let foundStart = false;
            let endLine = startLine;
            
            for (let i = startLine; i < lines.length; i++) {
                const line = lines[i];
                for (const char of line) {
                    if (char === '{') {
                        braceCount++;
                        foundStart = true;
                    } else if (char === '}') {
                        braceCount--;
                        if (foundStart && braceCount === 0) {
                            endLine = i;
                            break;
                        }
                    }
                }
                if (foundStart && braceCount === 0) break;
            }

            // Extract function body
            const functionBody = lines.slice(startLine, endLine + 1).join('\n');
            
            // Find function calls within this function
            const callRegex = /(\w+)\s*\(/g;
            const calls: string[] = [];
            let callMatch;
            while ((callMatch = callRegex.exec(functionBody)) !== null) {
                const calledFunction = callMatch[1];
                if (calledFunction !== functionName && 
                    !['if', 'for', 'while', 'switch', 'catch'].includes(calledFunction)) {
                    calls.push(calledFunction);
                }
            }

            // Calculate basic complexity (number of decision points)
            const complexity = (functionBody.match(/\b(if|for|while|case|catch|&&|\|\|)\b/g) || []).length;

            // Extract parameters
            const paramMatch = text.substring(startIndex).match(/\(([^)]*)\)/);
            const params = paramMatch ? paramMatch[1].split(',').map(p => p.trim()).filter(p => p) : [];

            analysis.functions.set(functionName, {
                name: functionName,
                displayName: functionName, // Add this line
                startLine,
                endLine,
                calls: [...new Set(calls)],
                calledBy: [],
                params,
                complexity,
                fileName: analysis.fileName
            });
        }

        // Build calledBy relationships
        for (const [funcName, funcNode] of analysis.functions) {
            for (const calledFunc of funcNode.calls) {
                const targetFunc = [...analysis.functions.values()]
                    .find(f => f.name === calledFunc);

                if (targetFunc) {
                    targetFunc.calledBy.push(funcName);
                }
            }
        }
    }

    private analyzePython(text: string, analysis: CodeAnalysis): void {
        const lines = text.split('\n');
        
        // Find imports
        const importRegex = /(?:from\s+(\S+)\s+)?import\s+(.+)/g;
        let match;
        while ((match = importRegex.exec(text)) !== null) {
            analysis.imports.push(match[1] || match[2]);
        }

        // Find functions
        const functionRegex = /def\s+(\w+)\s*\(([^)]*)\)/g;
        
        while ((match = functionRegex.exec(text)) !== null) {
            const functionName = match[1];
            const params = match[2].split(',').map(p => p.trim()).filter(p => p);
            
            const startIndex = match.index;
            const startLine = text.substring(0, startIndex).split('\n').length - 1;
            
            // Find function end (based on indentation)
            let endLine = startLine;
            const baseIndent = lines[startLine].search(/\S/);
            
            for (let i = startLine + 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line === '') continue;
                
                const currentIndent = lines[i].search(/\S/);
                if (currentIndent <= baseIndent && line !== '') {
                    endLine = i - 1;
                    break;
                }
                endLine = i;
            }

            const functionBody = lines.slice(startLine, endLine + 1).join('\n');
            
            // Find function calls
            const callRegex = /(\w+)\s*\(/g;
            const calls: string[] = [];
            let callMatch;
            while ((callMatch = callRegex.exec(functionBody)) !== null) {
                const calledFunction = callMatch[1];
                if (calledFunction !== functionName && 
                    !['if', 'for', 'while', 'print', 'len', 'range'].includes(calledFunction)) {
                    calls.push(calledFunction);
                }
            }

            const complexity = (functionBody.match(/\b(if|for|while|elif|except|and|or)\b/g) || []).length;

            analysis.functions.set(functionName, {
                name: functionName,
                displayName: functionName, // Add this line
                startLine,
                endLine,
                calls: [...new Set(calls)],
                calledBy: [],
                params,
                complexity,
                fileName: analysis.fileName
            });
        }

        // Build calledBy relationships
        for (const [funcName, funcNode] of analysis.functions) {
            for (const calledFunc of funcNode.calls) {
                const targetFunc = [...analysis.functions.values()]
                    .find(f => f.name === calledFunc);

                if (targetFunc) {
                    targetFunc.calledBy.push(funcName);
                }
            }
        }
    }

    private analyzeJava(text: string, analysis: CodeAnalysis): void {
        const lines = text.split('\n');
        
        // Find imports
        const importRegex = /import\s+([^;]+);/g;
        let match;
        while ((match = importRegex.exec(text)) !== null) {
            analysis.imports.push(match[1]);
        }

        // Find methods
        const methodRegex = /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(([^)]*)\)/g;
        
        while ((match = methodRegex.exec(text)) !== null) {
            const methodName = match[1];
            if (['if', 'for', 'while', 'switch', 'catch'].includes(methodName)) continue;
            
            const params = match[2].split(',').map(p => p.trim()).filter(p => p);
            const startIndex = match.index;
            const startLine = text.substring(0, startIndex).split('\n').length - 1;
            
            // Find method end
            let braceCount = 0;
            let foundStart = false;
            let endLine = startLine;
            
            for (let i = startLine; i < lines.length; i++) {
                const line = lines[i];
                for (const char of line) {
                    if (char === '{') {
                        braceCount++;
                        foundStart = true;
                    } else if (char === '}') {
                        braceCount--;
                        if (foundStart && braceCount === 0) {
                            endLine = i;
                            break;
                        }
                    }
                }
                if (foundStart && braceCount === 0) break;
            }

            const methodBody = lines.slice(startLine, endLine + 1).join('\n');
            
            const callRegex = /(\w+)\s*\(/g;
            const calls: string[] = [];
            let callMatch;
            while ((callMatch = callRegex.exec(methodBody)) !== null) {
                const calledMethod = callMatch[1];
                if (calledMethod !== methodName && 
                    !['if', 'for', 'while', 'switch', 'catch'].includes(calledMethod)) {
                    calls.push(calledMethod);
                }
            }

            const complexity = (methodBody.match(/\b(if|for|while|case|catch|&&|\|\|)\b/g) || []).length;

            analysis.functions.set(methodName, {
                name: methodName,
                displayName: methodName, // Add this line
                startLine,
                endLine,
                calls: [...new Set(calls)],
                calledBy: [],
                params,
                complexity,
                fileName: analysis.fileName
            });
        }

        // Build calledBy relationships
        for (const [funcName, funcNode] of analysis.functions) {
            for (const calledFunc of funcNode.calls) {
                const targetFunc = [...analysis.functions.values()]
                    .find(f => f.name === calledFunc);

                if (targetFunc) {
                    targetFunc.calledBy.push(funcName);
                }
            }
        }
    }

    private analyzeGeneric(text: string, analysis: CodeAnalysis): void {
        // Basic pattern matching for unknown languages
        const functionRegex = /function\s+(\w+)|def\s+(\w+)|(\w+)\s*\([^)]*\)\s*{/g;
        let match;
        
        while ((match = functionRegex.exec(text)) !== null) {
            const functionName = match[1] || match[2] || match[3];
            if (!functionName) continue;
            
            const startLine = text.substring(0, match.index).split('\n').length - 1;
            
            analysis.functions.set(functionName, {
                name: functionName,
                displayName: functionName, // Add this line
                startLine,
                endLine: startLine + 10, // Estimate
                calls: [],
                calledBy: [],
                params: [],
                complexity: 0,
                fileName: analysis.fileName // Store the file name
            });
        }
    }
    mergeAnalyses(analyses: CodeAnalysis[]): CodeAnalysis {
        const merged: CodeAnalysis = {
            fileName: 'Workspace Analysis',
            language: 'multiple',
            functions: new Map(),
            imports: [],
            exports: []
        };

        // First pass: add all functions with unique keys
        for (const analysis of analyses) {
            const fileLabel = analysis.fileName.split('/').pop() || analysis.fileName;
            
            for (const [name, func] of analysis.functions) {
                const uniqueKey = `${name}::${fileLabel}`;
                
                merged.functions.set(uniqueKey, { 
                    ...func,
                    name: uniqueKey,  // Unique identifier
                    displayName: name, // Original function name for display
                    fileName: analysis.fileName
                });
            }

            // Merge imports and exports
            merged.imports.push(...analysis.imports);
            merged.exports.push(...analysis.exports);
        }

        // Second pass: update call relationships to use unique keys
        for (const analysis of analyses) {
            const fileLabel = analysis.fileName.split('/').pop() || analysis.fileName;
            
            for (const [name, func] of analysis.functions) {
                const uniqueKey = `${name}::${fileLabel}`;
                const mergedFunc = merged.functions.get(uniqueKey);
                
                if (mergedFunc) {
                    // Update calls to use unique keys
                    mergedFunc.calls = func.calls.map(calledName => {
                        // First try to find in same file
                        const sameFileKey = `${calledName}::${fileLabel}`;
                        if (merged.functions.has(sameFileKey)) {
                            return sameFileKey;
                        }
                        
                        // Otherwise find any function with this base name
                        for (const [key] of merged.functions) {
                            if (key.startsWith(calledName + '::')) {
                                return key;
                            }
                        }
                        
                        // If not found, return original (might be external)
                        return calledName;
                    });
                    
                    mergedFunc.calledBy = [];
                }
            }
        }

        // Third pass: rebuild calledBy relationships
        for (const [funcKey, func] of merged.functions) {
            for (const calledKey of func.calls) {
                const calledFunc = merged.functions.get(calledKey);
                if (calledFunc && !calledFunc.calledBy.includes(funcKey)) {
                    calledFunc.calledBy.push(funcKey);
                }
            }
        }

        return merged;
    }
}