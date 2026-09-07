import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Note, NoteRepository } from "./types";

export const DATABASE_NAME = "local-notes";
export const DATABASE_VERSION = 1;
export const NOTES_STORE = "notes";

interface NotesDatabase extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: {
      slug: string;
      updatedAt: number;
    };
  };
}

function openNotesDatabase(databaseName: string): Promise<IDBPDatabase<NotesDatabase>> {
  return openDB<NotesDatabase>(databaseName, DATABASE_VERSION, {
    upgrade(database) {
      const store = database.createObjectStore(NOTES_STORE, { keyPath: "id" });
      store.createIndex("slug", "slug", { unique: true });
      store.createIndex("updatedAt", "updatedAt");
    },
  });
}

export function createNoteRepository(databaseName = DATABASE_NAME): NoteRepository {
  const database = openNotesDatabase(databaseName);

  return {
    async getBySlug(slug) {
      return (await database).getFromIndex(NOTES_STORE, "slug", slug);
    },

    async getMostRecent() {
      const transaction = (await database).transaction(NOTES_STORE, "readonly");
      const cursor = await transaction.store.index("updatedAt").openCursor(null, "prev");
      await transaction.done;
      return cursor?.value;
    },

    async listMostRecent() {
      const transaction = (await database).transaction(NOTES_STORE, "readonly");
      const notes: Note[] = [];
      let cursor = await transaction.store.index("updatedAt").openCursor(null, "prev");
      while (cursor) {
        notes.push(cursor.value);
        cursor = await cursor.continue();
      }
      await transaction.done;
      return notes;
    },

    async save(note) {
      const transaction = (await database).transaction(NOTES_STORE, "readwrite");
      await transaction.store.put(note);
      await transaction.done;
    },

    async delete(id) {
      const transaction = (await database).transaction(NOTES_STORE, "readwrite");
      await transaction.store.delete(id);
      await transaction.done;
    },

    async isSlugAvailable(slug, exceptId) {
      const existing = await (await database).getFromIndex(NOTES_STORE, "slug", slug);
      return existing === undefined || existing.id === exceptId;
    },
  };
}

export const noteRepository = createNoteRepository();
