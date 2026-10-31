import { ChevronsUpDownIcon, LogOutIcon, ShieldCheckIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { initials } from '@/lib/format'

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrator',
  CUSTOMER: 'Customer',
  STAFF: 'Staff',
}

export const UserMenu = ({
  email,
  name,
  onSignOut,
  role,
  signingOut,
}: {
  email: string
  name: string
  onSignOut: () => void
  role: string | null | undefined
  signingOut: boolean
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <Button
          className="h-auto w-full justify-start gap-2 px-1.5 py-1.5"
          variant="ghost"
        />
      }
    >
      <Avatar size="sm">
        <AvatarFallback className="bg-foreground text-[11px] font-medium text-background">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{email}</span>
      </span>
      <ChevronsUpDownIcon className="ml-auto size-3.5 text-muted-foreground group-data-[collapsible=icon]:hidden" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-60" side="top">
      <DropdownMenuGroup>
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{name}</span>
          <span className="truncate text-xs font-normal">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5 py-1.5 font-normal">
          <ShieldCheckIcon />
          {roleLabels[role ?? ''] ?? role ?? 'Member'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onClick={onSignOut}
          variant="destructive"
        >
          <LogOutIcon />
          {signingOut ? 'Signing out…' : 'Log out'}
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
)
