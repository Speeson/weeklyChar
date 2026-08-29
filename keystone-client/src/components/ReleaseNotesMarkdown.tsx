import ReactMarkdown from "react-markdown";

type ReleaseNotesMarkdownProps = {
  notes: string;
  fallback: string;
};

export function ReleaseNotesMarkdown({ notes, fallback }: ReleaseNotesMarkdownProps) {
  return (
    <div className="release-notes-markdown">
      <ReactMarkdown
        components={{
          a: ({ children }) => <span className="release-notes-markdown__link-text">{children}</span>,
        }}
        skipHtml
      >
        {notes || fallback}
      </ReactMarkdown>
    </div>
  );
}
