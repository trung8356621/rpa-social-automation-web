import { useEffect, useState } from 'react'
import { Eye, EyeOff, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { Site } from '@/features/action-tags/types'
import { toSafeApiMessage } from '@/lib/api/errors'

import type { CreateAccountInput } from '../api/create-account'

type CreateAccountDrawerProps = {
  open: boolean
  onClose: () => void
  onCreate: (data: CreateAccountInput) => Promise<void>
  sites: Site[]
  sitesLoading: boolean
  sitesError: string | null
  onReloadSites: () => void
  /** When false, submit is disabled (e.g. non-Owner session). */
  submitEnabled?: boolean
  submitBlockedReason?: string | null
}

export function CreateAccountDrawer({
  open,
  onClose,
  onCreate,
  sites,
  sitesLoading,
  sitesError,
  onReloadSites,
  submitEnabled = true,
  submitBlockedReason = null,
}: CreateAccountDrawerProps) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  /** Canonical Account.platform = Site.key */
  const [siteKey, setSiteKey] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!open) return
    setName('')
    setUsername('')
    setPassword('')
    setShowPassword(false)
    setSiteKey('')
    setFormError('')
    setIsSubmitting(false)
    onReloadSites()
  }, [open, onReloadSites])

  useEffect(() => {
    if (!open || sitesLoading || sitesError) return
    if (sites.length === 0) {
      setSiteKey('')
      return
    }
    if (!sites.some((s) => s.key === siteKey)) {
      setSiteKey(sites[0].key)
    }
  }, [open, sites, sitesLoading, sitesError, siteKey])

  useEffect(() => {
    if (open) return
    setPassword('')
    setShowPassword(false)
  }, [open])

  if (!open) return null

  const noSites = !sitesLoading && !sitesError && sites.length === 0
  const sitesBlocked = sitesLoading || Boolean(sitesError) || noSites
  const selectedSite = sites.find((s) => s.key === siteKey) ?? null
  const canSubmit = submitEnabled && !sitesBlocked && !isSubmitting

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close create account drawer"
        className="absolute inset-0 bg-foreground/30"
        disabled={isSubmitting}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-account-title"
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-lg"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2
              id="create-account-title"
              className="text-sm font-semibold text-foreground"
            >
              Create Account
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Social Account inventory — not an SEO-OPS login user.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            disabled={isSubmitting}
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault()
            const trimmedName = name.trim()
            const trimmedUsername = username.trim()
            const pwd = password
            if (!trimmedName) {
              setFormError('Tên tài khoản (Account Name) là bắt buộc.')
              return
            }
            if (!trimmedUsername) {
              setFormError('Username là bắt buộc.')
              return
            }
            if (!pwd.trim()) {
              setFormError('Password là bắt buộc.')
              return
            }
            if (sitesBlocked || !selectedSite) {
              setFormError(
                noSites
                  ? 'Chưa có Site. Vui lòng tạo Site trong Action Tags.'
                  : 'Chọn Site hợp lệ từ Site Registry.',
              )
              return
            }
            if (!submitEnabled) {
              setFormError(
                submitBlockedReason ?? 'Create bị tắt cho phiên hiện tại.',
              )
              return
            }
            setFormError('')
            setIsSubmitting(true)
            const payload: CreateAccountInput = {
              name: trimmedName,
              username: trimmedUsername,
              platform: selectedSite.key,
              password: pwd,
            }
            void onCreate(payload)
              .then(() => {
                setPassword('')
                onClose()
              })
              .catch((err: unknown) => {
                setFormError(toSafeApiMessage(err))
              })
              .finally(() => {
                setIsSubmitting(false)
                setPassword('')
                setShowPassword(false)
              })
          }}
        >
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!submitEnabled && submitBlockedReason ? (
              <div
                className="rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground"
                role="status"
              >
                {submitBlockedReason}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="account-name">Account Name</Label>
              <Input
                id="account-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display name"
                autoComplete="off"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="account-username">Username</Label>
              <Input
                id="account-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="mayhopphat, @marketing, phone…"
                autoComplete="off"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="account-password">Password</Label>
              <div className="flex gap-2">
                <Input
                  id="account-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                  className="min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isSubmitting}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="account-site">Site</Label>
              {sitesLoading ? (
                <p className="text-xs text-muted">Đang tải Site Registry…</p>
              ) : null}
              {sitesError ? (
                <div className="space-y-2">
                  <p className="text-xs text-danger" role="alert">
                    Không tải được Site Registry: {sitesError}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onReloadSites()}
                  >
                    Retry Sites
                  </Button>
                </div>
              ) : null}
              {noSites ? (
                <p className="text-xs text-muted" role="status">
                  Chưa có Site. Vui lòng tạo Site trong Action Tags.
                </p>
              ) : null}
              {!sitesLoading && !sitesError && sites.length > 0 ? (
                <>
                  <Select
                    id="account-site"
                    value={siteKey}
                    onChange={(e) => setSiteKey(e.target.value)}
                    disabled={isSubmitting}
                    required
                    aria-label="Site from Action Tags registry"
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.key}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                  <p className="text-[11px] text-muted">
                    API <code className="font-mono">platform</code> ={' '}
                    <code className="font-mono">{selectedSite?.key ?? '—'}</code>
                  </p>
                </>
              ) : null}
            </div>

            {formError ? (
              <p className="text-xs text-danger" role="alert">
                {formError}
              </p>
            ) : null}
          </div>

          <div className="flex gap-2 border-t border-border px-4 py-3">
            <Button type="submit" disabled={!canSubmit} className="flex-1">
              {isSubmitting ? 'Creating…' : 'Create Account'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </form>
      </aside>
    </div>
  )
}
