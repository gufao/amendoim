import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useRef, useEffect } from "react";
import { useEditorQuery } from "../../hooks/useQuery";
import { useT } from "../../i18n";
import { setEditorInstance } from "../../lib/editor";

export function SqlEditor() {
  const t = useT();
  const { activeTab, updateSql, executeActiveQuery } = useEditorQuery();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  // Resize editor when parent size changes (replaces automaticLayout polling)
  useEffect(() => {
    if (!editorRef.current) return;
    const observer = new ResizeObserver(() => {
      editorRef.current?.layout();
    });
    const container = editorRef.current.getContainerDomNode().parentElement;
    if (container) observer.observe(container);
    return () => observer.disconnect();
  }, [activeTab?.id]);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    setEditorInstance(editor);

    monaco.editor.defineTheme("amendoim-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "d4aa80", fontStyle: "bold" },
        { token: "string.sql", foreground: "7ec699" },
        { token: "string", foreground: "7ec699" },
        { token: "number", foreground: "e0b44a" },
        { token: "comment", foreground: "4a433b", fontStyle: "italic" },
        { token: "operator", foreground: "b0a698" },
        { token: "predefined", foreground: "8bb5cf" },
        { token: "type", foreground: "8bb5cf" },
      ],
      colors: {
        "editor.background": "#1a1714",
        "editor.foreground": "#f5f0eb",
        "editor.lineHighlightBackground": "#211e1a80",
        "editor.lineHighlightBorder": "#00000000",
        "editor.selectionBackground": "#c2956a30",
        "editor.inactiveSelectionBackground": "#c2956a15",
        "editorCursor.foreground": "#d4aa80",
        "editorGutter.background": "#1a1714",
        "editorLineNumber.foreground": "#4a433b",
        "editorLineNumber.activeForeground": "#6d6459",
        "editorIndentGuide.background": "#2e292440",
        "editorWhitespace.foreground": "#2e292430",
        "editor.rangeHighlightBackground": "#c2956a08",
        "editorBracketMatch.background": "#c2956a20",
        "editorBracketMatch.border": "#c2956a40",
        "scrollbar.shadow": "#00000000",
        "editorOverviewRuler.border": "#00000000",
        "editorWidget.background": "#282420",
        "editorWidget.border": "#2e2924",
        "editorSuggestWidget.background": "#282420",
        "editorSuggestWidget.border": "#2e2924",
        "editorSuggestWidget.selectedBackground": "#36312b",
        "list.hoverBackground": "#2e2a25",
      },
    });
    monaco.editor.setTheme("amendoim-dark");

    editor.addAction({
      id: "execute-query",
      label: "Execute Query",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => executeActiveQuery(),
    });

    editor.updateOptions({
      fontSize: 13,
      lineHeight: 20,
      fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
      fontLigatures: true,
      minimap: { enabled: false },
      lineNumbers: "on",
      renderLineHighlight: "line",
      scrollBeyondLastLine: false,
      padding: { top: 12, bottom: 12 },
      tabSize: 2,
      wordWrap: "on",
      suggestOnTriggerCharacters: true,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: {
        vertical: "auto",
        horizontal: "auto",
        verticalScrollbarSize: 7,
        horizontalScrollbarSize: 7,
        useShadows: false,
      },
      guides: {
        indentation: true,
        bracketPairs: false,
      },
      bracketPairColorization: { enabled: false },
      renderWhitespace: "none",
      cursorBlinking: "blink",
      cursorSmoothCaretAnimation: "off",
      smoothScrolling: false,
    });

    editor.focus();
  }, [executeActiveQuery]);

  if (!activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary text-text-faint text-xs">
        {t("editor.empty")}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0">
      <Editor
        height="100%"
        language="sql"
        theme="amendoim-dark"
        value={activeTab.sql}
        onChange={(value) => updateSql(activeTab.id, value || "")}
        onMount={handleMount}
        loading={
          <div className="flex items-center justify-center h-full bg-bg-secondary text-text-faint text-xs">
            <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        }
      />
    </div>
  );
}
