export interface Note {
  id: string;
  title: string;
  slug: string;
  content: string;
  updatedAt: number;
}

export interface NoteDraft {
  id?: string;
  title: string;
  content: string;
  slug?: string;
}

export type EditorFontFamily = "Courier New" | "Consolas" | "Georgia" | "Arial" | "IBM Plex Mono" | "Commit Mono";

export interface EditorPreferences {
  backgroundColor: string;
  textColor: string;
  fontFamily: EditorFontFamily;
  fontSizePt: number;
  lineHeight: number;
  editorWidthPx: number;
}

export type SaveState = "unchanged" | "dirty" | "saving" | "saved" | "error";

export interface NoteRepository {
  getBySlug(slug: string): Promise<Note | undefined>;
  getMostRecent(): Promise<Note | undefined>;
  listMostRecent(): Promise<Note[]>;
  save(note: Note): Promise<void>;
  delete(id: string): Promise<void>;
  isSlugAvailable(slug: string, exceptId?: string): Promise<boolean>;
}
