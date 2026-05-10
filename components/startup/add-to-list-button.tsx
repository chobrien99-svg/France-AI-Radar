"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

type UserList = {
  id: string
  name: string
  hasItem: boolean
}

interface Props {
  startupId: string
  isLoggedIn: boolean
}

export function AddToListButton({ startupId, isLoggedIn }: Props) {
  const router = useRouter()
  const [lists, setLists] = useState<UserList[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open && isLoggedIn) {
      loadLists()
    }
  }, [open, isLoggedIn])

  async function loadLists() {
    setLoading(true)
    const res = await fetch(`/api/lists?startup_id=${startupId}`)
    if (res.ok) {
      const data = await res.json()
      setLists(data.lists ?? [])
    }
    setLoading(false)
  }

  async function toggleItem(listId: string, currentlyIn: boolean) {
    if (currentlyIn) {
      await fetch(`/api/lists/${listId}/items?organization_id=${startupId}`, { method: "DELETE" })
    } else {
      await fetch(`/api/lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: startupId }),
      })
    }
    await loadLists()
    router.refresh()
  }

  if (!isLoggedIn) return null

  const inListCount = lists.filter((l) => l.hasItem).length

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="text-[13px]">
          {inListCount > 0 ? `In ${inListCount} list${inListCount > 1 ? "s" : ""}` : "Add to List"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {loading ? (
          <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
        ) : lists.length === 0 ? (
          <>
            <DropdownMenuItem disabled className="text-muted-foreground">
              No lists yet
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/account")}>
              Create a list →
            </DropdownMenuItem>
          </>
        ) : (
          <>
            {lists.map((list) => (
              <DropdownMenuItem
                key={list.id}
                onClick={() => toggleItem(list.id, list.hasItem)}
                className="flex items-center justify-between"
              >
                <span>{list.name}</span>
                {list.hasItem && (
                  <span className="text-[10px] font-bold text-accent-green">✓</span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/account")}>
              Manage lists →
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
