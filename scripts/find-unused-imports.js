#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Find unused type imports in JSDoc @import statements for Sveltia CMS.
 *
 * This script analyzes JavaScript/Svelte files with JSDoc @import statements
 * and identifies which imported types are actually used in the file.
 *
 * Usage: node scripts/find-unused-imports.js [--fix] [--verbose].
 *
 * Options:
 * --fix      Automatically remove unused type imports
 * --verbose  Show detailed output with file analysis summary.
 *
 * Examples:
 * node scripts/find-unused-imports.js           # Check for unused imports (clean output)
 * node scripts/find-unused-imports.js --verbose # Check with detailed information
 * node scripts/find-unused-imports.js --fix     # Remove unused imports automatically.
 */

import { readdir, readFile, stat, writeFile } from 'fs/promises';
import { extname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');
// Check command line flags
const shouldFix = process.argv.includes('--fix');
const isVerbose = process.argv.includes('--verbose');

/**
 * Parse @import statements from JSDoc comments.
 * @param {string} content File content.
 * @returns {Array<{types: string[], from: string, line: number, fullLine: string}>}
 * Import statements.
 */
function parseImportStatements(content) {
  const imports = [];
  // Use regex to find all @import statements including multi-line ones
  const importRegex = /^\s*\*?\s*@import\s*\{([^}]*(?:\n[^}]*)*)\}\s*from\s*['"`]([^'"`]+)['"`]/gm;
  let match = importRegex.exec(content);

  while (match !== null) {
    const typesStr = match[1];
    const fromModule = match[2];
    // Find the line number where this import starts
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    // Get the first line of the import for fullLine
    const lines = content.split('\n');
    const fullLine = lines[lineNumber - 1];

    // Parse individual types, handling whitespace and line breaks
    const types = typesStr
      .replace(/\n/g, ' ') // Replace newlines with spaces
      .split(',')
      .map((type) =>
        type
          .replace(/^\s*\*?\s*/, '')
          .replace(/\s*\*?\s*$/, '')
          .trim(),
      )
      .filter((type) => type.length > 0);

    imports.push({
      types,
      from: fromModule,
      line: lineNumber,
      fullLine,
    });

    match = importRegex.exec(content);
  }

  return imports;
}

/**
 * Find usage of imported types in the file content.
 * @param {string} content File content.
 * @param {string[]} types Types to search for.
 * @returns {object} Usage map with type name as key and usage count as value.
 */
function findTypeUsage(content, types) {
  const usage = {};

  // Initialize usage count for all types
  types.forEach((type) => {
    usage[type] = 0;
  });

  // Don’t remove @param, @returns, etc. as they contain the type usage we want to find
  const contentForAnalysis = content
    // Only remove @import lines to avoid counting imports as usage - fixed quote matching
    .replace(/^\s*\*?\s*@import\s*\{[^}]+\}\s*from\s*['"`][^'"`]+['"`];?$/gm, '');

  types.forEach((type) => {
    // Escape special regex characters in type names
    const escapedType = type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Look for type usage in various JSDoc contexts:
    const patterns = [
      // @type {TypeName} variations
      new RegExp(`@type\\s*\\{[^}]*\\b${escapedType}\\b[^}]*\\}`, 'gi'),

      // @param {TypeName} variations - including optional params and square brackets
      new RegExp(`@param\\s*\\{[^}]*\\b${escapedType}\\b[^}]*\\}\\s*\\[?[^\\]\\s]*\\]?`, 'gi'),

      // @returns {TypeName} variations
      new RegExp(`@returns?\\s*\\{[^}]*\\b${escapedType}\\b[^}]*\\}`, 'gi'),

      // @typedef {TypeName} variations
      new RegExp(`@typedef\\s*\\{[^}]*\\b${escapedType}\\b[^}]*\\}`, 'gi'),

      // @callback definitions
      new RegExp(`@callback\\s*\\{[^}]*\\b${escapedType}\\b[^}]*\\}`, 'gi'),

      // @property {TypeName} variations
      new RegExp(`@property\\s*\\{[^}]*\\b${escapedType}\\b[^}]*\\}`, 'gi'),

      // Generic type usage like Array<TypeName>, Promise<TypeName>
      new RegExp(`\\b\\w+<[^>]*\\b${escapedType}\\b[^>]*>`, 'gi'),

      // Union types like {TypeName | OtherType} or {OtherType | TypeName}
      new RegExp(`\\{[^}]*\\b${escapedType}\\b[^}]*\\|[^}]*\\}`, 'gi'),
      new RegExp(`\\{[^}]*\\|[^}]*\\b${escapedType}\\b[^}]*\\}`, 'gi'),

      // Array types like {TypeName[]} or TypeName[]
      new RegExp(`\\{[^}]*\\b${escapedType}\\b\\[\\][^}]*\\}`, 'gi'),
      new RegExp(`\\b${escapedType}\\[\\]`, 'gi'),

      // Optional types like {TypeName?}
      new RegExp(`\\{[^}]*\\b${escapedType}\\b\\?[^}]*\\}`, 'gi'),

      // Type casting /** @type {TypeName} */ (single and multi-line)
      new RegExp(`/\\*\\*[^*]*@type\\s*\\{[^}]*\\b${escapedType}\\b[^}]*\\}[^*]*\\*/`, 'gi'),

      // Function parameter types in JSDoc
      new RegExp(`\\([^)]*\\b${escapedType}\\b[^)]*\\)\\s*=>`, 'gi'),

      // Record/Object type patterns like Record<string, TypeName>
      new RegExp(`Record<[^,>]*,\\s*\\b${escapedType}\\b[^>]*>`, 'gi'),
      new RegExp(`Record<[^>]*\\b${escapedType}\\b[^>]*,`, 'gi'),

      // Type augmentation like @augments {TypeName}
      new RegExp(`@augments\\s*\\{[^}]*\\b${escapedType}\\b[^}]*\\}`, 'gi'),
      new RegExp(`@extends\\s*\\{[^}]*\\b${escapedType}\\b[^}]*\\}`, 'gi'),

      // Type implementations like @implements {TypeName}
      new RegExp(`@implements\\s*\\{[^}]*\\b${escapedType}\\b[^}]*\\}`, 'gi'),

      // Direct type references in JSDoc comments (including dot notation like JSX.Element)
      new RegExp(`\\b${escapedType}(?:\\.[a-zA-Z_$][a-zA-Z0-9_$]*)+\\b`, 'gi'),

      // Type usage in union types with pipe separator (handle spacing variations)
      new RegExp(`\\b${escapedType}\\s*\\|`, 'gi'),
      new RegExp(`\\|\\s*\\b${escapedType}\\b`, 'gi'),

      // Intersection types with &
      new RegExp(`\\b${escapedType}\\s*&`, 'gi'),
      new RegExp(`&\\s*\\b${escapedType}\\b`, 'gi'),
    ];

    patterns.forEach((pattern) => {
      const matches = contentForAnalysis.match(pattern);

      if (matches) {
        usage[type] += matches.length;
      }
    });
  });

  return usage;
}

