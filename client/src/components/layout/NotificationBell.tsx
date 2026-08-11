import { Bell, CheckCheck, Inbox, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useInAppNotifications } from '@/hooks/useInAppNotifications'
import { formatDateId } from '@/utils/format-date'

export function NotificationBell() {
  const { items, unreadCount, loading, reload, markRead, markAllRead } =
    useInAppNotifications(10)

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void reload()
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full bg-surface-muted p-0 text-primary transition-colors hover:bg-border"
          aria-label={
            unreadCount > 0
              ? `${unreadCount} notifikasi belum dibaca`
              : 'Notifikasi'
          }
        >
          <Bell className="h-4 w-4" strokeWidth={1.5} />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-1rem)] p-0">
        <DropdownMenuLabel className="flex items-center justify-between gap-3 px-3 py-2">
          <span>Notifikasi</span>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-medium text-primary hover:bg-surface-muted"
              onClick={() => void markAllRead()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Tandai dibaca
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[26rem] overflow-y-auto p-1">
          {loading && items.length === 0 ? (
            <div className="flex min-h-24 items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-24 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
              <Inbox className="h-5 w-5" strokeWidth={1.5} />
              <span>Tidak ada notifikasi aktif</span>
            </div>
          ) : (
            items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="items-start gap-2 px-2 py-2"
                onSelect={() => {
                  if (!item.readAt) void markRead(item.id)
                }}
              >
                <span
                  className={
                    item.readAt
                      ? 'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-border'
                      : 'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary'
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block whitespace-normal text-xs leading-5 text-secondary-foreground">
                    {item.preview}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {formatDateId(item.createdAt)}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
