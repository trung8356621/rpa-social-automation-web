import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { ShortcodeBlockView } from './ShortcodeBlockView'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    shortcodeBlock: {
      insertShortcodeBlock: (name: string) => ReturnType
      wrapSelectionInShortcode: (name: string) => ReturnType
    }
  }
}

/**
 * TipTap custom node: protected shortcode wrapper labels + editable inner content.
 * Serialization to Backend uses plain `[name]...[/name]` — never HTML / JSON.
 */
export const ShortcodeBlock = Node.create({
  name: 'shortcodeBlock',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      name: {
        default: 'body',
        parseHTML: (element) =>
          element.getAttribute('data-shortcode') || 'body',
        renderHTML: (attributes) => ({
          'data-shortcode': attributes.name,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-shortcode]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ShortcodeBlockView)
  },

  addCommands() {
    return {
      insertShortcodeBlock:
        (name: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { name },
            content: [{ type: 'paragraph' }],
          }),
      wrapSelectionInShortcode:
        (name: string) =>
        ({ state, dispatch }) => {
          const { from, to, empty } = state.selection
          const tr = state.tr
          if (empty) {
            if (!dispatch) return true
            const node = this.type.create(
              { name },
              state.schema.nodes.paragraph.create(),
            )
            tr.replaceSelectionWith(node)
            dispatch(tr)
            return true
          }
          const text = state.doc.textBetween(from, to, '\n')
          if (!dispatch) return true
          const paragraph = state.schema.nodes.paragraph.create(
            null,
            text ? state.schema.text(text) : undefined,
          )
          const node = this.type.create({ name }, paragraph)
          tr.replaceWith(from, to, node)
          dispatch(tr)
          return true
        },
    }
  },
})
