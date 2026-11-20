import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

/** Protected wrapper labels — content editable inside only. */
export function ShortcodeBlockView({ node }: NodeViewProps) {
  const name = String(node.attrs.name ?? 'body')
  return (
    <NodeViewWrapper
      className="my-1 rounded-[var(--radius-control)] border border-border bg-surface-muted"
      data-shortcode={name}
    >
      <div
        className="select-none border-b border-border px-2 py-0.5 font-mono text-[11px] text-muted"
        contentEditable={false}
      >
        [{name}]
      </div>
      <NodeViewContent className="min-h-8 px-2.5 py-1.5 text-sm outline-none" />
      <div
        className="select-none border-t border-border px-2 py-0.5 font-mono text-[11px] text-muted"
        contentEditable={false}
      >
        [/{name}]
      </div>
    </NodeViewWrapper>
  )
}
