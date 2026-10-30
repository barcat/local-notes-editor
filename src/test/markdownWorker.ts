import { vi } from "vitest";
import { parseMarkdown } from "../markdown/parseMarkdown";
import type { MarkdownRequest, MarkdownResponse } from "../markdown/protocol";

// Only tests tokenize on this thread; production always uses the real worker.
export class MarkdownWorkerMock {
  static instances: MarkdownWorkerMock[] = [];
  static autoRespond = true;
  onmessage: ((event: MessageEvent<MarkdownResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  request?: MarkdownRequest;
  terminate = vi.fn();
  constructor() { MarkdownWorkerMock.instances.push(this); }
  postMessage = vi.fn((request: MarkdownRequest) => {
    this.request = request;
    if (MarkdownWorkerMock.autoRespond) this.respond();
  });
  respond(response?: MarkdownResponse) {
    const result = response ?? { id: this.request!.id, ...parseMarkdown(this.request!.content) };
    this.onmessage?.({ data: structuredClone(result) } as MessageEvent<MarkdownResponse>);
  }
}

export function installMarkdownWorker(autoRespond = true) {
  MarkdownWorkerMock.instances = [];
  MarkdownWorkerMock.autoRespond = autoRespond;
  vi.stubGlobal("Worker", MarkdownWorkerMock);
}
