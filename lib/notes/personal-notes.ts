export const PERSONAL_NOTE_TITLE_PREFIX = "[기타 메모]";
export const PERSONAL_NOTE_DEFAULT_TITLE = "기타 메모";

export function stripPersonalNotePrefix(title: string) {
  return title.startsWith(PERSONAL_NOTE_TITLE_PREFIX)
    ? title.slice(PERSONAL_NOTE_TITLE_PREFIX.length).trim() || PERSONAL_NOTE_DEFAULT_TITLE
    : title;
}

export function withPersonalNotePrefix(title: string) {
  const cleanTitle = stripPersonalNotePrefix(title).trim() || PERSONAL_NOTE_DEFAULT_TITLE;
  return `${PERSONAL_NOTE_TITLE_PREFIX} ${cleanTitle}`;
}
