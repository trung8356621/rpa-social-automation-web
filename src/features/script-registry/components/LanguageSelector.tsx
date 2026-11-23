import { useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

import { Input } from '@/components/ui/input'

import {
  formatLanguageDisplay,
  normalizeLanguageCode,
  searchLanguages,
} from '../languages'

type LanguageSelectorProps = {
  id?: string
  value: string | null
  disabled?: boolean
  onChange: (code: string | null) => void
}

export function LanguageSelector({
  id = 'script-language-selector',
  value,
  disabled = false,
  onChange,
}: LanguageSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const normalizedValue = normalizeLanguageCode(value)
  const filtered = useMemo(() => searchLanguages(query), [query])

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev)
        }}
        className="flex h-9 w-full items-center justify-between rounded-[var(--radius-control)] border border-border bg-surface px-3 text-left text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="truncate">{formatLanguageDisplay(normalizedValue)}</span>
        <ChevronDown className="ml-2 size-4 shrink-0 text-muted" />
      </button>

      {open && !disabled ? (
        <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-control)] border border-border bg-surface shadow-lg">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-muted" />
              <Input
                autoFocus
                className="h-8 pl-8 text-xs"
                placeholder="Search English name, native name, or code…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <ul
            role="listbox"
            className="max-h-56 overflow-y-auto py-1 text-xs"
          >
            <li>
              <button
                type="button"
                role="option"
                aria-selected={normalizedValue === null}
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                  setQuery('')
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-surface-muted ${
                  normalizedValue === null ? 'bg-surface-muted font-medium' : ''
                }`}
              >
                <span>Default / Unassigned</span>
                <span className="font-mono text-[11px] text-muted">DEFAULT</span>
              </button>
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-muted">
                No matching languages found.
              </li>
            ) : (
              filtered.map((lang) => {
                const selected =
                  normalizedValue?.toLowerCase() === lang.code.toLowerCase()
                return (
                  <li key={lang.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(lang.code)
                        setOpen(false)
                        setQuery('')
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-surface-muted ${
                        selected ? 'bg-surface-muted font-medium' : ''
                      }`}
                    >
                      <span className="truncate">
                        {lang.name}
                        {lang.nativeName && lang.nativeName !== lang.name
                          ? ` (${lang.nativeName})`
                          : ''}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-muted">
                        {lang.code}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
