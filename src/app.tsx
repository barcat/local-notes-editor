import { useCallback, useState } from "preact/hooks";
import { Editor } from "./components/Editor";
import { LeftDrawer } from "./components/LeftDrawer";

export function App() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("#open-drawer")?.focus());
  }, []);

  const startNewNote = useCallback(() => {
    setTitle("");
    setContent("");
    closeDrawer();
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".editor-title")?.focus());
  }, [closeDrawer]);

  return (
    <>
      <button
        class="menu-button"
        id="open-drawer"
        type="button"
        aria-controls="left-drawer"
        aria-expanded={isDrawerOpen}
        aria-label="Otwórz notatki i ustawienia"
        onClick={() => setIsDrawerOpen(true)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.8" />
        </svg>
      </button>

      <div {...(isDrawerOpen && { inert: true })}>
        <Editor title={title} content={content} onTitleChange={setTitle} onContentChange={setContent} />
      </div>

      <LeftDrawer isOpen={isDrawerOpen} onClose={closeDrawer} onNewNote={startNewNote} />
    </>
  );
}
