import { useQuery } from '@tanstack/react-query'
import { http } from '../api/http'
import { authSession } from '../auth/session'

type ChatUnreadCountResponse = {
  unread_count: number
}

const fetchUnreadChatsCount = async (signal?: AbortSignal) => {
  if (!authSession.getAccessToken() || authSession.isLoggedOut()) {
    return 0
  }

  const { data } = await http.get<ChatUnreadCountResponse>(
    '/chats/unread-count',
    { signal },
  )

  return Number(data?.unread_count || 0)
}

export const useUnreadChatsCount = () => {
  const token = authSession.getAccessToken?.()
  const role = authSession.getRole?.()

  const canLoadUnreadCount = Boolean(
    token &&
      !authSession.isLoggedOut() &&
      (role === 'applicant' || role === 'company'),
  )

  return useQuery({
    queryKey: ['chat-unread-count'],
    queryFn: ({ signal }) => fetchUnreadChatsCount(signal),
    enabled: canLoadUnreadCount,
    refetchInterval: canLoadUnreadCount ? 5000 : false,
    refetchIntervalInBackground: false,
    staleTime: 1000,
    retry: false,
  })
}