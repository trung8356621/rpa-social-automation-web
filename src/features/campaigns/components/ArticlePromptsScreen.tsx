import { useMemo, useState } from 'react'

import type { ActionTagItem } from '@/features/action-tags/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  tags: ActionTagItem[]
  tagsLoading?: boolean
  aiGenerationAvailable: boolean
}

/**
 * V1 shell only — no AI generation API calls, no fake production content.
 */
export function ArticlePromptsScreen({
  tags,
  tagsLoading,
  aiGenerationAvailable,
}: Props) {
  const [tagKey, setTagKey] = useState('')
  const [promptName, setPromptName] = useState('')
  const [promptBody, setPromptBody] = useState(
    'Viết bài đăng cho {{site_name}} về {{topic}}. Giọng điệu: {{tone}}.',
  )

  const selected = tags.find((t) => t.tag_key === tagKey) ?? null

  const previewVars = useMemo(() => {
    const matches = promptBody.match(/\{\{\s*([\w.]+)\s*\}\}/g) ?? []
    return [...new Set(matches)]
  }, [promptBody])

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-4">
      <PageHeader
        title="Prompt bài viết theo Tags"
        description="Nền tảng cấu hình prompt từ Action Tags — chưa kích hoạt AI Generation."
        actions={
          aiGenerationAvailable ? (
            <Badge variant="success">AI Generation available</Badge>
          ) : (
            <Badge variant="warning">Chưa kích hoạt AI Generation</Badge>
          )
        }
      />

      {!aiGenerationAvailable ? (
        <div className="rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
          Backend Prompt / AI Generation contract chưa có. UI này chỉ là
          foundation — không gọi API generate, không tạo nội dung giả gắn nhãn
          production.
        </div>
      ) : null}

      <section className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-3">
        <div className="space-y-1.5">
          <Label htmlFor="tag_sel">Action Tag</Label>
          <Select
            id="tag_sel"
            disabled={tagsLoading}
            value={tagKey}
            onChange={(e) => setTagKey(e.target.value)}
          >
            <option value="">Chọn tag từ Action Tags Registry…</option>
            {tags.map((t) => (
              <option key={t.id} value={t.tag_key}>
                {t.name} · {t.tag_key}
              </option>
            ))}
          </Select>
          {selected ? (
            <p className="text-xs text-muted">
              Site: {selected.site_name} ({selected.site_key}) · Path:{' '}
              {selected.path_name}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prompt_name">Prompt name</Label>
          <Input
            id="prompt_name"
            value={promptName}
            onChange={(e) => setPromptName(e.target.value)}
            placeholder="VD: FB group morning tone"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prompt_body">Prompt template</Label>
          <Textarea
            id="prompt_body"
            rows={6}
            value={promptBody}
            onChange={(e) => setPromptBody(e.target.value)}
          />
        </div>

        <div>
          <p className="text-xs font-medium text-foreground">Variable preview</p>
          {previewVars.length === 0 ? (
            <p className="mt-1 text-xs text-muted">
              Không có biến {'{{...}}'} trong template.
            </p>
          ) : (
            <ul className="mt-1 flex flex-wrap gap-1">
              {previewVars.map((v) => (
                <Badge key={v} variant="neutral">
                  {v}
                </Badge>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2">
          <Button size="sm" disabled title="AI Generation chưa kích hoạt">
            Generate (disabled)
          </Button>
          <Button size="sm" variant="outline" disabled>
            Save prompt (disabled)
          </Button>
        </div>
      </section>

      {!tagKey ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          Empty state — chọn Action Tag để bắt đầu cấu hình prompt.
        </div>
      ) : null}
    </div>
  )
}
