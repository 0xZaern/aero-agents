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
          code({ className, children, ...props }) {
            const text = String(children ?? '');
            const m = /language-(\w+)/.exec(className ?? '');
            if (m || text.includes('\n')) {
              return <CodeBlock lang={m?.[1] ?? 'text'} code={text.replace(/\n$/, '')} plain={streaming} />;
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
