/**
 * Dead Code Detection Utility
 * Helps identify unused code patterns for cleanup
 */

export interface DeadCodeReport {
  unusedImports: string[];
  unusedFunctions: string[];
  redundantCode: string[];
  suggestions: string[];
}

export class DeadCodeCleaner {
  private static instance: DeadCodeCleaner;

  static getInstance(): DeadCodeCleaner {
    if (!DeadCodeCleaner.instance) {
      DeadCodeCleaner.instance = new DeadCodeCleaner();
    }
    return DeadCodeCleaner.instance;
  }

  /**
   * Remove excessive console statements while preserving important ones
   */
  cleanConsoleStatements(code: string): { cleaned: string; removed: number } {
    const lines = code.split('\n');
    const importantPatterns = [
      /console\.error.*[Ee]rror/,
      /console\.warn.*[Ww]arn/,
      /console\.error.*❌/,
      /console\.warn.*⚠️/,
      /console\.log.*✅/,
      /console\.log.*🚀/
    ];

    let removed = 0;
    const cleaned = lines
      .map(line => {
        // Skip if it's an important console statement
        if (importantPatterns.some(pattern => pattern.test(line))) {
          return line;
        }

        // Remove debug console statements
        if (line.includes('console.log') || 
            line.includes('console.debug') ||
            (line.includes('console.warn') && !line.includes('❌') && !line.includes('⚠️'))) {
          removed++;
          return null;
        }

        return line;
      })
      .filter(line => line !== null)
      .join('\n');

    return { cleaned, removed };
  }

  /**
   * Identify duplicate localStorage patterns
   */
  identifyDuplicateStoragePatterns(code: string): string[] {
    const patterns = [
      /localStorage\.getItem\(['"`]([^'"`]+)['"`]\)/g,
      /localStorage\.setItem\(['"`]([^'"`]+)['"`]/g,
      /JSON\.parse\(localStorage\.getItem/g,
      /localStorage\.setItem.*JSON\.stringify/g
    ];

    const duplicates: string[] = [];
    
    patterns.forEach(pattern => {
      const matches = Array.from(code.matchAll(pattern));
      if (matches.length > 5) { // More than 5 occurrences might indicate duplication
        duplicates.push(`Pattern "${pattern.source}" found ${matches.length} times`);
      }
    });

    return duplicates;
  }

  /**
   * Find unused imports (basic detection)
   */
  findUnusedImports(code: string): string[] {
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
    const imports = Array.from(code.matchAll(importRegex));
    const unused: string[] = [];

    imports.forEach(match => {
      const fullImport = match[0];
      const namedImports = fullImport.match(/\{\s*([^}]+)\s*\}/);
      
      if (namedImports) {
        const names = namedImports[1].split(',').map(n => n.trim());
        names.forEach(name => {
          // Simple check: if name appears only in import, it might be unused
          const namePattern = new RegExp(`\\b${name}\\b`, 'g');
          const occurrences = Array.from(code.matchAll(namePattern));
          
          if (occurrences.length === 1) { // Only in import statement
            unused.push(`${name} from ${match[1]}`);
          }
        });
      }
    });

    return unused;
  }

  /**
   * Generate cleanup suggestions
   */
  generateSuggestions(codeFiles: Array<{ path: string; content: string }>): DeadCodeReport {
    const report: DeadCodeReport = {
      unusedImports: [],
      unusedFunctions: [],
      redundantCode: [],
      suggestions: []
    };

    codeFiles.forEach(({ path, content }) => {
      // Check for excessive console statements
      const consoleMatches = content.match(/console\.(log|debug|info)/g);
      if (consoleMatches && consoleMatches.length > 10) {
        report.suggestions.push(`${path}: Has ${consoleMatches.length} console statements - consider cleanup`);
      }

      // Check for direct localStorage usage
      const localStorageMatches = content.match(/localStorage\.(get|set|remove)Item/g);
      if (localStorageMatches && localStorageMatches.length > 3) {
        report.suggestions.push(`${path}: Has ${localStorageMatches.length} direct localStorage calls - migrate to storage utility`);
      }

      // Check for large files
      const lineCount = content.split('\n').length;
      if (lineCount > 500) {
        report.suggestions.push(`${path}: ${lineCount} lines - consider breaking into smaller modules`);
      }

      // Find duplicated patterns
      const duplicates = this.identifyDuplicateStoragePatterns(content);
      if (duplicates.length > 0) {
        report.redundantCode.push(`${path}: ${duplicates.join(', ')}`);
      }
    });

    return report;
  }

  /**
   * Auto-fix common patterns
   */
  autoFixPatterns(code: string): { fixed: string; changes: string[] } {
    let fixed = code;
    const changes: string[] = [];

    // Replace direct localStorage calls with storage utility calls
    const storageReplacements = [
      {
        pattern: /localStorage\.getItem\((['"`][^'"`]+['"`])\)/g,
        replacement: 'storage.load($1, null)',
        description: 'Replaced localStorage.getItem with storage.load'
      },
      {
        pattern: /localStorage\.setItem\((['"`][^'"`]+['"`]),\s*JSON\.stringify\(([^)]+)\)\)/g,
        replacement: 'storage.save($1, $2)',
        description: 'Replaced localStorage.setItem + JSON.stringify with storage.save'
      },
      {
        pattern: /JSON\.parse\(localStorage\.getItem\((['"`][^'"`]+['"`])\)\s*\|\|\s*(['"`\[\{][^'"`\[\}]*['"`\]\}])\)/g,
        replacement: 'storage.load($1, $2)',
        description: 'Replaced JSON.parse + localStorage.getItem with storage.load'
      }
    ];

    storageReplacements.forEach(({ pattern, replacement, description }) => {
      const matches = Array.from(fixed.matchAll(pattern));
      if (matches.length > 0) {
        fixed = fixed.replace(pattern, replacement);
        changes.push(`${description} (${matches.length} occurrences)`);
      }
    });

    return { fixed, changes };
  }
}

// Export singleton instance
export const deadCodeCleaner = DeadCodeCleaner.getInstance();