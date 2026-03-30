import type { OnMount } from "@monaco-editor/react";

type EditorInstance = Parameters<OnMount>[0];

let editorInstance: EditorInstance | null = null;

export function setEditorInstance(instance: EditorInstance | null) {
  editorInstance = instance;
}

export function getSelectedText(): string {
  if (!editorInstance) return "";
  const selection = editorInstance.getSelection();
  if (!selection || selection.isEmpty()) return "";
  return editorInstance.getModel()?.getValueInRange(selection) ?? "";
}
