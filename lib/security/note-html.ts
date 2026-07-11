import "server-only";

import sanitizeHtml from "sanitize-html";

// 리치텍스트 에디터(contenteditable + execCommand)가 생성하는 서식 태그만 허용한다.
// script / img / iframe / on* 핸들러 / javascript: URL 등 실행 가능한 벡터는 모두 제거한다.
const NOTE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "div",
    "span",
    "br",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "s",
    "strike",
    "sub",
    "sup",
    "blockquote",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "a",
  ],
  allowedAttributes: {
    "*": ["style"],
    a: ["href", "target", "rel"],
  },
  // http/https/mailto만 허용. javascript:, data: 등은 차단된다.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { a: ["http", "https", "mailto"] },
  // style 속성에서 서식 관련 안전한 속성만 화이트리스트로 남긴다.
  allowedStyles: {
    "*": {
      color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i, /^[a-z-]+$/i],
      "background-color": [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i, /^[a-z-]+$/i],
      "font-family": [/^[\w\s"',-]+$/i],
      "font-size": [/^\d{1,3}(\.\d+)?(px|pt|em|rem|%)$/i],
      "font-weight": [/^(normal|bold|bolder|lighter|\d{3})$/i],
      "font-style": [/^(normal|italic|oblique)$/i],
      "text-align": [/^(left|right|center|justify)$/i],
      "text-decoration": [/^[a-z\s-]+$/i],
    },
  },
  // a 태그는 항상 안전한 rel을 강제한다.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }, true),
  },
  disallowedTagsMode: "discard",
};

const MAX_NOTE_HTML_LENGTH = 200_000;

export function sanitizeNoteHtml(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const capped = value.slice(0, MAX_NOTE_HTML_LENGTH);
  return sanitizeHtml(capped, NOTE_SANITIZE_OPTIONS);
}
