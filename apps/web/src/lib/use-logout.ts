import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { authClient } from './auth'

export const useLogout = () => {
  const client = useQueryClient()
  const router = useRouter()
  return useMutation({
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
}
