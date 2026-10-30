import { parseMarkdown } from "./parseMarkdown";
import type { MarkdownRequest, MarkdownResponse } from "./protocol";

// Keep the DOM and worker library declarations separate without a second tsconfig.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<MarkdownRequest>) => void) | null;
  postMessage: (response: MarkdownResponse) => void;
};
scope.onmessage = ({ data }) => {
  if (!Number.isSafeInteger(data?.id) || typeof data.content !== "string") return;
  scope.postMessage({ id: data.id, ...parseMarkdown(data.content) });
};