/**
 * Remove unused imports from @import statement.
 * @param {string} content File content.
 * @param {object} analysisResult Analysis result for the file.
 * @returns {string} Updated content with unused imports removed.
 */
function removeUnusedImports(content, analysisResult) {
  let updatedContent = content;
  // Process imports in reverse order to maintain accuracy
  const reversedImports = [...analysisResult.imports].reverse();

  reversedImports.forEach((importInfo) => {
    if (importInfo.usedTypes.length === 0) {
      // Remove the entire import statement if no types are used
      const importRegex = new RegExp(
        `^\\s*\\*?\\s*@import\\s*\\{[^}]*(?:\\n[^}]*)*\\}\\s*from\\s*['"\`]${importInfo.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]\\s*;?`,
        'gm',
      );

      updatedContent = updatedContent.replace(importRegex, '');
    } else if (importInfo.unusedTypes.length > 0) {
      // Remove only unused types from the import
      const escapedFrom = importInfo.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const importRegex = new RegExp(
        // eslint-disable-next-line max-len
        `^(\\s*\\*?\\s*@import\\s*\\{)([^}]*(?:\\n[^}]*)*)(\\}\\s*from\\s*['"\`]${escapedFrom}['"\`]\\s*;?)`,
        'gm',
      );

      updatedContent = updatedContent.replace(importRegex, (match, start, typesSection, end) => {
        // Parse all types from the types section
        const allTypes = typesSection
          .split(',')
          .map((type) => type.replace(/^\s*\*?\s*/, '').trim())
          .filter((type) => type.length > 0);

        // Keep only the used types
        const usedTypes = allTypes.filter((type) => importInfo.usedTypes.includes(type));

        if (usedTypes.length === 0) {
          return ''; // Remove entire import if no types are used
        }

        // Format the used types
        if (usedTypes.length === 1) {
          // Single type on one line
          return `${start} ${usedTypes[0]} ${end}`;
        }

        // Multiple types, format as multi-line
        const formattedTypes = usedTypes
          .map((type, index) => {
            if (index === 0) {
              return `\n * ${type},`;
            }

            return ` * ${type},`;
          })
          .join('\n');

        return `${start}${formattedTypes}\n * ${end}`;
      });
    }
  });

  return updatedContent;
}

/**
 * Check if file should be analyzed.
 * @param {string} filePath File path.
 * @returns {boolean} True if file should be analyzed.
 */
function shouldAnalyzeFile(filePath) {
  const ext = extname(filePath);

  return ext === '.js' || ext === '.svelte';
}

/**
 * Recursively find all JavaScript and Svelte files.
 * @param {string} dir Directory to search.
 * @param {string[]} files Accumulator for file paths.
 * @returns {Promise<string[]>} Array of file paths.
 */
async function findFiles(dir, files = []) {
  const entries = await readdir(dir);

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        // Skip node_modules and other non-source directories
        if (!['node_modules', '.git', 'dist', 'build', 'package'].includes(entry)) {
          await findFiles(fullPath, files);
        }
      } else if (shouldAnalyzeFile(fullPath)) {
        files.push(fullPath);
      }
    }),
  );

  return files;
}

