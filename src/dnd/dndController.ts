import * as vscode from 'vscode';
import { ConfigStore } from '../config/configModel';
import { ConfigTreeNode } from '../tree/nodes/baseNode';
import { ConfigScope, SectionType } from '../types';
import { SCOPE_LABELS, MESSAGES } from '../constants';
import { moveItemToScope } from '../commands/moveCommands';

const TREE_MIME = 'application/vnd.code.tree.claudeconfigtree';

// Node types that can be dragged
const DRAGGABLE_TYPES = new Set([
  'permissionRule', 'envVar', 'mcpServer', 'plugin', 'setting', 'sandboxProperty',
]);

// Mapping from nodeType to the SectionType they belong to
const NODE_TYPE_TO_SECTION: Record<string, SectionType> = {
  permissionRule: SectionType.Permissions,
  envVar: SectionType.Environment,
  mcpServer: SectionType.McpServers,
  plugin: SectionType.Plugins,
  setting: SectionType.Settings,
  sandboxProperty: SectionType.Sandbox,
};

export class ConfigDragAndDropController implements vscode.TreeDragAndDropController<ConfigTreeNode> {
  readonly dropMimeTypes = [TREE_MIME];
  readonly dragMimeTypes = [TREE_MIME];

  constructor(private readonly configStore: ConfigStore) {}

  handleDrag(source: readonly ConfigTreeNode[], dataTransfer: vscode.DataTransfer): void {
    // Only allow dragging supported node types
    const draggable = source.filter((n) => DRAGGABLE_TYPES.has(n.nodeType));
    if (draggable.length === 0) return;
    // Store the first draggable item (single-item drag)
    dataTransfer.set(TREE_MIME, new vscode.DataTransferItem(draggable[0]));
  }

  async handleDrop(
    target: ConfigTreeNode | undefined,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    if (!target) return;

    const item = dataTransfer.get(TREE_MIME);
    if (!item) return;

    const sourceNode = item.value as ConfigTreeNode;
    if (!sourceNode?.nodeContext) return;

    const sourceScope = sourceNode.nodeContext.scope;

    // Determine target scope from drop target
    const targetInfo = this.resolveDropTarget(target, sourceNode);
    if (!targetInfo) return; // silently reject invalid drops

    const { targetScope } = targetInfo;

    // Same scope — no-op
    if (targetScope === sourceScope) return;

    // Check lock/read-only on target
    const key = sourceNode.nodeContext.workspaceFolderUri ?? this.configStore.getWorkspaceFolderKeys()[0];
    const allScopes = this.configStore.getAllScopes(key);
    const targetSc = allScopes.find((s) => s.scope === targetScope);
    if (!targetSc) return;

    if (targetSc.isReadOnly || targetScope === ConfigScope.Managed) {
      vscode.window.showWarningMessage(
        `Cannot drop onto ${SCOPE_LABELS[targetScope]}: scope is read-only.`,
      );
      return;
    }

    if (this.configStore.isScopeLocked(targetScope)) {
      vscode.window.showWarningMessage(
        `Cannot drop onto ${SCOPE_LABELS[targetScope]}: scope is locked.`,
      );
      return;
    }

    // Check source is not read-only (cannot move FROM read-only)
    if (sourceNode.nodeContext.isReadOnly && sourceScope !== ConfigScope.User) {
      vscode.window.showWarningMessage(MESSAGES.readOnlyMove);
      return;
    }

    if (!targetSc.filePath) {
      vscode.window.showWarningMessage(MESSAGES.noTargetFileMove);
      return;
    }

    // For move, source must not be locked
    if (this.configStore.isScopeLocked(sourceScope)) {
      vscode.window.showWarningMessage(
        `Cannot move from ${SCOPE_LABELS[sourceScope]}: scope is locked.`,
      );
      return;
    }

    await moveItemToScope(this.configStore, sourceNode, targetSc);
  }

  /**
   * Resolves the drop target to a target scope.
   * Returns null if the drop target is invalid (wrong entity type, not a scope/section).
   */
  private resolveDropTarget(
    target: ConfigTreeNode,
    sourceNode: ConfigTreeNode,
  ): { targetScope: ConfigScope } | null {
    const targetCtx = target.nodeContext;

    // Drop on ScopeNode — any entity type accepted
    if (target.nodeType === 'scope') {
      return { targetScope: targetCtx.scope };
    }

    // Drop on SectionNode — must match entity type
    if (target.nodeType.startsWith('section.')) {
      const sourceSection = NODE_TYPE_TO_SECTION[sourceNode.nodeType];
      if (!sourceSection) return null;

      const targetSection = targetCtx.section;
      if (targetSection !== sourceSection) return null;

      return { targetScope: targetCtx.scope };
    }

    // Drop on a leaf node — treat as dropping onto its scope, but only if types match
    if (DRAGGABLE_TYPES.has(target.nodeType)) {
      const sourceSection = NODE_TYPE_TO_SECTION[sourceNode.nodeType];
      const targetSection = NODE_TYPE_TO_SECTION[target.nodeType];
      if (!sourceSection || sourceSection !== targetSection) return null;

      return { targetScope: targetCtx.scope };
    }

    // Drop on any other node type (e.g., permission group) — resolve to scope if types match
    if (targetCtx.section) {
      const sourceSection = NODE_TYPE_TO_SECTION[sourceNode.nodeType];
      if (sourceSection && sourceSection === targetCtx.section) {
        return { targetScope: targetCtx.scope };
      }
    }

    return null;
  }
}
