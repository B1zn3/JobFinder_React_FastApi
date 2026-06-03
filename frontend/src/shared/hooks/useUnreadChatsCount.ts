import { useQuery } from '@tanstack/react-query'
import { http } from '../api/http'
import { authSession } from '../auth/session'

type ChatUnreadCountResponse = {
  unread_count: number
}

const fetchUnreadChatsCount = async () => {
  const { data } = await http.get<ChatUnreadCountResponse>('/chats/unread-count')

  return Number(data?.unread_count || 0)
}

export const useUnreadChatsCount = () => {
  const token = authSession.getAccessToken?.()
  const role = authSession.getRole?.()

  const canLoadUnreadCount = Boolean(
    token && (role === 'applicant' || role === 'company'),
  )

  return useQuery({
    queryKey: ['chat-unread-count'],
    queryFn: fetchUnreadChatsCount,
    enabled: canLoadUnreadCount,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 1000,
    retry: 1,
  })
}