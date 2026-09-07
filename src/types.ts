export interface Note {
  id: string;
  title: string;
  slug: string;
  content: string;
  updatedAt: number;
}

export interface NoteRepository {
  getBySlug(slug: string): Promise<Note | undefined>;
  getMostRecent(): Promise<Note | undefined>;
  listMostRecent(): Promise<Note[]>;
  save(note: Note): Promise<void>;
  delete(id: string): Promise<void>;
  isSlugAvailable(slug: string, exceptId?: string): Promise<boolean>;
}
