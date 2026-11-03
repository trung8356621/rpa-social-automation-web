import { useEffect } from 'react'
import { EditorContent, useEditor, type Content } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import type { Site } from '@/features/action-tags/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import {
  checkContentLength,
  measureContentLength,
  siteContentPolicy,
} from '../content-limit'
import type {
  ScriptInputSchema,
  ScriptInputValueMap,
  TipTapDocJson,
} from '../types'

type Props = {
  title: string
  bodyPlain: string
  variables: ScriptInputValueMap
  editorDoc: TipTapDocJson | null
  schema: ScriptInputSchema
  site: Site | null
  disabled?: boolean
  onTitleChange: (title: string) => void
  onBodyChange: (plain: string, doc: TipTapDocJson) => void
  onVariablesChange: (vars: ScriptInputValueMap) => void
}

export function ManualArticleEditor({
  title,
  bodyPlain,
  variables,
  editorDoc,
  schema,
  site,
  disabled,
  onTitleChange,
  onBodyChange,
  onVariablesChange,
}: Props) {
  const policy = siteContentPolicy(site)
  const lengthCheck = checkContentLength(bodyPlain, policy)

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
      }),
    ],
    content: (editorDoc ?? {
      type: 'doc',
      content: bodyPlain
        ? bodyPlain.split('\n').map((line) => ({
            type: 'paragraph',
            content: line ? [{ type: 'text', text: line }] : [],
          }))
        : [{ type: 'paragraph' }],
    }) as Content,
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON() as TipTapDocJson
      onBodyChange(ed.getText({ blockSeparator: '\n' }), json)
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="article_title">
          Title{schema.title_required ? ' *' : ' (optional)'}
        </Label>
        <Input
          id="article_title"
          disabled={disabled}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Body{schema.body_required ? ' *' : ''}</Label>
        <div className="flex flex-wrap gap-1 rounded-t-[var(--radius-control)] border border-border bg-surface-muted px-2 py-1">
          <Button
            type="button"
            size="sm"
            variant={editor?.isActive('bold') ? 'default' : 'outline'}
            disabled={disabled || !editor}
            aria-label="Bold"
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            Bold
          </Button>
          <Button
            type="button"
            size="sm"
            variant={editor?.isActive('italic') ? 'default' : 'outline'}
            disabled={disabled || !editor}
            aria-label="Italic"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            Italic
          </Button>
        </div>
        <div
          className={cn(
            'min-h-28 rounded-b-[var(--radius-control)] border border-t-0 border-border bg-surface px-2.5 py-2 text-sm',
            '[&_.ProseMirror]:min-h-24 [&_.ProseMirror]:outline-none',
            !lengthCheck.ok && 'border-danger',
          )}
        >
          <EditorContent editor={editor} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {policy.content_max_length != null ? (
            <span
              className={cn(
                lengthCheck.ok
                  ? lengthCheck.nearLimit
                    ? 'text-warning'
                    : 'text-muted'
                  : 'text-danger',
              )}
            >
              {measureContentLength(bodyPlain)} / {policy.content_max_length}
              {!lengthCheck.ok ? ` — ${lengthCheck.message}` : null}
            </span>
          ) : (
            <span className="text-muted">
              Site chưa cấu hình content_max_length — không áp dụng giới hạn giả.
              ({measureContentLength(bodyPlain)} ký tự)
            </span>
          )}
        </div>
      </div>

      {schema.fields.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Script variables</p>
          {schema.fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`var_${field.key}`}>
                {field.label ?? field.key}
                {field.required ? ' *' : ''}
              </Label>
              <Input
                id={`var_${field.key}`}
                disabled={disabled}
                value={variables[field.key] ?? ''}
                onChange={(e) =>
                  onVariablesChange({
                    ...variables,
                    [field.key]: e.target.value,
                  })
                }
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
