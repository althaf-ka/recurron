import { CircleAlertIcon, CircleCheckIcon, SearchIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useId } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field as FieldRoot,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Pagination as PaginationRoot,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination'
import { text } from '../lib/forms'

export const Feedback = ({
  error,
  message,
}: {
  error?: unknown
  message?: string
}) => {
  if (error !== undefined && error !== null) {
    return (
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          {error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again.'}
        </AlertDescription>
      </Alert>
    )
  }
  return message === undefined ? null : (
    <Alert className="border-success/25 bg-success/10 text-success">
      <CircleCheckIcon />
      <AlertDescription className="text-success/90">{message}</AlertDescription>
    </Alert>
  )
}

export const Field = ({
  label,
  name,
  errors,
  description,
  children,
}: {
  children: ReactNode
  description?: string
  errors?: Record<string, string>
  label: string
  name: string
}) => {
  const error = errors?.[name]
  return (
    <FieldRoot data-invalid={error === undefined ? undefined : true}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      {children}
      {description === undefined ? null : (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {error === undefined ? null : (
        <FieldError id={`${name}-error`}>{error}</FieldError>
      )}
    </FieldRoot>
  )
}

export const Check = ({
  name,
  label,
  checked,
  description,
}: {
  checked: boolean
  description?: string
  label: string
  name: string
}) => (
  <FieldRoot orientation="horizontal">
    <Checkbox defaultChecked={checked} id={name} name={name} />
    <div className="flex flex-col gap-0.5">
      <FieldLabel className="font-normal" htmlFor={name}>
        {label}
      </FieldLabel>
      {description === undefined ? null : (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  </FieldRoot>
)

export const Status = ({ active }: { active: boolean }) => (
  <Badge variant={active ? 'success' : 'outline'}>
    <span
      aria-hidden="true"
      className={`size-1.5 rounded-full ${active ? 'bg-success' : 'bg-muted-foreground'}`}
    />
    {active ? 'Active' : 'Inactive'}
  </Badge>
)

export const Search = ({
  onSearch,
  label,
  value,
}: {
  label: string
  onSearch: (search: string) => void
  value: string
}) => {
  const id = useId()
  return (
    <search className="w-full sm:max-w-sm">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          onSearch(text(data, 'search'))
        }}
      >
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            defaultValue={value}
            id={id}
            name="search"
            placeholder={label}
            type="search"
          />
          <Button size="sm" type="submit" variant="ghost">
            Search
          </Button>
        </InputGroup>
      </form>
    </search>
  )
}

const pageSize = 20

export const Pagination = ({
  page,
  total,
  onPage,
  busy,
}: {
  busy: boolean
  onPage: (page: number) => void
  page: number
  total: number
}) => {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        {total} {total === 1 ? 'record' : 'records'} · Page {page} of {pages}
      </p>
      <PaginationRoot className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <Button
              disabled={page === 1 || busy}
              onClick={() => {
                onPage(page - 1)
              }}
              size="sm"
              variant="outline"
            >
              Previous
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              disabled={page >= pages || busy}
              onClick={() => {
                onPage(page + 1)
              }}
              size="sm"
              variant="outline"
            >
              Next
            </Button>
          </PaginationItem>
        </PaginationContent>
      </PaginationRoot>
    </div>
  )
}

export const ConfirmArchive = ({
  name,
  pending,
  onConfirm,
}: {
  name: string
  onConfirm: () => void
  pending: boolean
}) => (
  <AlertDialog>
    <AlertDialogTrigger
      render={<Button size="sm" variant="ghost" />}
      disabled={pending}
    >
      Archive
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Archive {name}?</AlertDialogTitle>
        <AlertDialogDescription>
          Archived records stay in your history but can no longer be selected
          for new subscriptions.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <AlertDialogCancel
          disabled={pending}
          onClick={onConfirm}
          variant="destructive"
        >
          {pending ? 'Archiving…' : 'Archive'}
        </AlertDialogCancel>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)

export const editorTitle = (
  label: string,
  id: string | null,
  editable: boolean,
) => {
  if (id === null) {
    return `New ${label}`
  }
  if (editable) {
    return `Edit ${label}`
  }
  return `${label[0]?.toUpperCase()}${label.slice(1)} details`
}
