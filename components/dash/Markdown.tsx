'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';

export default function Markdown({ children, streaming = false }: { children: string; streaming?: boolean }) {
  return (
    <div className="body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => <a target="_blank" rel="noreferrer" {...props} />,
          // fenced blocks → CodeBlock card; inline code stays a plain <code>
          code({ node, className, children, ...props }) {
            const text = String(children ?? '');
            const m = /language-(\w+)/.exec(className ?? '');
            // Filename on the fence, e.g. ```python app.py  →  meta = "app.py".
            // Pass it to CodeBlock so the header is consistent across languages
            // (markdown rarely carries a first-line filename comment, so without
            // this its box showed only "markdown" while code showed the filename).
            const meta = (node as { data?: { meta?: string } } | undefined)?.data?.meta?.trim();
            const fenceName = meta && /^[A-Za-z0-9._\-/]+\.[A-Za-z0-9]+$/.test(meta) ? meta : undefined;
            if (m || text.includes('\n')) {
              return <CodeBlock lang={m?.[1] ?? 'text'} code={text.replace(/\n$/, '')} name={fenceName} plain={streaming} />;
            }
            return <code className="inline-code" {...props}>{children}</code>;
          },
          // CodeBlock renders its own container - don't wrap it in <pre>
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
