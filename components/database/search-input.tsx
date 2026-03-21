"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback, useTransition } from "react"
import { Input } from "@/components/ui/input"

export function SearchInput({
  defaultValue,
  placeholder,
  className,
}: {
  defaultValue: string
  placeholder?: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const params = new URLSearchParams(searchParams.toString())
      const val = e.target.value.trim()
      if (val) {
        params.set("q", val)
      } else {
        params.delete("q")
      }
      params.delete("page")
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [router, pathname, searchParams]
  )

  return (
    <Input
      type="search"
      defaultValue={defaultValue}
      placeholder={placeholder}
      className={className}
      onChange={handleChange}
    />
  )
}
