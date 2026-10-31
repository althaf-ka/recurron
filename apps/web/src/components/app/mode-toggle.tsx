import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
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
import { useTheme } from '@/lib/theme'

const themes = [
  { icon: SunIcon, label: 'Light', value: 'light' },
  { icon: MoonIcon, label: 'Dark', value: 'dark' },
  { icon: MonitorIcon, label: 'System', value: 'system' },
] as const

export const ModeToggle = () => {
  const { setTheme, theme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label="Change theme" size="icon" variant="ghost" />
        }
      >
        <SunIcon className="transition-transform dark:hidden" />
        <MoonIcon className="hidden transition-transform dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {themes.map(({ icon: Icon, label, value }) => (
            <DropdownMenuItem
              key={value}
              onClick={() => {
                setTheme(value)
              }}
            >
              <Icon />
              {label}
              {theme === value ? <CheckIcon className="ml-auto" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
