/**
 * Pure utility functions for smart label handling in the code flow visualizer
 * These can be safely used in both TypeScript extension code and webview JavaScript
 */

/**
 * Intelligently truncates a function name while preserving readability
 */
export function smartTruncate(name: string, maxLength: number = 20): string {
    if (name.length <= maxLength) {
        return name;
    }

    // Try to preserve meaningful parts
    // For camelCase/PascalCase
    if (/[a-z][A-Z]/.test(name)) {
        const parts = name.split(/(?=[A-Z])/);
        if (parts.length > 1) {
            // Keep first and last parts
            const first = parts[0];
            const last = parts[parts.length - 1];
            if ((first.length + last.length + 2) <= maxLength) {
                return `${first}…${last}`;
            }
        }
    }

    // For snake_case
    if (name.includes('_')) {
        const parts = name.split('_');
        if (parts.length > 1) {
            const first = parts[0];
            const last = parts[parts.length - 1];
            if ((first.length + last.length + 3) <= maxLength) {
                return `${first}_…_${last}`;
            }
        }
    }

    // Default: truncate from middle
    const halfLen = Math.floor((maxLength - 1) / 2);
    return name.substring(0, halfLen) + '…' + name.substring(name.length - halfLen);
}

/**
 * Split a long function name into multiple lines for better readability
 */
export function splitIntoLines(name: string, maxCharsPerLine: number = 15): string[] {
    if (name.length <= maxCharsPerLine) {
        return [name];
    }

    const lines: string[] = [];

    // Try to split on camelCase boundaries
    if (/[a-z][A-Z]/.test(name)) {
        const parts = name.split(/(?=[A-Z])/);
        let currentLine = '';
        
        for (const part of parts) {
            if ((currentLine + part).length <= maxCharsPerLine) {
                currentLine += part;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                }
                currentLine = part;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        // Limit to 2 lines
        if (lines.length <= 2) {
            return lines;
        }
    }

    // Try to split on underscore
    if (name.includes('_')) {
        const parts = name.split('_');
        let currentLine = '';
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const connector = i === 0 ? '' : '_';
            
            if ((currentLine + connector + part).length <= maxCharsPerLine) {
                currentLine += connector + part;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                }
                currentLine = part;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        // Limit to 2 lines
        if (lines.length <= 2) {
            return lines;
        }
    }

    // Fallback: split at maxCharsPerLine with smart truncation
    const firstLine = name.substring(0, maxCharsPerLine - 1);
    const secondLine = name.substring(maxCharsPerLine - 1);
    
    if (secondLine.length <= maxCharsPerLine) {
        return [firstLine, secondLine];
    } else {
        return [firstLine, smartTruncate(secondLine, maxCharsPerLine)];
    }
}

/**
 * Get optimal font size based on node complexity
 */
export function getOptimalFontSize(complexity: number, baseSize: number = 12): number {
    // Larger nodes (higher complexity) can have larger text
    return baseSize + Math.min(complexity * 0.5, 4);
}

/**
 * Calculate optimal node radius based on name length and complexity
 */
export function getOptimalNodeRadius(
    name: string,
    complexity: number,
    baseRadius: number = 25
): number {
    // Factor in both complexity and name length
    const complexityBonus = complexity * 2;
    const nameBonus = Math.min(name.length * 0.3, 10);
    
    return baseRadius + complexityBonus + nameBonus;
}

/**
 * Format function signature for display
 */
export function formatFunctionSignature(
    name: string,
    params: string[],
    maxLength: number = 40
): string {
    if (params.length === 0) {
        return `${name}()`;
    }

    const signature = `${name}(${params.join(', ')})`;
    
    if (signature.length <= maxLength) {
        return signature;
    }

    // Truncate parameters
    if (params.length > 2) {
        return `${name}(${params[0]}, … +${params.length - 1})`;
    }

    return smartTruncate(signature, maxLength);
}

/**
 * Get color based on complexity
 */
export function getComplexityColor(complexity: number): string {
    if (complexity < 3) return '#10b981'; // Green
    if (complexity < 7) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
}

/**
 * Get human-readable complexity level
 */
export function getComplexityLabel(complexity: number): string {
    if (complexity < 3) return 'Low';
    if (complexity < 7) return 'Medium';
    return 'High';
}

/**
 * Extract file name from full path
 */
export function extractFileName(filePath: string): string {
    return filePath.split(/[/\\]/).pop() || filePath;
}

/**
 * Smart file name truncation for display
 */
export function truncateFileName(fileName: string, maxLength: number = 28): string {
    if (fileName.length <= maxLength) {
        return fileName;
    }

    const parts = fileName.split('.');
    if (parts.length > 1) {
        const ext = parts.pop()!;
        const name = parts.join('.');
        
        if (ext.length < 6 && name.length > 15) {
            const truncatedName = name.substring(0, maxLength - ext.length - 4);
            return `${truncatedName}...${ext}`;
        }
    }

    return fileName.substring(0, maxLength - 3) + '...';
}