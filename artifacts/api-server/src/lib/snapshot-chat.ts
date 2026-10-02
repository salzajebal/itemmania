/**
 * The captured chat page contains an example conversation. Remove it before
 * serving the page so it cannot flash while the real room history is loading.
 * Keep the surrounding snapshot markup intact.
 */
export function stripSnapshotChatMessages(html: string): string {
  if (!html) return html;

  const opening = /<div\b[^>]*\bid=chat_content_list\b[^>]*>/i.exec(html);
  if (!opening) throw new Error("Snapshot chat message container not found");

  const contentStart = opening.index + opening[0].length;
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = contentStart;
  let depth = 1;
  let tag: RegExpExecArray | null;
  while ((tag = tags.exec(html))) {
    depth += /^<\/div/i.test(tag[0]) ? -1 : 1;
    if (depth === 0) {
      return html.slice(0, contentStart) + html.slice(tag.index);
    }
  }
  throw new Error("Snapshot chat message container is not closed");
}