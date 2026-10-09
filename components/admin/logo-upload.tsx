"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Monogram } from "@/components/radar/monogram"
import { LOGO_HINT, LOGO_MAX_BYTES, LOGO_MIN_PX, LOGO_TYPES, isSquareEnough } from "@/lib/logo-spec"

/** Read an image file's pixel size in the browser */
function imageSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { reject(new Error("unreadable")); URL.revokeObjectURL(url) }
    img.src = url
  })
}

/**
 * Logo field for the admin startup form. Uploads straight away (independent of
 * "Save Changes") so the file is stored as soon as it passes the checks.
 */
export function LogoUpload({
  startupId,
  name,
  initialUrl,
}: {
  startupId?: string
  name: string
  initialUrl: string | null
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState(initialUrl)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow picking the same file again after an error
    if (!file || !startupId) return
    setMessage(null)

    if (!(LOGO_TYPES as readonly string[]).includes(file.type)) {
      return setMessage({ kind: "error", text: "Please use a PNG, JPG or WebP image." })
    }
    if (file.size > LOGO_MAX_BYTES) {
      return setMessage({ kind: "error", text: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 1 MB.` })
    }
    let size: { w: number; h: number }
    try {
      size = await imageSize(file)
    } catch {
      return setMessage({ kind: "error", text: "Couldn't read that image." })
    }
    if (!isSquareEnough(size.w, size.h)) {
      return setMessage({ kind: "error", text: `That image is ${size.w}×${size.h} px. The logo needs to be square.` })
    }
    if (size.w < LOGO_MIN_PX) {
      return setMessage({ kind: "error", text: `That image is ${size.w}×${size.h} px. Use at least ${LOGO_MIN_PX}×${LOGO_MIN_PX} px so it stays sharp.` })
    }

    setBusy(true)
    const body = new FormData()
    body.append("file", file)
    const res = await fetch(`/api/admin/startups/${startupId}/logo`, { method: "POST", body })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setMessage({ kind: "error", text: data.error ?? "Upload failed." })
    setUrl(data.logo_url)
    setMessage({ kind: "ok", text: "Logo saved." })
    router.refresh()
  }

  async function remove() {
    if (!startupId) return
    setBusy(true)
    setMessage(null)
    const res = await fetch(`/api/admin/startups/${startupId}/logo`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setMessage({ kind: "error", text: data.error ?? "Could not remove the logo." })
    setUrl(null)
    setMessage({ kind: "ok", text: "Logo removed. The initials will show instead." })
    router.refresh()
  }

  return (
    <div className="flex items-start gap-4">
      <Monogram name={name || "?"} tone="light" size="xl" imageUrl={url} />
      <div className="min-w-0 flex-1 space-y-2">
        {startupId ? (
          <div className="flex flex-wrap gap-2">
            <input ref={input} type="file" accept={LOGO_TYPES.join(",")} className="hidden" onChange={onPick} />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? "Working…" : url ? "Replace logo" : "Upload logo"}
            </Button>
            {url && (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}>
                Remove
              </Button>
            )}
          </div>
        ) : (
          <p className="text-[12px] font-medium text-foreground">Create the startup first, then upload a logo from its edit page.</p>
        )}
        <p className="text-[12px] leading-relaxed text-muted-foreground">{LOGO_HINT}</p>
        {message && (
          <p className={`text-[12px] ${message.kind === "error" ? "text-destructive" : "text-accent-green"}`}>{message.text}</p>
        )}
      </div>
    </div>
  )
}
