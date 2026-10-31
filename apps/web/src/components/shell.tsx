import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, Outlet, useRouter } from '@tanstack/react-router'
import { can, homeFor } from '../lib/access'
import { authClient } from '../lib/auth'
import { Feedback } from './ui'

export const Logout = () => {
  const client = useQueryClient()
  const router = useRouter()
  const logout = useMutation({
    mutationFn: async () => {
      const result = await authClient.signOut()
      if (result.error) {
        throw new Error(
          result.error.message ?? 'Unable to sign out. Please try again.',
        )
      }
    },
    onSuccess: async () => {
      await client.cancelQueries()
      client.clear()
      await router.navigate({ replace: true, to: '/login' })
    },
  })
  return (
    <div>
      <button
        disabled={logout.isPending}
        onClick={() => {
          logout.mutate()
        }}
        type="button"
      >
        {logout.isPending ? 'Signing out…' : 'Log out'}
      </button>
      <Feedback error={logout.error} />
    </div>
  )
}

export const Shell = ({ area }: { area: 'admin' | 'app' }) => {
  const session = authClient.useSession()
  if (session.isPending) {
    return <output className="page-loading">Loading your workspace…</output>
  }
  if (session.error) {
    return (
      <main className="auth-panel">
        <Feedback
          error={
            new Error('Unable to check your session. Reload to try again.')
          }
        />
        <Logout />
      </main>
    )
  }
  if (!session.data) {
    return <Navigate replace to="/login" />
  }
  const permissions =
    area === 'admin'
      ? { product: ['create' as const] }
      : { customer: ['read' as const] }
  if (!can(session.data.user.role, permissions)) {
    return <Navigate replace to={homeFor(session.data.user.role)} />
  }
  const root = area === 'admin' ? '/admin' : '/app'
  const navigation =
    area === 'admin'
      ? (['overview', 'products', 'plans', 'customers'] as const)
      : (['overview', 'customers', 'products', 'plans'] as const)
  const labels = {
    customers: 'Customers',
    overview: 'Overview',
    plans: 'Plans',
    products: 'Products',
  }

  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link className="wordmark" to={root}>
          recurron
          <span>{area === 'admin' ? 'Administration' : 'Staff workspace'}</span>
        </Link>
        <nav
          aria-label={area === 'admin' ? 'Administration' : 'Staff workspace'}
        >
          {navigation.map((item) => (
            <Link
              activeOptions={{ exact: true }}
              key={item}
              to={item === 'overview' ? root : `${root}/${item}`}
            >
              {labels[item]}
              {area === 'app' && (item === 'products' || item === 'plans') ? (
                <small>Read only</small>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="account">
          <span>{session.data.user.name}</span>
          <small>{session.data.user.email}</small>
          <Logout />
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

export const Overview = ({ area }: { area: 'admin' | 'app' }) => (
  <section>
    <p className="eyebrow">
      {area === 'admin' ? 'Business control' : 'Daily operations'}
    </p>
    <h1>{area === 'admin' ? 'Administration' : 'Customer workspace'}</h1>
    <p className="muted">
      {area === 'admin'
        ? 'Manage your catalog, plan policies, and customer directory.'
        : 'Find and update customers, and consult the current product and plan catalog.'}
    </p>
    <div className="overview-links">
      <Link to={area === 'admin' ? '/admin/customers' : '/app/customers'}>
        Open customer directory <span aria-hidden="true">→</span>
      </Link>
      {area === 'admin' ? (
        <>
          <Link to="/admin/products">
            Manage products <span aria-hidden="true">→</span>
          </Link>
          <Link to="/admin/plans">
            Manage plans <span aria-hidden="true">→</span>
          </Link>
        </>
      ) : null}
    </div>
  </section>
)
