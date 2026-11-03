import { useEffect, useState } from 'react'
import { Eye, EyeOff, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { Site } from '@/features/action-tags/types'
import { toSafeApiMessage } from '@/lib/api/errors'

import type { UpdateAccountInput } from '../api/create-account'
import type { AccountItem } from '../types'

type EditAccountDrawerProps = {
  open: boolean
  account: AccountItem | null
  onClose: () => void
  onUpdate: (data: UpdateAccountInput) => Promise<void>
  sites: Site[]
  sitesLoading: boolean
  sitesError: string | null
  onReloadSites: () => void
  submitEnabled?: boolean
}

function initialUsername(account: AccountItem): string {
  return account.username?.trim() || account.email?.trim() || ''
}

/**
 * Edit Social Account. Never loads or displays existing password.
 * Empty password field → omit from PUT (preserve server credential).
 * Username is free text (CP18C.2) — no email-format requirement.
 */
export function EditAccountDrawer({
  open,
  account,
  onClose,
  onUpdate,
  sites,
  sitesLoading,
  sitesError,
  onReloadSites,
  submitEnabled = true,
}: EditAccountDrawerProps) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [siteKey, setSiteKey] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!open || !account) return
    setName(account.account_name || '')
    setUsername(initialUsername(account))
    setPassword('')
    setShowPassword(false)
    setSiteKey(account.platform || '')
    setFormError('')
    setIsSubmitting(false)
    onReloadSites()
  }, [open, account, onReloadSites])

  useEffect(() => {
    if (!open || sitesLoading || sitesError || !account) return
    if (sites.length === 0) return
    if (!sites.some((s) => s.key === siteKey)) {
      const match = sites.find((s) => s.key === account.platform)
      setSiteKey(match?.key ?? sites[0].key)
    }
  }, [open, sites, sitesLoading, sitesError, siteKey, account])

  useEffect(() => {
    if (open) return
    setPassword('')
    setShowPassword(false)
  }, [open])

  if (!open || !account) return null

  const noSites = !sitesLoading && !sitesError && sites.length === 0
  const sitesBlocked = sitesLoading || Boolean(sitesError) || noSites
  const selectedSite = sites.find((s) => s.key === siteKey) ?? null
  const canSubmit = submitEnabled && !sitesBlocked && !isSubmitting

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close edit account drawer"
        className="absolute inset-0 bg-foreground/30"
        disabled={isSubmitting}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-account-title"
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-lg"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2
              id="edit-account-title"
              className="text-sm font-semibold text-foreground"
            >
              Edit Account
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Password trống = giữ mật khẩu hiện tại. Không hiển thị password cũ.
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
            if (!trimmedName) {
              setFormError('Tên tài khoản (Account Name) là bắt buộc.')
              return
            }
            if (!trimmedUsername) {
              setFormError('Username là bắt buộc.')
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
              setFormError('Update bị tắt.')
              return
            }
            setFormError('')
            setIsSubmitting(true)
            const payload: UpdateAccountInput = {
              id: account.id,
              name: trimmedName,
              username: trimmedUsername,
              platform: selectedSite.key,
              password,
            }
            void onUpdate(payload)
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
            <div className="space-y-1.5">
              <Label htmlFor="edit-account-name">Account Name</Label>
              <Input
                id="edit-account-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-account-username">Username</Label>
              <Input
                id="edit-account-username"
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
              <Label htmlFor="edit-account-password">
                Password (optional)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="edit-account-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  autoComplete="new-password"
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
              <p className="text-[11px] text-muted">
                {account.has_password
                  ? 'Credential flag: has password'
                  : 'Credential flag: no password'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-account-site">Site</Label>
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
                    id="edit-account-site"
                    value={siteKey}
                    onChange={(e) => setSiteKey(e.target.value)}
                    disabled={isSubmitting}
                    required
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
              {isSubmitting ? 'Saving…' : 'Save Account'}
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
