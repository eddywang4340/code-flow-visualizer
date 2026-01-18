import * as vscode from 'vscode';
import Parser = require('tree-sitter');
import JavaScript = require('tree-sitter-javascript');
import Python = require('tree-sitter-python');
import Java = require('tree-sitter-java');

export interface FunctionNode {
    name: string;
    displayName: string;
    startLine: number;
    endLine: number;
    calls: string[];
    calledBy: string[];
    params: string[];
    complexity: number;
    fileName?: string;
}

export interface CodeAnalysis {
    fileName: string;
    language: string;
    functions: Map<string, FunctionNode>;
    imports: string[];
    exports: string[];
}

export class CodeAnalyzer {
    private jsParser: Parser;
    private pyParser: Parser;
    private javaParser: Parser;

    // Complexity-related node types for cyclomatic complexity calculation
    private readonly complexityNodeTypes = new Set([
        'if_statement', 'for_statement', 'while_statement', 'do_statement',
        'switch_case', 'case_statement', 'catch_clause',
        'conditional_expression', // ternary
        'elif_clause', 'except_clause', 'for_in_statement'
    ]);

    constructor() {
        this.jsParser = new Parser();
        this.jsParser.setLanguage(JavaScript as any);

        this.pyParser = new Parser();
        this.pyParser.setLanguage(Python as any);

        this.javaParser = new Parser();
        this.javaParser.setLanguage(Java as any);
    }

