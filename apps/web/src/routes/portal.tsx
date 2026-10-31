import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '../lib/access'
import { Logout } from '../components/shell'

export const Route = createFileRoute('/portal')({
  beforeLoad: async () => {
    await requireSession()
  },
  component: () => (
    <main className="auth-panel">
      <p className="wordmark">recurron</p>
      <h1>You’re signed in</h1>
      <p className="muted">
        The customer portal is not available yet. Your account does not provide
        access to the internal workspace.
      </p>
      <Logout />
    </main>
  ),
})
