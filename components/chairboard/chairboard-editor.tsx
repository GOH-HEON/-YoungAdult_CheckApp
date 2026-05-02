"use client";

import { useEffect, useRef, useState } from "react";

import { saveChairboardNoteAction } from "@/app/(admin)/chairboard/actions";

const FONT_OPTIONS = [
  { label: "Noto Sans KR", value: "'Noto Sans KR', sans-serif" },
  { label: "Manrope", value: "Manrope, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
] as const;

const FONT_SIZE_OPTIONS = [14, 16, 18, 20, 24] as const;

type ChairboardEditorProps = {
  noteId: string | null;
  title: string;
  contentHtml: string;
  updatedAtLabel: string;
};

function ToolbarButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
    >
      {label}
    </button>
  );
}

export function ChairboardEditor({ noteId, title, contentHtml, updatedAtLabel }: ChairboardEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const contentInputRef = useRef<HTMLInputElement>(null);
  const [titleValue, setTitleValue] = useState(title);
  const [fontFamily, setFontFamily] = useState<string>(FONT_OPTIONS[0].value);
  const [fontSize, setFontSize] = useState<number>(16);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const normalizedContent = contentHtml || "<p><br/></p>";
    editorRef.current.innerHTML = normalizedContent;

    if (contentInputRef.current) {
      contentInputRef.current.value = normalizedContent;
    }
  }, [contentHtml]);

  function syncContentField() {
    if (!editorRef.current || !contentInputRef.current) {
      return;
    }

    contentInputRef.current.value = editorRef.current.innerHTML;
  }

  function executeCommand(command: string) {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.focus();
    document.execCommand(command, false);
    syncContentField();
  }

  return (
    <form
      action={saveChairboardNoteAction}
      onSubmit={syncContentField}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)] sm:p-6"
    >
      <input type="hidden" name="noteId" value={noteId ?? ""} />
      <input ref={contentInputRef} type="hidden" name="contentHtml" defaultValue={contentHtml || "<p><br/></p>"} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          name="title"
          value={titleValue}
          onChange={(event) => setTitleValue(event.target.value)}
          placeholder="문서 제목"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-semibold text-slate-900 sm:max-w-md"
        />
        <p className="text-xs text-slate-500">{updatedAtLabel}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={fontFamily}
            onChange={(event) => setFontFamily(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
          >
            {FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={fontSize}
            onChange={(event) => setFontSize(Number.parseInt(event.target.value, 10))}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
          >
            {FONT_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>

          <ToolbarButton label="굵게" onClick={() => executeCommand("bold")} />
          <ToolbarButton label="기울임" onClick={() => executeCommand("italic")} />
          <ToolbarButton label="밑줄" onClick={() => executeCommand("underline")} />
          <ToolbarButton label="왼쪽" onClick={() => executeCommand("justifyLeft")} />
          <ToolbarButton label="가운데" onClick={() => executeCommand("justifyCenter")} />
          <ToolbarButton label="오른쪽" onClick={() => executeCommand("justifyRight")} />
          <ToolbarButton label="번호" onClick={() => executeCommand("insertOrderedList")} />
          <ToolbarButton label="목록" onClick={() => executeCommand("insertUnorderedList")} />
          <ToolbarButton label="되돌리기" onClick={() => executeCommand("undo")} />
          <ToolbarButton label="다시" onClick={() => executeCommand("redo")} />
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncContentField}
        className="min-h-[480px] rounded-xl border border-slate-200 bg-white p-5 text-slate-900 outline-none focus:ring-2 focus:ring-[#2563eb]/30"
        style={{ fontFamily, fontSize: `${fontSize}px`, lineHeight: 1.7 }}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">회장단 전용 문서입니다.</p>
        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          저장
        </button>
      </div>
    </form>
  );
}