/**
 * Analyze a single file for unused imports.
 * @param {string} filePath Path to the file.
 * @returns {Promise<object|null>} Analysis result or null if no imports found.
 */
async function analyzeFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    const imports = parseImportStatements(content);

    if (imports.length === 0) {
      return null;
    }

    const results = [];

    imports.forEach((importStatement) => {
      const usage = findTypeUsage(content, importStatement.types);
      const unusedTypes = importStatement.types.filter((type) => usage[type] === 0);
      const usedTypes = importStatement.types.filter((type) => usage[type] > 0);

      if (unusedTypes.length > 0) {
        results.push({
          line: importStatement.line,
          from: importStatement.from,
          unusedTypes,
          usedTypes,
          totalTypes: importStatement.types.length,
          usage,
        });
      }
    });

    return results.length > 0
      ? {
          filePath: relative(projectRoot, filePath),
          fullPath: filePath,
          imports: results,
        }
      : null;
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Main function to analyze all files.
 */
async function main() {
  if (isVerbose) {
    console.log(
      `🔍 Finding unused type imports in JSDoc @import statements...${shouldFix ? ' (fixing enabled)' : ''}\n`,
    );
  }

  const srcDir = join(projectRoot, 'src');

  if (isVerbose) {
    console.log(`Project root: ${projectRoot}`);
    console.log(`Source directory: ${srcDir}`);
  }

  const files = await findFiles(srcDir);

  if (isVerbose) {
    console.log(`Found ${files.length} files to analyze\n`);
  }

  const results = [];
  let filesWithImports = 0;
  let totalUnusedImports = 0;
  const analysisResults = await Promise.all(files.map((file) => analyzeFile(file)));

  analysisResults.forEach((result) => {
    if (result) {
      results.push(result);
      filesWithImports += 1;
      totalUnusedImports += result.imports.reduce((sum, imp) => sum + imp.unusedTypes.length, 0);
    }
  });

  // Sort results by number of unused imports (descending)
  results.sort((a, b) => {
    const aUnused = a.imports.reduce((sum, imp) => sum + imp.unusedTypes.length, 0);
    const bUnused = b.imports.reduce((sum, imp) => sum + imp.unusedTypes.length, 0);

    return bUnused - aUnused;
  });

  // Print results
  if (results.length === 0) {
    if (isVerbose) {
      console.log('✅ No unused type imports found!');
    }

    return;
  }

  if (isVerbose) {
    console.log(`Found ${totalUnusedImports} unused type imports in ${results.length} files:\n`);
  }

  // Fix files if --fix flag is provided
  if (shouldFix) {
    if (isVerbose) {
      console.log('🔧 Removing unused imports...\n');
    }

    const fixPromises = results.map(async (result) => {
      try {
        const content = await readFile(result.fullPath, 'utf-8');
        const updatedContent = removeUnusedImports(content, result);

        await writeFile(result.fullPath, updatedContent, 'utf-8');
        console.log(`✅ Fixed: ${result.filePath}`);
      } catch (error) {
        console.error(`❌ Error fixing ${result.filePath}:`, error.message);
      }
    });

    await Promise.all(fixPromises);

    console.log(`\n🎉 Fixed ${results.length} files!`);
  } else if (isVerbose) {
    // Detailed output for verbose mode
    results.forEach((result) => {
      const unusedCount = result.imports.reduce((sum, imp) => sum + imp.unusedTypes.length, 0);

      console.log(`📁 ${result.filePath} (${unusedCount} unused)`);

      result.imports.forEach((imp) => {
        console.log(`   Line ${imp.line}: from '${imp.from}'`);

        if (imp.unusedTypes.length > 0) {
          console.log(`   ❌ Unused: ${imp.unusedTypes.join(', ')}`);
        }

        if (imp.usedTypes.length > 0) {
          console.log(`   ✅ Used: ${imp.usedTypes.join(', ')}`);
        }

        console.log();
      });
    });
  } else {
    // Clean output for default mode - just list files and unused types
    results.forEach((result) => {
      const allUnusedTypes = result.imports.flatMap((imp) => imp.unusedTypes);

      console.log(`${result.filePath}: ${allUnusedTypes.join(', ')}`);
    });
  }

  // Summary
  if (isVerbose) {
    console.log('\n📊 Summary:');
    console.log(`- Files analyzed: ${files.length}`);
    console.log(`- Files with @import statements: ${filesWithImports}`);
    console.log(`- Files with unused imports: ${results.length}`);
    console.log(`- Total unused type imports: ${totalUnusedImports}`);
  }

  if (!shouldFix) {
    if (isVerbose) {
      console.log('\n💡 Suggestions:');
      console.log('1. Run with --fix flag to automatically remove unused imports');
      console.log('2. Consider using ESLint rules for automatic detection');
      console.log('3. Review the changes before committing');
    } else {
      console.log('\nRun with --fix to remove unused imports, or --verbose for details.');
    }

    // Exit with error code when unused imports are found (unless fixing)
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
