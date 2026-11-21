import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

import {
  allScriptVariables,
  emptyShortcodeMappingEntry,
  validateBodyShortcodeSupport,
  type ShortcodeMappingFormEntry,
} from '../shortcode-mapping'
import type { ScriptInputSchema } from '../types'

type Props = {
  value: ShortcodeMappingFormEntry[]
  onChange: (next: ShortcodeMappingFormEntry[]) => void
  schema: ScriptInputSchema
  schemaLoading?: boolean
  schemaError?: string | null
  disabled?: boolean
}

export function ShortcodeMappingFields({
  value,
  onChange,
  schema,
  schemaLoading = false,
  schemaError = null,
  disabled,
}: Props) {
  const variables = allScriptVariables(schema)
  const hasBodyShortcode = value.some((r) => r.shortcode.trim() === 'body')
  const bodySupport = schema.schema_available
    ? validateBodyShortcodeSupport(schema)
    : null

  const patchRow = (
    id: string,
    partial: Partial<ShortcodeMappingFormEntry>,
  ) => {
    onChange(value.map((row) => (row.id === id ? { ...row, ...partial } : row)))
  }

  const removeRow = (id: string) => {
    if (value.length <= 1) return
    onChange(value.filter((row) => row.id !== id))
  }

  const addRow = () => {
    onChange([...value, emptyShortcodeMappingEntry({ shortcode: '', variable: '' })])
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          B — Shortcode Mapping
        </h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || schemaLoading || !schema.schema_available}
          onClick={addRow}
        >
          <Plus className="size-3.5" />
          Add shortcode
        </Button>
      </div>
      <p className="text-[11px] text-muted">
        Default shortcode name is <code className="font-mono">[body]</code>. Bind
        each shortcode to a pinned Script variable. Script is not assumed to have
        a <code className="font-mono">body</code> variable. Zero Contents allowed
        at create.
      </p>

      {schemaLoading ? (
        <p className="text-xs text-muted">
          Loading published Script release variables…
        </p>
      ) : !schema.schema_available ? (
        <p className="text-xs text-danger whitespace-pre-wrap">
          {schemaError ||
            schema.unavailable_reason ||
            'Script schema unavailable — published release variables could not be resolved for this Script/version. Fail-closed; variables are not invented.'}
        </p>
      ) : variables.length === 0 ? (
        <p className="text-xs text-warning">
          Published Script release projects an empty variables list (no mappable
          keys after credential filters).
        </p>
      ) : hasBodyShortcode && bodySupport && !bodySupport.supported ? (
        <p className="text-xs text-warning">{bodySupport.reason}</p>
      ) : null}

      <div className="space-y-2">
        {value.map((row) => {
          const selected = variables.find((v) => v.key === row.variable)
          return (
            <div
              key={row.id}
              className="grid gap-2 rounded-[var(--radius-control)] border border-border p-2 sm:grid-cols-[7rem_1fr_auto]"
            >
              <div className="space-y-1">
                <Label htmlFor={`sc_${row.id}`}>Shortcode</Label>
                <Input
                  id={`sc_${row.id}`}
                  disabled={disabled || schemaLoading}
                  value={row.shortcode}
                  placeholder="body"
                  onChange={(e) =>
                    patchRow(row.id, { shortcode: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`var_${row.id}`}>Script variable</Label>
                <Select
                  id={`var_${row.id}`}
                  disabled={
                    disabled || schemaLoading || !schema.schema_available
                  }
                  value={row.variable}
                  onChange={(e) =>
                    patchRow(row.id, { variable: e.target.value })
                  }
                >
                  <option value="">Select variable…</option>
                  {variables.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label ?? v.key} · {v.type} ·{' '}
                      {v.required ? 'required' : 'optional'}
                    </option>
                  ))}
                </Select>
                {selected ? (
                  <p className="text-[11px] text-muted">
                    Type <code className="font-mono">{selected.type}</code> ·{' '}
                    {selected.required ? 'required' : 'optional'}
                  </p>
                ) : null}
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  disabled={disabled || value.length <= 1}
                  aria-label="Remove mapping row"
                  onClick={() => removeRow(row.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
