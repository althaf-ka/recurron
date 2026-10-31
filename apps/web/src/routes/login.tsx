import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { CheckIcon, EyeIcon, EyeOffIcon, LockKeyholeIcon } from 'lucide-react'
import { useState } from 'react'
import { Brand } from '@/components/app/brand'
import { ModeToggle } from '@/components/app/mode-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Feedback, Field } from '../components/shared'
import { getSession, homeFor } from '../lib/access'
import { authClient } from '../lib/auth'
import { text } from '../lib/forms'

const features = [
  'One directory for customers, products, and plans.',
  'A clear lifecycle from draft to active billing.',
  'Role-aware access for admins and staff.',
]

const Login = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)
  const login = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const result = await authClient.signIn.email(credentials)
      if (result.error) {
        throw new Error(
          result.error.message ??
            'Unable to sign in. Check your email and password.',
        )
      }
      const session = await getSession()
      if (!session) {
        throw new Error('Sign-in could not be completed. Please try again.')
      }
      return homeFor(session.user.role)
    },
    onSuccess: async (to) => {
      queryClient.clear()
      await router.navigate({ replace: true, to })
    },
  })

  return (
    <main className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-neutral-950 p-10 text-neutral-50 lg:flex xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 size-[28rem] rounded-full bg-white/[0.06] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-56 -left-24 size-[32rem] rounded-full bg-white/[0.04] blur-3xl"
        />
        <Brand className="relative" inverted />
        <div className="relative max-w-md space-y-6">
          <Badge
            className="border-white/15 bg-white/5 text-white/70"
            variant="outline"
          >
            Subscription operations
          </Badge>
          <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance xl:text-5xl">
            Recurring revenue, under control.
          </h1>
          <p className="text-base leading-relaxed text-neutral-400 text-pretty">
            Run customers, catalog, plans, and subscriptions from one calm,
            focused workspace.
          </p>
          <ul className="space-y-3 pt-2">
            {features.map((feature) => (
              <li
                className="flex items-center gap-3 text-sm text-neutral-300"
                key={feature}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5">
                  <CheckIcon aria-hidden="true" className="size-3.5" />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-neutral-500">
          <LockKeyholeIcon aria-hidden="true" className="size-3.5" />
          Access is limited to authorised team members.
        </div>
      </section>

      <section className="relative flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="absolute top-4 right-4">
          <ModeToggle />
        </div>
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-6">
            <Brand className="lg:hidden" />
            <div className="space-y-2">
              <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                Welcome back
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                Sign in to Recurron
              </h2>
              <p className="text-sm text-muted-foreground">
                Use your Recurron account to continue to the workspace.
              </p>
            </div>
          </div>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              if (login.isPending) {
                return
              }
              const data = new FormData(event.currentTarget)
              const password = data.get('password')
              login.mutate({
                email: text(data, 'email'),
                password: typeof password === 'string' ? password : '',
              })
            }}
          >
            <fieldset className="space-y-4" disabled={login.isPending}>
              <Field label="Email" name="email">
                <Input
                  autoComplete="username"
                  id="email"
                  name="email"
                  placeholder="you@company.com"
                  required
                  type="email"
                />
              </Field>
              <Field label="Password" name="password">
                <div className="relative">
                  <Input
                    autoComplete="current-password"
                    className="pr-9"
                    id="password"
                    name="password"
                    required
                    type={showPassword ? 'text' : 'password'}
                  />
                  <Button
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    className="absolute top-1/2 right-0.5 -translate-y-1/2"
                    onClick={() => {
                      setShowPassword((current) => !current)
                    }}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </Button>
                </div>
              </Field>
              <Button className="w-full" size="lg" type="submit">
                {login.isPending ? <Spinner data-icon="inline-start" /> : null}
                {login.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
            </fieldset>
            <Feedback error={login.error} />
          </form>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Need access? Ask your administrator to invite your email address.
          </p>
        </div>
      </section>
    </main>
  )
}

export const Route = createFileRoute('/login')({
  beforeLoad: async (): Promise<void> => {
    const session = await getSession()
    if (session) {
      redirect({
        replace: true,
        throw: true,
        to: homeFor(session.user.role),
      })
    }
  },
  component: Login,
})
