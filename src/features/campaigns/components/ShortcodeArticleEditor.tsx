import { useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor, type Content } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import {
  defaultRawSourceForMapping,
  rawSourceToTipTapDoc,
  tipTapDocToRawSource,
} from '../shortcode-source'
import { ShortcodeBlock } from '../tiptap/shortcode-block'
import type { CampaignShortcodeMapping } from '../types'

type Props = {
  rawSource: string
  mapping: CampaignShortcodeMapping
  disabled?: boolean
  onChange: (rawSource: string) => void
}

/**
 * One shortcode editor. Rich formatting disabled until an explicit
 * serialization contract exists. Backend receives plain shortcode text only.
 */
export function ShortcodeArticleEditor({
  rawSource,
  mapping,
  disabled,
  onChange,
}: Props) {
  const [rawMode, setRawMode] = useState(false)
  const shortcodes = useMemo(
    () => mapping.entries.map((e) => e.shortcode),
    [mapping.entries],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        listItem: false,
        listKeymap: false,
        strike: false,
        underline: false,
        link: false,
        bold: false,
        italic: false,
      }),
      ShortcodeBlock,
    ],
    content: rawSourceToTipTapDoc(
      rawSource.trim()
        ? rawSource
        : defaultRawSourceForMapping(shortcodes),
    ) as Content,
    editable: !disabled && !rawMode,
    onUpdate: ({ editor: ed }) => {
      onChange(tipTapDocToRawSource(ed.getJSON() as never))
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled && !rawMode)
  }, [disabled, editor, rawMode])

  const applyShortcode = (name: string) => {
    if (!editor || disabled) return
    const { empty } = editor.state.selection
    if (empty) {
      editor.chain().focus().insertShortcodeBlock(name).run()
    } else {
      editor.chain().focus().wrapSelectionInShortcode(name).run()
    }
    onChange(tipTapDocToRawSource(editor.getJSON() as never))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Shortcode source</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            if (!rawMode && editor) {
              onChange(tipTapDocToRawSource(editor.getJSON() as never))
            }
            setRawMode((v) => !v)
          }}
        >
          {rawMode ? 'Visual editor' : 'Raw Source'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-t-[var(--radius-control)] border border-border bg-surface-muted px-2 py-1">
        {shortcodes.map((name) => (
          <Button
            key={name}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || rawMode || !editor}
            onClick={() => applyShortcode(name)}
          >
            [{name}]
          </Button>
        ))}
        <span className="self-center text-[11px] text-muted">
          Selection wraps · empty inserts placeholder. No rich formatting.
        </span>
      </div>

      {rawMode ? (
        <textarea
          className={cn(
            'min-h-36 w-full rounded-b-[var(--radius-control)] border border-t-0 border-border bg-surface px-2.5 py-2 font-mono text-xs outline-none',
          )}
          disabled={disabled}
          value={rawSource}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <div
          className={cn(
            'min-h-36 rounded-b-[var(--radius-control)] border border-t-0 border-border bg-surface px-2.5 py-2 text-sm',
            '[&_.ProseMirror]:min-h-28 [&_.ProseMirror]:outline-none',
          )}
        >
          <EditorContent editor={editor} />
        </div>
      )}

      <p className="text-[11px] text-muted">
        Saves as plain text shortcode only — never HTML or TipTap JSON.
      </p>
    </div>
  )
}
