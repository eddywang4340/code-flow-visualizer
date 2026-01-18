import * as vscode from 'vscode';
// specific import syntax for C++ native modules in TS often requires 'require' or specific config
import Parser = require('tree-sitter'); 
import JavaScript = require('tree-sitter-javascript');
import Python = require('tree-sitter-python');
import Java = require('tree-sitter-java');

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

    // Cache parsers to avoid re-instantiation
    private jsParser: Parser;
    private pyParser: Parser;
    private javaParser: Parser;

    constructor() {
        this.jsParser = new Parser();
        this.jsParser.setLanguage(JavaScript as any);

        this.pyParser = new Parser();
        this.pyParser.setLanguage(Python as any);

        this.javaParser = new Parser();
        this.javaParser.setLanguage(Java as any);
    }
    
    /**
     * Complexity node types to count for Cyclomatic Complexity.
     */
    private readonly complexityNodeTypes = new Set([
        'if_statement', 'for_statement', 'while_statement', 'do_statement',
        'switch_case', 'case_statement', 'catch_clause', 
        'binary_expression', // for && and ||
        'conditional_expression', // ternary
        'elif_clause', 'except_clause', 'for_in_statement'
    ]);

    async analyzeDocument(document: vscode.TextDocument): Promise<CodeAnalysis> {
        const language = document.languageId;
        const fileName = document.fileName;
        const text = document.getText();

        const analysis: CodeAnalysis = {
            fileName,
            language,
            functions: new Map(),
            imports: [],
            exports: []
        };

        try {
            let tree: Parser.Tree | undefined;

            switch (language) {
                case 'javascript':
                case 'typescript':
                case 'typescriptreact': // basic JS parsing usually works for simple TS/React structures
                case 'javascriptreact':
                    tree = this.jsParser.parse(text);
                    this.analyzeJsTsTree(tree, analysis);
                    break;
                case 'python':
                    tree = this.pyParser.parse(text);
                    this.analyzePythonTree(tree, analysis);
                    break;
                case 'java':
                    tree = this.javaParser.parse(text);
                    this.analyzeJavaTree(tree, analysis);
                    break;
                default:
                    this.analyzeGeneric(text, analysis);
            }

            // Note: Native tree-sitter trees don't always need manual deletion like WASM, 
            // but it's good practice if the API exposes it. The Node GC usually handles it.

        } catch (e) {
            console.error('Tree-sitter analysis failed, falling back to regex:', e);
            this.analyzeGeneric(text, analysis);
        }

        // Post-processing: Build calledBy relationships
        this.buildReverseDependencies(analysis);

        return analysis;
    }

    // =========================================================================
    // Language Specific Analyzers
    // =========================================================================

    private analyzeJsTsTree(tree: Parser.Tree, analysis: CodeAnalysis): void {
        const traverseRoot = (node: Parser.SyntaxNode) => {
            // Imports
            if (node.type === 'import_statement') {
                const source = node.childForFieldName('source');
                if (source) analysis.imports.push(source.text.replace(/['"]/g, ''));
            } 
            // Exports
            else if (node.type === 'export_statement') {
                analysis.exports.push('export'); 
            }
            
            // Function Detection
            let funcName = '';
            let funcNode = node;
            let isFunction = false;

            if (node.type === 'function_declaration' || node.type === 'generator_function') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    funcName = nameNode.text;
                    isFunction = true;
                }
            }
            else if (node.type === 'method_definition') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    funcName = nameNode.text;
                    isFunction = true;
                }
            }
            else if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
                for (const child of node.children) {
                    if (child.type === 'variable_declarator') {
                        const name = child.childForFieldName('name');
                        const value = child.childForFieldName('value');
                        if (name && value && (value.type === 'arrow_function' || value.type === 'function_expression')) {
                            funcName = name.text;
                            funcNode = value; 
                            isFunction = true;
                        }
                    }
                }
            }

            if (isFunction && funcName) {
                this.processFunctionNode(funcName, funcNode, analysis);
            }

            // Recurse
            // If we found a function, we processed its body in processFunctionNode.
            // However, we might have nested functions, so we should continue traversal 
            // unless processFunctionNode handled the recursion logic (it doesn't recursively find definitions).
            // NOTE: The simple traversal here might re-visit children. 
            // For efficiency, you might skip traversing into funcNode if you don't want nested functions.
            // But usually, we DO want nested functions.
            for (const child of node.children) {
                traverseRoot(child);
            }
        };

        traverseRoot(tree.rootNode);
    }

    private analyzePythonTree(tree: Parser.Tree, analysis: CodeAnalysis): void {
        const traverse = (node: Parser.SyntaxNode) => {
            if (node.type === 'import_statement') {
                analysis.imports.push(node.text);
            } else if (node.type === 'import_from_statement') {
                const module = node.childForFieldName('module_name');
                if (module) analysis.imports.push(module.text);
            }

            if (node.type === 'function_definition') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    this.processFunctionNode(nameNode.text, node, analysis);
                }
            }

            for (const child of node.children) traverse(child);
        };

        traverse(tree.rootNode);
    }

    private analyzeJavaTree(tree: Parser.Tree, analysis: CodeAnalysis): void {
        const traverse = (node: Parser.SyntaxNode) => {
            if (node.type === 'import_declaration') {
                analysis.imports.push(node.text.replace('import', '').replace(';', '').trim());
            }

            if (node.type === 'method_declaration' || node.type === 'constructor_declaration') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    this.processFunctionNode(nameNode.text, node, analysis);
                }
            }

            for (const child of node.children) traverse(child);
        };

        traverse(tree.rootNode);
    }

    // =========================================================================
    // Core Logic (Node Processing)
    // =========================================================================

    private processFunctionNode(name: string, node: Parser.SyntaxNode, analysis: CodeAnalysis) {
        const startLine = node.startPosition.row;
        const endLine = node.endPosition.row;

        // Parameters
        const params: string[] = [];
        const paramNode = node.childForFieldName('parameters');
        if (paramNode) {
            const extractParams = (pNode: Parser.SyntaxNode) => {
                if (pNode.type === 'identifier' || pNode.type === 'property_identifier') {
                    params.push(pNode.text);
                }
                for (const child of pNode.children) extractParams(child);
            };
            extractParams(paramNode);
        }

        // Body Analysis
        const calls = new Set<string>();
        let complexity = 1;

        const bodyNode = node.childForFieldName('body');
        
        if (bodyNode) {
            const traverseBody = (n: Parser.SyntaxNode) => {
                // Complexity
                if (this.complexityNodeTypes.has(n.type)) {
                    if (n.type === 'binary_expression') {
                        if (['&&', '||', 'and', 'or'].includes(n.children[1]?.text)) {
                            complexity++;
                        }
                    } else {
                        complexity++;
                    }
                }

                // Function Calls
                if (n.type === 'call_expression' || n.type === 'method_invocation') {
                    let calleeName = '';
                    
                    const funcChild = n.childForFieldName('function'); // JS/Py
                    const nameChild = n.childForFieldName('name'); // Java

                    if (funcChild) {
                        if (funcChild.type === 'member_expression' || funcChild.type === 'attribute') {
                            // obj.method -> method
                             calleeName = funcChild.lastChild?.text || funcChild.text;
                        } else {
                             calleeName = funcChild.text;
                        }
                    } else if (nameChild) {
                        calleeName = nameChild.text;
                    }

                    if (calleeName && calleeName !== name) {
                        calls.add(calleeName);
                    }
                }

                for (const child of n.children) traverseBody(child);
            };

            traverseBody(bodyNode);
        }

        analysis.functions.set(name, {
            name,
            startLine,
            endLine,
            calls: Array.from(calls).filter(c => !this.isKeyword(c)),
            calledBy: [],
            params,
            complexity,
            fileName: analysis.fileName
        });
    }

    private isKeyword(name: string): boolean {
        const commonKeywords = ['if', 'for', 'while', 'switch', 'catch', 'print', 'console.log', 'super'];
        return commonKeywords.some(k => name.includes(k));
    }

    private buildReverseDependencies(analysis: CodeAnalysis) {
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
        // Fallback regex implementation
        /*
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
                endLine: startLine + 10,
                calls: [],
                calledBy: [],
                params: [],
                complexity: 1,
                fileName: analysis.fileName
            });
        }*/
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
            for (const [name, func] of analysis.functions) {
                // Ensure unique names across files for the visualizer
                const uniqueName = `${name} (${analysis.fileName.split(/[\\/]/).pop()})`;
                merged.functions.set(uniqueName, { 
                    ...func, 
                    name: uniqueName,
                    fileName: analysis.fileName 
                });
            }
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