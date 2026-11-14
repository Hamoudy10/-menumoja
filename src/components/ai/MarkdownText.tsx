import type { ReactNode } from 'react'

/**
 * Tiny, safe markdown renderer for assistant replies.
 * Supports headings, bold, inline code, and ordered/unordered lists.
 * It never injects HTML (all text is rendered as React nodes).
 */
function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="rounded bg-black/5 px-1 py-0.5 text-[0.9em] dark:bg-white/10">
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={index}>{part}</span>
  })
}

export default function MarkdownText({ text, className = '' }: { text: string; className?: string }) {
  const lines = String(text || '').split(/\r?\n/)
  const blocks: ReactNode[] = []
  let bullets: string[] = []
  let numbers: string[] = []
  let key = 0

  const flushBullets = () => {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={`ul-${key++}`} className="my-1 list-disc space-y-1 pl-4">
        {bullets.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>
    )
    bullets = []
  }

  const flushNumbers = () => {
    if (numbers.length === 0) return
    blocks.push(
      <ol key={`ol-${key++}`} className="my-1 list-decimal space-y-1 pl-4">
        {numbers.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ol>
    )
    numbers = []
  }

  const flush = () => {
    flushBullets()
    flushNumbers()
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flush()
      continue
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      flushNumbers()
      bullets.push(bullet[1])
      continue
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (numbered) {
      flushBullets()
      numbers.push(numbered[1])
      continue
    }

    flush()

    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      blocks.push(
        <p key={`h-${key++}`} className="mb-1 mt-2 font-heading text-sm font-bold first:mt-0">
          {renderInline(heading[2])}
        </p>
      )
      continue
    }

    blocks.push(
      <p key={`p-${key++}`} className="my-1 first:mt-0 last:mb-0">
        {renderInline(line)}
      </p>
    )
  }

  flush()

  return <div className={`space-y-0.5 ${className}`}>{blocks}</div>
}
