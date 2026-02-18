import * as vscode from 'vscode';
import * as fs from 'fs';
import { validateConfig, ValidationIssue } from './schemaValidator';
import { safeParseJson } from '../utils/json';

const DIAGNOSTIC_SOURCE = 'Claude Code Config';

export class ConfigDiagnostics implements vscode.Disposable {
  private readonly diagnosticCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('claudeCodeConfig');
  }

  /**
   * Validate a single config file and update its diagnostics.
   */
  validateFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      const uri = vscode.Uri.file(filePath);
      this.diagnosticCollection.delete(uri);
      return;
    }

    let sourceText: string;
    try {
      sourceText = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return;
    }

    const parsed = safeParseJson<Record<string, unknown>>(sourceText);
    const uri = vscode.Uri.file(filePath);

    if (parsed.error) {
      // JSON parse error
      this.diagnosticCollection.set(uri, [
        new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 0),
          `Invalid JSON: ${parsed.error}`,
          vscode.DiagnosticSeverity.Error,
        ),
      ]);
      return;
    }

    if (!parsed.data) {
      this.diagnosticCollection.delete(uri);
      return;
    }

    const issues = validateConfig(parsed.data, sourceText);
    const diagnostics = issues.map((issue) => this.toDiagnostic(issue));

    this.diagnosticCollection.set(uri, diagnostics);
  }

  /**
   * Validate multiple config files at once.
   */
  validateFiles(filePaths: string[]): void {
    for (const fp of filePaths) {
      this.validateFile(fp);
    }
  }

  /**
   * Clear diagnostics for a specific file.
   */
  clearFile(filePath: string): void {
    this.diagnosticCollection.delete(vscode.Uri.file(filePath));
  }

  /**
   * Clear all diagnostics.
   */
  clearAll(): void {
    this.diagnosticCollection.clear();
  }

  dispose(): void {
    this.diagnosticCollection.dispose();
  }

  private toDiagnostic(issue: ValidationIssue): vscode.Diagnostic {
    const line = issue.line ?? 0;
    const range = new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
    const severity =
      issue.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;

    const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
    diagnostic.source = DIAGNOSTIC_SOURCE;
    return diagnostic;
  }
}
