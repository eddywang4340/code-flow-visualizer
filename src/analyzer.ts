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
    complexity: string;
    fileName?: string;
    code?: string;
    significance?: number; // 0-100, higher = more important
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

    private readonly complexityNodeTypes = new Set([
        'if_statement', 'for_statement', 'while_statement', 'do_statement',
        'switch_case', 'case_statement', 'catch_clause',
        'conditional_expression',
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

        this.buildCalledByRelationships(analysis);
        this.calculateSignificance(analysis); // NEW: Calculate significance scores

        console.log(`Found ${analysis.functions.size} functions`);
        console.log('=== Analysis complete ===\n');

        return analysis;
    }

    private calculateSignificance(analysis: CodeAnalysis): void {
        const functions = Array.from(analysis.functions.values());
        
        if (functions.length === 0) return;

        functions.forEach(func => {
            let score = 50; // Base score

            // ENTRY POINTS (not called by anyone) = MOST SIGNIFICANT
            if (func.calledBy.length === 0) {
                score += 40;
            }

            // HUB FUNCTIONS (called by many) = SIGNIFICANT
            // More callers = more important coordination point
            if (func.calledBy.length > 0) {
                score += Math.min(func.calledBy.length * 8, 30);
            }

            // CALLS MANY FUNCTIONS = COORDINATOR (moderately significant)
            if (func.calls.length > 3) {
                score += Math.min(func.calls.length * 2, 10);
            }

            // HELPER FUNCTIONS (high fanin, simple) = LESS SIGNIFICANT
            // Called by many but simple = utility function
            if (func.calledBy.length > 3) {
                score -= 20;
            }

            // DEEP IN CALL CHAIN = LESS SIGNIFICANT
            // Calculate depth (simple version: functions only calling others that also get called)
            if (func.calls.length > 0 && func.calledBy.length > 0) {
                const calleesAlsoCalled = func.calls.filter(calledName => {
                    const calledFunc = functions.find(f => f.name === calledName);
                    return calledFunc && calledFunc.calledBy.length > 0;
                }).length;
                
                if (calleesAlsoCalled > 2) {
                    score -= 15; // Deep in the middle of call chain
                }
            }

            // EXPORTED FUNCTIONS = MORE SIGNIFICANT
            if (analysis.exports.includes(func.name)) {
                score += 20;
            }

            // Clamp to 0-100
            func.significance = Math.max(0, Math.min(100, score));
        });

        console.log('Significance scores calculated');
    }

    private analyzeJavaScript(tree: Parser.Tree, analysis: CodeAnalysis): void {
        const traverse = (node: Parser.SyntaxNode) => {
            if (node.type === 'import_statement') {
                const source = node.childForFieldName('source');
                if (source) {
                    analysis.imports.push(source.text.replace(/['"]/g, ''));
                }
            }

            if (node.type === 'export_statement') {
                const declaration = node.childForFieldName('declaration');
                if (declaration) {
                    const nameNode = declaration.childForFieldName('name');
                    if (nameNode) {
                        analysis.exports.push(nameNode.text);
                    }
                }
            }

            if (node.type === 'function_declaration' || node.type === 'generator_function_declaration') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    this.processJavaScriptFunction(nameNode.text, node, analysis);
                }
            }

            if (node.type === 'method_definition') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    this.processJavaScriptFunction(nameNode.text, node, analysis);
                }
            }

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

            for (const child of node.children) {
                traverse(child);
            }
        };

        traverse(tree.rootNode);
    }

    private processJavaScriptFunction(name: string, node: Parser.SyntaxNode, analysis: CodeAnalysis): void {
        const startLine = node.startPosition.row;
        const endLine = node.endPosition.row;

        const params: string[] = [];
        const paramsNode = node.childForFieldName('parameters');
        if (paramsNode) this.extractParameters(paramsNode, params);

        const calls = new Set<string>();
        let complexity = "";

        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
            this.analyzeFunctionBody(bodyNode, name, calls, c => complexity = c, false);
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
            fileName: analysis.fileName,
            code: node.text,
            significance: 50 // Default, will be calculated later
        });
    }

    private analyzePython(tree: Parser.Tree, analysis: CodeAnalysis): void {
        const traverse = (node: Parser.SyntaxNode) => {
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

            if (node.type === 'function_definition') {
                const nameNode = node.childForFieldName('name');
                if (nameNode) {
                    this.processPythonFunction(nameNode.text, node, analysis);
                }
            }

            for (const child of node.children) {
                traverse(child);
            }
        };

        traverse(tree.rootNode);
    }

    private processPythonFunction(name: string, node: Parser.SyntaxNode, analysis: CodeAnalysis): void {
        const startLine = node.startPosition.row;
        const endLine = node.endPosition.row;

        const params: string[] = [];
        const paramsNode = node.childForFieldName('parameters');
        if (paramsNode) this.extractParameters(paramsNode, params);

        const calls = new Set<string>();
        let complexity = "";

        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
            this.analyzeFunctionBody(bodyNode, name, calls, c => complexity = c, true);
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
            fileName: analysis.fileName,
            code: node.text,
            significance: 50
        });
    }

    private analyzeJava(tree: Parser.Tree, analysis: CodeAnalysis): void {
        const traverse = (node: Parser.SyntaxNode) => {
            if (node.type === 'import_declaration') {
                analysis.imports.push(node.text.replace('import', '').replace(';', '').trim());
            }

            if (node.type === 'method_declaration' || node.type === 'constructor_declaration') {
                const nameNode = node.childForFieldName('name');
                if (nameNode && !this.isJavaKeyword(nameNode.text)) {
                    this.processJavaMethod(nameNode.text, node, analysis);
                }
            }

            for (const child of node.children) {
                traverse(child);
            }
        };

        traverse(tree.rootNode);
    }

    private processJavaMethod(name: string, node: Parser.SyntaxNode, analysis: CodeAnalysis): void {
        const startLine = node.startPosition.row;
        const endLine = node.endPosition.row;

        const params: string[] = [];
        const paramsNode = node.childForFieldName('parameters');
        if (paramsNode) this.extractParameters(paramsNode, params);

        const calls = new Set<string>();
        let complexity = "";

        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
            this.analyzeFunctionBody(bodyNode, name, calls, c => complexity = c, false);
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
            fileName: analysis.fileName,
            code: node.text,
            significance: 50
        });
    }

    private extractParameters(paramsNode: Parser.SyntaxNode, params: string[]): void {
        const extractRecursive = (node: Parser.SyntaxNode) => {
            if (node.type === 'identifier') {
                if (!params.includes(node.text)) {
                    params.push(node.text);
                }
                return;
            }
            
            if (node.type === 'property_identifier') {
                if (!params.includes(node.text)) {
                    params.push(node.text);
                }
                return;
            }
            
            if (node.type === 'typed_parameter' || node.type === 'required_parameter' || node.type === 'optional_parameter') {
                const nameChild = node.childForFieldName('name') || node.childForFieldName('pattern');
                if (nameChild && nameChild.type === 'identifier' && !params.includes(nameChild.text)) {
                    params.push(nameChild.text);
                }
                return;
            }
            
            if (node.type === 'formal_parameter') {
                const nameChild = node.childForFieldName('name');
                if (nameChild && !params.includes(nameChild.text)) {
                    params.push(nameChild.text);
                }
                return;
            }

            if (node.type === 'parameter' || node.type === 'typed_parameter' || node.type === 'typed_default_parameter') {
                const nameChild = node.childForFieldName('name');
                if (nameChild && !params.includes(nameChild.text)) {
                    params.push(nameChild.text);
                }
                return;
            }
            
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
        setComplexity: (c: string) => void,
        isPython: boolean = false
    ): void {
        let complexity = "";
        const pythonKeywords = ['if', 'for', 'while'];
        const jsKeywords = ['if', 'for', 'while', 'switch', 'catch'];

        const traverse = (node: Parser.SyntaxNode) => {
            if (node.type === 'call_expression' || node.type === 'call' || node.type === 'method_invocation') {
                let calleeName = '';

                const funcNode = node.childForFieldName('function');
                const nameNode = node.childForFieldName('name');

                if (funcNode) {
                    if (funcNode.type === 'member_expression' || funcNode.type === 'attribute') {
                        const propertyNode = funcNode.childForFieldName('property') || funcNode.childForFieldName('attribute');
                        calleeName = propertyNode?.text || '';
                    } else if (funcNode.type === 'identifier') {
                        calleeName = funcNode.text;
                    } else {
                        calleeName = funcNode.text;
                    }
                } else if (nameNode) {
                    calleeName = nameNode.text;
                }

                if (calleeName && 
                    calleeName !== functionName && 
                    !(isPython ? pythonKeywords : jsKeywords).includes(calleeName)) {
                    calls.add(calleeName);
                }
            }

            for (const child of node.children) {
                traverse(child);
            }
        };

        traverse(bodyNode);
        setComplexity(complexity);
    }

    private buildCalledByRelationships(analysis: CodeAnalysis): void {
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
                complexity: "",
                fileName: analysis.fileName,
                code: text,
                significance: 50
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

        for (const analysis of analyses) {
            const fileLabel = analysis.fileName.split('/').pop() || analysis.fileName;

            for (const [name, func] of analysis.functions) {
                const uniqueKey = `${name}::${fileLabel}`;

                merged.functions.set(uniqueKey, {
                    ...func,
                    name: uniqueKey,  
                    displayName: name, 
                    fileName: analysis.fileName
                });
            }

            merged.imports.push(...analysis.imports);
            merged.exports.push(...analysis.exports);
        }

        for (const analysis of analyses) {
            const fileLabel = analysis.fileName.split('/').pop() || analysis.fileName;

            for (const [name, func] of analysis.functions) {
                const uniqueKey = `${name}::${fileLabel}`;
                const mergedFunc = merged.functions.get(uniqueKey);

                if (mergedFunc) {
                    mergedFunc.calls = func.calls.map(calledName => {
                        const sameFileKey = `${calledName}::${fileLabel}`;
                        if (merged.functions.has(sameFileKey)) {
                            return sameFileKey;
                        }

                        for (const [key] of merged.functions) {
                            if (key.startsWith(calledName + '::')) {
                                return key;
                            }
                        }

                        return calledName;
                    });

                    mergedFunc.calledBy = [];
                }
            }
        }

        for (const [funcKey, func] of merged.functions) {
            for (const calledKey of func.calls) {
                const calledFunc = merged.functions.get(calledKey);
                if (calledFunc && !calledFunc.calledBy.includes(funcKey)) {
                    calledFunc.calledBy.push(funcKey);
                }
            }
        }

        // Recalculate significance for merged workspace
        this.calculateSignificance(merged);

        return merged;
    }
}