    async analyzeDocument(document: vscode.TextDocument): Promise<CodeAnalysis> {
        const language = document.languageId;
        const fileName = document.fileName;
        const text = document.getText();

        console.log(`\n=== Analyzing ${fileName} (${language}) ===`);

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
                case 'typescriptreact':
                case 'javascriptreact':
                    console.log('Using JavaScript parser');
                    tree = this.jsParser.parse(text);
                    this.analyzeJavaScript(tree, analysis);
                    break;
                case 'python':
                    console.log('Using Python parser');
                    tree = this.pyParser.parse(text);
                    this.analyzePython(tree, analysis);
                    break;
                case 'java':
                    console.log('Using Java parser');
                    tree = this.javaParser.parse(text);
                    this.analyzeJava(tree, analysis);
                    break;
                default:
                    console.log('Using generic fallback parser');
                    this.analyzeGeneric(text, analysis);
            }
        } catch (e) {
            console.error('Tree-sitter analysis failed, falling back to generic:', e);
            this.analyzeGeneric(text, analysis);
        }

        // Build calledBy relationships (same as regex version)
        this.buildCalledByRelationships(analysis);

        console.log(`Found ${analysis.functions.size} functions`);
        console.log('=== Analysis complete ===\n');

        return analysis;
    }

    private analyzeJavaScript(tree: Parser.Tree, analysis: CodeAnalysis): void {
        const traverse = (node: Parser.SyntaxNode) => {
            // Extract imports
            if (node.type === 'import_statement') {
                const source = node.childForFieldName('source');
                if (source) {
                    analysis.imports.push(source.text.replace(/['"]/g, ''));
                }
            }

            // Extract exports
            if (node.type === 'export_statement') {
                const declaration = node.childForFieldName('declaration');
                if (declaration) {
                    const nameNode = declaration.childForFieldName('name');
                    if (nameNode) {
                        analysis.exports.push(nameNode.text);
                    }
                }
            }

            // Function declarations
            if (node.type === 'function_declaration' || node.type === 'generator_function_declaration') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    this.processJavaScriptFunction(nameNode.text, node, analysis);
                }
            }

            // Method definitions (in classes)
            if (node.type === 'method_definition') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    this.processJavaScriptFunction(nameNode.text, node, analysis);
                }
            }

            // Arrow functions and function expressions assigned to variables
            if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
                for (const child of node.children) {
                    if (child.type === 'variable_declarator') {
                        const nameNode = child.childForFieldName('name');
                        const valueNode = child.childForFieldName('value');
                        
                        if (nameNode && valueNode && 
                            (valueNode.type === 'arrow_function' || 
                             valueNode.type === 'function_expression' ||
                             valueNode.type === 'generator_function')) {
                            this.processJavaScriptFunction(nameNode.text, valueNode, analysis);
                        }
                    }
                }
            }

            // Recurse through children
            for (const child of node.children) {
                traverse(child);
            }
        };

        traverse(tree.rootNode);
    }

    private processJavaScriptFunction(name: string, node: Parser.SyntaxNode, analysis: CodeAnalysis): void {
        const startLine = node.startPosition.row;
        const endLine = node.endPosition.row;

        // Extract parameters
        const params: string[] = [];
        const paramsNode = node.childForFieldName('parameters');
        if (paramsNode) {
            this.extractParameters(paramsNode, params);
        }

        // Extract function calls and calculate complexity
        const calls = new Set<string>();
        let complexity = 0;

        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
            this.analyzeFunctionBody(bodyNode, name, calls, (c) => { complexity = c; });
        }

        console.log(`[JS] Function: ${name}, Calls: [${Array.from(calls).join(', ')}], Complexity: ${complexity}`);

        analysis.functions.set(name, {
            name,
            displayName: name,
            startLine,
            endLine,
            calls: Array.from(calls),
            calledBy: [],
            params,
            complexity,
            fileName: analysis.fileName
        });
    }

    private analyzePython(tree: Parser.Tree, analysis: CodeAnalysis): void {
        const traverse = (node: Parser.SyntaxNode) => {
            // Extract imports
            if (node.type === 'import_statement' || node.type === 'import_from_statement') {
                if (node.type === 'import_from_statement') {
                    const moduleNode = node.childForFieldName('module_name');
                    if (moduleNode) {
                        analysis.imports.push(moduleNode.text);
                    }
                } else {
                    analysis.imports.push(node.text.replace('import', '').trim());
                }
            }

            // Function definitions
            if (node.type === 'function_definition') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    this.processPythonFunction(nameNode.text, node, analysis);
                }
            }

            // Recurse through children
            for (const child of node.children) {
                traverse(child);
            }
        };

        traverse(tree.rootNode);
    }

    private processPythonFunction(name: string, node: Parser.SyntaxNode, analysis: CodeAnalysis): void {
        const startLine = node.startPosition.row;
        const endLine = node.endPosition.row;

        // Extract parameters
        const params: string[] = [];
        const paramsNode = node.childForFieldName('parameters');
        if (paramsNode) {
            this.extractParameters(paramsNode, params);
        }

        // Extract function calls and calculate complexity
        const calls = new Set<string>();
        let complexity = 0;

        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
            this.analyzeFunctionBody(bodyNode, name, calls, (c) => { complexity = c; }, true);
        }

        console.log(`[PY] Function: ${name}, Calls: [${Array.from(calls).join(', ')}], Complexity: ${complexity}`);

        analysis.functions.set(name, {
            name,
            displayName: name,
            startLine,
            endLine,
            calls: Array.from(calls),
            calledBy: [],
            params,
            complexity,
            fileName: analysis.fileName
        });
    }

    private analyzeJava(tree: Parser.Tree, analysis: CodeAnalysis): void {
        const traverse = (node: Parser.SyntaxNode) => {
            // Extract imports
            if (node.type === 'import_declaration') {
                analysis.imports.push(node.text.replace('import', '').replace(';', '').trim());
            }

            // Method declarations
            if (node.type === 'method_declaration' || node.type === 'constructor_declaration') {
                const nameNode = node.childForFieldName('name');
                if (nameNode && !this.isJavaKeyword(nameNode.text)) {
                    this.processJavaMethod(nameNode.text, node, analysis);
                }
            }

            // Recurse through children
            for (const child of node.children) {
                traverse(child);
            }
        };

        traverse(tree.rootNode);
    }

    private processJavaMethod(name: string, node: Parser.SyntaxNode, analysis: CodeAnalysis): void {
        const startLine = node.startPosition.row;
        const endLine = node.endPosition.row;

        // Extract parameters
        const params: string[] = [];
        const paramsNode = node.childForFieldName('parameters');
        if (paramsNode) {
            this.extractParameters(paramsNode, params);
        }

        // Extract method calls and calculate complexity
        const calls = new Set<string>();
        let complexity = 0;

        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
            this.analyzeFunctionBody(bodyNode, name, calls, (c) => { complexity = c; });
        }

        analysis.functions.set(name, {
            name,
            displayName: name,
            startLine,
            endLine,
            calls: Array.from(calls),
            calledBy: [],
            params,
            complexity,
            fileName: analysis.fileName
        });
    }

    private extractParameters(paramsNode: Parser.SyntaxNode, params: string[]): void {
        const extractRecursive = (node: Parser.SyntaxNode) => {
            // Handle different parameter node types
            if (node.type === 'identifier') {
                if (!params.includes(node.text)) {
                    params.push(node.text);
                }
                return; // Don't recurse into identifiers
            }
            
            if (node.type === 'property_identifier') {
                if (!params.includes(node.text)) {
                    params.push(node.text);
                }
                return;
            }
            
            // TypeScript/Java typed parameters
            if (node.type === 'typed_parameter' || node.type === 'required_parameter' || node.type === 'optional_parameter') {
                const nameChild = node.childForFieldName('name') || node.childForFieldName('pattern');
                if (nameChild && nameChild.type === 'identifier' && !params.includes(nameChild.text)) {
                    params.push(nameChild.text);
                }
                return;
            }
            
            // Java formal parameters
            if (node.type === 'formal_parameter') {
                const nameChild = node.childForFieldName('name');
                if (nameChild && !params.includes(nameChild.text)) {
                    params.push(nameChild.text);
                }
                return;
            }

            // Python parameters
            if (node.type === 'parameter' || node.type === 'typed_parameter' || node.type === 'typed_default_parameter') {
                const nameChild = node.childForFieldName('name');
                if (nameChild && !params.includes(nameChild.text)) {
                    params.push(nameChild.text);
                }
                return;
            }
            
            // Recurse for other node types
            for (const child of node.children) {
                extractRecursive(child);
            }
        };

        extractRecursive(paramsNode);
    }

    private analyzeFunctionBody(
        bodyNode: Parser.SyntaxNode,
        functionName: string,
        calls: Set<string>,
        setComplexity: (c: number) => void,
        isPython: boolean = false
    ): void {
        let complexity = 0;
        // More minimal builtin lists - only filter obvious keywords
        const pythonKeywords = ['if', 'for', 'while'];
        const jsKeywords = ['if', 'for', 'while', 'switch', 'catch'];

        const traverse = (node: Parser.SyntaxNode) => {
            // Calculate complexity
            if (this.complexityNodeTypes.has(node.type)) {
                complexity++;
            }

            // Check for logical operators (&&, ||, and, or)
            if (node.type === 'binary_expression') {
                const operator = node.children[1]?.text;
                if (['&&', '||', 'and', 'or'].includes(operator)) {
                    complexity++;
                }
            }

            // Extract function/method calls
            // Python uses 'call', JavaScript uses 'call_expression', Java uses 'method_invocation'
            if (node.type === 'call_expression' || node.type === 'call' || node.type === 'method_invocation') {
                let calleeName = '';

                const funcNode = node.childForFieldName('function');
                const nameNode = node.childForFieldName('name');

                if (funcNode) {
                    // Handle member expressions (obj.method) or attribute access (obj.method in Python)
                    if (funcNode.type === 'member_expression' || funcNode.type === 'attribute') {
                        const propertyNode = funcNode.childForFieldName('property') || funcNode.childForFieldName('attribute');
                        calleeName = propertyNode?.text || '';
                    } else if (funcNode.type === 'identifier') {
                        calleeName = funcNode.text;
                    } else {
                        // Fallback - just get the text
                        calleeName = funcNode.text;
                    }
                } else if (nameNode) {
                    calleeName = nameNode.text;
                }

                // Filter out current function and keywords only
                if (calleeName && 
                    calleeName !== functionName && 
                    !(isPython ? pythonKeywords : jsKeywords).includes(calleeName)) {
                    calls.add(calleeName);
                }
            }

            // Recurse through children
            for (const child of node.children) {
                traverse(child);
            }
        };

        traverse(bodyNode);
        setComplexity(complexity);
    }

    private buildCalledByRelationships(analysis: CodeAnalysis): void {
        // Convert to array to avoid issues with iterating while modifying
        const allFunctions = Array.from(analysis.functions.values());
        
        console.log(`Building relationships for ${allFunctions.length} functions`);
        
        for (const func of allFunctions) {
            for (const calledName of func.calls) {
                const targetFunc = allFunctions.find(f => f.name === calledName);
                if (targetFunc && !targetFunc.calledBy.includes(func.name)) {
                    targetFunc.calledBy.push(func.name);
                    console.log(`  ${func.name} -> ${calledName}`);
                }
            }
        }
        
        console.log('Relationship building complete');
    }

    private isJavaKeyword(name: string): boolean {
        const keywords = ['if', 'for', 'while', 'switch', 'catch'];
        return keywords.includes(name);
    }

    private analyzeGeneric(text: string, analysis: CodeAnalysis): void {
        // Fallback for unsupported languages - minimal implementation
        const functionRegex = /function\s+(\w+)|def\s+(\w+)|(\w+)\s*\([^)]*\)\s*{/g;
        let match;

        while ((match = functionRegex.exec(text)) !== null) {
            const functionName = match[1] || match[2] || match[3];
            if (!functionName) continue;

            const startLine = text.substring(0, match.index).split('\n').length - 1;

            analysis.functions.set(functionName, {
                name: functionName,
                displayName: functionName,
                startLine,
                endLine: startLine + 10,
                calls: [],
                calledBy: [],
                params: [],
                complexity: 0,
                fileName: analysis.fileName
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