import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { getSession, homeFor } from '../lib/access'
import { authClient } from '../lib/auth'
import { text } from '../lib/forms'
import { Feedback } from '../components/ui'

const Login = () => {
  const router = useRouter()
  const queryClient = useQueryClient()
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
    <main className="login">
      <div className="auth-panel">
        <p className="wordmark">recurron</p>
        <h1>Sign in</h1>
        <p className="muted">Use your Recurron account to continue.</p>
        <form
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
          <fieldset disabled={login.isPending}>
            <label className="field">
              Email
              <input
                autoComplete="username"
                name="email"
                required
                type="email"
              />
            </label>
            <label className="field">
              Password
              <input
                autoComplete="current-password"
                name="password"
                required
                type="password"
              />
            </label>
            <button className="primary" type="submit">
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </fieldset>
          <Feedback error={login.error} />
        </form>
      </div>
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
