import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../lib/utils'

/**
 * Shared markdown renderer styled for both light and dark themes. Used by
 * the AI Notes view and the Scratchpad preview.
 */
export default function Markdown({ children, className }) {
  return (
    <div
      className={cn(
        'prose-granula text-[13px] leading-relaxed text-neutral-800 dark:text-[#ddd]',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h1 className="text-lg font-semibold mt-4 mb-2 text-neutral-900 dark:text-white" {...p} />,
          h2: (p) => <h2 className="text-base font-semibold mt-4 mb-2 text-neutral-900 dark:text-white" {...p} />,
          h3: (p) => <h3 className="text-sm font-semibold mt-3 mb-1.5 text-neutral-900 dark:text-white" {...p} />,
          p:  (p) => <p className="my-2" {...p} />,
          ul: (p) => <ul className="list-disc pl-5 my-2 space-y-1" {...p} />,
          ol: (p) => <ol className="list-decimal pl-5 my-2 space-y-1" {...p} />,
          li: (p) => <li className="leading-snug" {...p} />,
          a:  (p) => <a className="text-emerald-600 dark:text-emerald-400 underline" target="_blank" rel="noreferrer" {...p} />,
          code: ({ inline, className: c, children, ...rest }) =>
            inline ? (
              <code className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-[#1a1a1a] text-[12px]" {...rest}>{children}</code>
            ) : (
              <pre className="p-3 rounded bg-neutral-100 dark:bg-[#141414] overflow-x-auto text-[12px]"><code className={c} {...rest}>{children}</code></pre>
            ),
          blockquote: (p) => <blockquote className="border-l-2 border-neutral-200 dark:border-[#262626] pl-3 italic my-2 text-neutral-600 dark:text-[#aaa]" {...p} />,
          hr: (p) => <hr className="my-4 border-neutral-200 dark:border-[#1a1a1a]" {...p} />,
          table: (p) => <table className="my-3 border-collapse text-[12px]" {...p} />,
          th: (p) => <th className="border border-neutral-200 dark:border-[#262626] px-2 py-1 text-left font-semibold" {...p} />,
          td: (p) => <td className="border border-neutral-200 dark:border-[#262626] px-2 py-1" {...p} />,
        }}
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  )
}
