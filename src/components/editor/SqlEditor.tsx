import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useRef, useEffect } from "react";
import { Play, Square } from "lucide-react";
import { useEditorQuery } from "../../hooks/useQuery";
import { useT } from "../../i18n";
import { setEditorInstance } from "../../lib/editor";

export function SqlEditor() {
  const t = useT();
  const { activeQueryId, sql, isExecuting, updateSql, executeActiveQuery } = useEditorQuery();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    const observer = new ResizeObserver(() => {
      editorRef.current?.layout();
    });
    const container = editorRef.current.getContainerDomNode().parentElement;
    if (container) observer.observe(container);
    return () => observer.disconnect();
  }, [activeQueryId]);

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

  if (!activeQueryId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary text-text-faint text-xs">
        {t("editor.empty")}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Run / Stop button bar */}
      <div className="flex items-center justify-end gap-2 px-4 py-2 bg-bg-secondary border-b border-border shrink-0">
        <span className="text-[10px] text-text-faint">{"\u2318"}Enter</span>
        {isExecuting ? (
          <button
            onClick={executeActiveQuery}
            className="flex items-center gap-1.5 pl-3 pr-3.5 py-1.5 rounded-lg text-xs font-medium bg-error hover:bg-error/80 text-white transition-all active:scale-[0.97] shadow-sm"
            title={t("editor.stop")}
          >
            <Square size={13} fill="currentColor" />
            <span>{t("editor.stop")}</span>
          </button>
        ) : (
          <button
            onClick={executeActiveQuery}
            disabled={!sql.trim()}
            className="flex items-center gap-1.5 pl-3 pr-3.5 py-1.5 rounded-lg text-xs font-medium bg-accent hover:bg-accent-hover text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-[0.97] shadow-sm shadow-accent/20"
            title={t("editor.run")}
          >
            <Play size={13} fill="currentColor" />
            <span>{t("editor.run")}</span>
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language="sql"
          theme="amendoim-dark"
          value={sql}
          onChange={(value) => updateSql(value || "")}
          onMount={handleMount}
          loading={
            <div className="flex items-center justify-center h-full bg-bg-secondary text-text-faint text-xs">
              <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          }
        />
      </div>
    </div>
  );
}
