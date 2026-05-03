"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps, MouseEventHandler } from "react";

import { deleteChairboardNoteAction, saveChairboardNoteAction } from "@/app/(admin)/chairboard/actions";

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
  initialEditing?: boolean;
  saveAction?: ComponentProps<"form">["action"];
  deleteAction?: ComponentProps<"button">["formAction"];
  footerText?: string;
  saveButtonKey?: string;
  editButtonKey?: string;
};

function ToolbarButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-md border px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-150",
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
          : "border-slate-300 bg-white hover:bg-slate-100 active:translate-y-[1px] active:scale-[0.97] hover:shadow",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function ActionButton({
  label,
  variant = "primary",
  onClick,
  disabled,
  type = "button",
  formAction,
}: {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: "button" | "submit";
  formAction?: ComponentProps<"button">["formAction"];
}) {
  const styles = {
    primary: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
    secondary: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border-rose-300 bg-white text-rose-700 hover:bg-rose-50",
  }[variant];

  return (
    <button
      type={type}
      formAction={formAction}
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-all duration-150",
        "active:translate-y-[1px] active:scale-[0.98] hover:shadow",
        disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 shadow-none" : `border ${styles}`,
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export function ChairboardEditor({
  noteId,
  title,
  contentHtml,
  updatedAtLabel,
  initialEditing = false,
  saveAction = saveChairboardNoteAction,
  deleteAction = deleteChairboardNoteAction,
  footerText = "회장단 전용 문서입니다.",
  saveButtonKey = "chairboard-save",
  editButtonKey = "chairboard-edit",
}: ChairboardEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const contentInputRef = useRef<HTMLInputElement>(null);
  const [titleValue, setTitleValue] = useState(title);
  const [fontFamily, setFontFamily] = useState<string>(FONT_OPTIONS[0].value);
  const [fontSize, setFontSize] = useState<number>(16);
  const [isEditing, setIsEditing] = useState(initialEditing);

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
      action={saveAction}
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
          readOnly={!isEditing}
          placeholder="문서 제목"
          className={[
            "w-full rounded-lg border px-3 py-2 text-base font-semibold text-slate-900 outline-none sm:max-w-md",
            isEditing
              ? "border-slate-300 bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
              : "border-slate-200 bg-slate-50",
          ].join(" ")}
        />
        <p className="text-xs text-slate-500">{updatedAtLabel}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={fontFamily}
            onChange={(event) => setFontFamily(event.target.value)}
            disabled={!isEditing}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all duration-150 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
            disabled={!isEditing}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all duration-150 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {FONT_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>

          <ToolbarButton label="굵게" onClick={() => executeCommand("bold")} disabled={!isEditing} />
          <ToolbarButton label="기울임" onClick={() => executeCommand("italic")} disabled={!isEditing} />
          <ToolbarButton label="밑줄" onClick={() => executeCommand("underline")} disabled={!isEditing} />
          <ToolbarButton label="왼쪽" onClick={() => executeCommand("justifyLeft")} disabled={!isEditing} />
          <ToolbarButton label="가운데" onClick={() => executeCommand("justifyCenter")} disabled={!isEditing} />
          <ToolbarButton label="오른쪽" onClick={() => executeCommand("justifyRight")} disabled={!isEditing} />
          <ToolbarButton label="번호" onClick={() => executeCommand("insertOrderedList")} disabled={!isEditing} />
          <ToolbarButton label="목록" onClick={() => executeCommand("insertUnorderedList")} disabled={!isEditing} />
          <ToolbarButton label="되돌리기" onClick={() => executeCommand("undo")} disabled={!isEditing} />
          <ToolbarButton label="다시" onClick={() => executeCommand("redo")} disabled={!isEditing} />
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onInput={syncContentField}
        className={[
          "min-h-[480px] rounded-xl border bg-white p-5 text-slate-900 outline-none transition-all duration-150",
          isEditing
            ? "border-slate-200 focus:ring-2 focus:ring-[#2563eb]/30"
            : "border-slate-200 bg-slate-50/60 text-slate-700",
        ].join(" ")}
        style={{ fontFamily, fontSize: `${fontSize}px`, lineHeight: 1.7 }}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{footerText}</p>
        <div className="flex items-center gap-2">
          {noteId ? (
            <ActionButton
              label="삭제"
              variant="danger"
              type="submit"
              formAction={deleteAction}
              onClick={(event) => {
                if (!window.confirm("이 메모를 삭제할까요? 삭제 후 복구할 수 없습니다.")) {
                  event.preventDefault();
                }
              }}
            />
          ) : null}

          {isEditing ? (
            <ActionButton key={saveButtonKey} label="저장" variant="primary" type="submit" />
          ) : (
            <ActionButton
              key={editButtonKey}
              label="수정"
              variant="secondary"
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsEditing(true);
                editorRef.current?.focus();
              }}
            />
          )}
        </div>
      </div>
    </form>
  );
}
