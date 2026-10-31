import type { ReactNode } from 'react'
import { useId, useState } from 'react'
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
      <p className="feedback error" role="alert">
        {error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'}
      </p>
    )
  }
  return message === undefined ? null : (
    <output className="feedback">{message}</output>
  )
}

export const Field = ({
  label,
  name,
  errors,
  children,
}: {
  children: ReactNode
  errors?: Record<string, string>
  label: string
  name: string
}) => {
  const error = errors?.[name]
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children}
      {error === undefined ? null : (
        <span className="field-error" id={`${name}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export const Check = ({
  name,
  label,
  checked,
}: {
  checked: boolean
  label: string
  name: string
}) => (
  <label className="check">
    <input defaultChecked={checked} name={name} type="checkbox" />
    {label}
  </label>
)

export const Status = ({ active }: { active: boolean }) => (
  <span className={active ? 'badge active' : 'badge'}>
    {active ? 'Active' : 'Inactive'}
  </span>
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
    <search>
      <form
        className="search"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          onSearch(text(data, 'search'))
        }}
      >
        <label className="sr-only" htmlFor={id}>
          {label}
        </label>
        <input
          defaultValue={value}
          id={id}
          name="search"
          placeholder={label}
          type="search"
        />
        <button type="submit">Search</button>
      </form>
    </search>
  )
}

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
}) => (
  <nav aria-label="Pagination" className="pagination">
    <span>
      {total} records · Page {page} of {Math.max(1, Math.ceil(total / 20))}
    </span>
    <div className="actions">
      <button
        disabled={page === 1 || busy}
        onClick={() => {
          onPage(page - 1)
        }}
        type="button"
      >
        Previous
      </button>
      <button
        disabled={page * 20 >= total || busy}
        onClick={() => {
          onPage(page + 1)
        }}
        type="button"
      >
        Next
      </button>
    </div>
  </nav>
)

export const ConfirmArchive = ({
  name,
  pending,
  onConfirm,
}: {
  name: string
  onConfirm: () => void
  pending: boolean
}) => {
  const [confirm, setConfirm] = useState(false)
  if (!confirm) {
    return (
      <button
        disabled={pending}
        onClick={() => {
          setConfirm(true)
        }}
        type="button"
      >
        Archive
      </button>
    )
  }
  return (
    <div className="actions">
      <span>Archive {name}?</span>
      <button disabled={pending} onClick={onConfirm} type="button">
        {pending ? 'Archiving…' : 'Confirm archive'}
      </button>
      <button
        disabled={pending}
        onClick={() => {
          setConfirm(false)
        }}
        type="button"
      >
        Cancel
      </button>
    </div>
  )
}

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
