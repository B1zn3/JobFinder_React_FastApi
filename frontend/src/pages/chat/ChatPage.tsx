import axios from 'axios'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Header } from '../../shared/ui/Header'
import { http } from '../../shared/api/http'
import { authSession } from '../../shared/auth/session'
import { useOnlineUserIds } from '../../shared/hooks/usePresenceSocket'
import './chat.css'

type RoleValue = 'applicant' | 'company' | 'admin' | string
type ApplicationDecisionStatus = 'accepted' | 'rejected'


type ChatUser = {
  id: number
  email?: string | null
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  middle_name?: string | null
  full_name?: string | null
  avatar_url?: string | null
  photo_url?: string | null
  image_url?: string | null
  is_online?: boolean
  last_seen_at?: string | null
}

type ChatAttachment = {
  id: number
  file_url: string
  file_name?: string | null
  file_type?: string | null
  file_size?: number | null
  created_at?: string | null
}

type ChatMessage = {
  id: number
  chat_id: number
  sender_id: number
  text?: string | null
  created_at: string
  read_at?: string | null
  sender?: ChatUser | null
  attachments?: ChatAttachment[]
}

type ChatResumeInfo = {
  id?: number | null
  title?: string | null
  profession_name?: string | null
  profession?: {
    id?: number | null
    name?: string | null
  } | null
  applicant_name?: string | null
  applicant_full_name?: string | null
  applicant?: ChatUser | null
}

type ChatVacancyInfo = {
  id?: number | null
  title?: string | null
  company_name?: string | null
  profession_name?: string | null
  company_logo_url?: string | null
  logo_url?: string | null
  image_url?: string | null
  status_id?: number | null
  status_name?: string | null
}

type ChatApplication = {
  id: number
  vacancy_id: number
  resume_id: number
  status: string
  created_at: string

  vacancy_title?: string | null
  resume_title?: string | null
  profession_name?: string | null
  applicant_name?: string | null
  applicant_full_name?: string | null

  vacancy?: ChatVacancyInfo | null
  resume?: ChatResumeInfo | null
  applicant?: ChatUser | null
}

type ChatListItem = {
  id: number
  application_id: number
  created_at: string
  application?: ChatApplication | null
  last_message?: ChatMessage | null
  unread_count?: number
  companion?: ChatUser | null
  can_write?: boolean
  is_rejected?: boolean
  lock_reason?: string | null
}

type ChatDetail = {
  id: number
  application_id: number
  created_at: string
  application?: ChatApplication | null
  messages: ChatMessage[]
  companion?: ChatUser | null
  can_write?: boolean
  is_rejected?: boolean
  lock_reason?: string | null
}

type ChatSocketMessagePayload = {
  type: 'message'
  message: ChatMessage
}

type ChatSocketConnectedPayload = {
  type: 'connected'
  chat_id: number
  user_id: number
  message?: string
}

type ChatSocketReadPayload = {
  type: 'read'
  chat_id: number
  user_id: number
  read_messages_count: number
  read_at: string
}

type ChatSocketUserOnlinePayload = {
  type: 'user_online'
  user_id: number
  is_online: boolean
  last_seen_at?: string | null
}

type ChatSocketErrorPayload = {
  type: 'error'
  detail?: string
}

type ChatSocketPongPayload = {
  type: 'pong'
}

type ChatSocketPayload =
  | ChatSocketMessagePayload
  | ChatSocketConnectedPayload
  | ChatSocketReadPayload
  | ChatSocketUserOnlinePayload
  | ChatSocketErrorPayload
  | ChatSocketPongPayload

type ApiErrorResponse = {
  detail?: string | { message?: string; error?: string } | Array<{ msg?: string }>
  message?: string
  error?: string
}

const getAccessToken = () => {
  return (
    authSession.getAccessToken?.() ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    ''
  )
}

const getCurrentRole = (): RoleValue => {
  return (
    authSession.getRole?.() ||
    localStorage.getItem('role') ||
    ''
  ).toLowerCase()
}

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payloadPart = token.split('.')[1]

    if (!payloadPart) return null

    const normalizedPayload = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    )

    const decoded = window.atob(paddedPayload)
    const json = decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    )

    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

const getCurrentUserId = () => {
  const raw =
    localStorage.getItem('user_id') ||
    localStorage.getItem('userId') ||
    localStorage.getItem('current_user_id') ||
    ''

  const idFromStorage = Number(raw)

  if (Number.isFinite(idFromStorage) && idFromStorage > 0) {
    return idFromStorage
  }

  const token = getAccessToken()
  const payload = token ? decodeJwtPayload(token) : null
  const sub = payload?.sub

  const idFromToken = Number(sub)

  return Number.isFinite(idFromToken) && idFromToken > 0 ? idFromToken : null
}

const getWsBaseUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

  return apiUrl
    .replace(/^http:/, 'ws:')
    .replace(/^https:/, 'wss:')
    .replace(/\/api\/v1\/?$/, '')
}

const normalizeArrayResponse = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[]

  if (data && typeof data === 'object') {
    const payload = data as {
      items?: unknown[]
      results?: unknown[]
      data?: unknown[]
      chats?: unknown[]
    }

    if (Array.isArray(payload.items)) return payload.items as T[]
    if (Array.isArray(payload.results)) return payload.results as T[]
    if (Array.isArray(payload.data)) return payload.data as T[]
    if (Array.isArray(payload.chats)) return payload.chats as T[]
  }

  return []
}

const fetchChats = async (): Promise<ChatListItem[]> => {
  const { data } = await http.get('/chats', {
    params: {
      skip: 0,
      limit: 100,
    },
  })

  return normalizeArrayResponse<ChatListItem>(data)
}

const fetchChatDetail = async (chatId: number): Promise<ChatDetail> => {
  const { data } = await http.get(`/chats/${chatId}`)

  return {
    ...data,
    messages: Array.isArray(data?.messages) ? data.messages : [],
  }
}

const sendChatAttachments = async (payload: {
  chatId: number
  text: string
  files: File[]
  onProgress?: (progress: number) => void
}): Promise<ChatMessage> => {
  const formData = new FormData()
  const text = payload.text.trim()

  if (text) {
    formData.append('text', text)
  }

  payload.files.forEach((file) => {
    formData.append('files', file)
  })

  const { data } = await http.post(
    `/chats/${payload.chatId}/messages/attachments`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (event) => {
        if (!payload.onProgress) return
        const total = event.total || 0
        if (!total) return
        payload.onProgress(Math.min(100, Math.round((event.loaded * 100) / total)))
      },
    },
  )

  return data
}

const updateApplicationStatus = async (payload: {
  applicationId: number
  status: ApplicationDecisionStatus
  message: string
}) => {
  const trimmedMessage = payload.message.trim()

  const dataPayload: {
    status: ApplicationDecisionStatus
    chat_message?: string
    interview_message?: string
    rejection_message?: string
  } = {
    status: payload.status,
    chat_message: trimmedMessage,
  }

  if (payload.status === 'accepted') {
    dataPayload.interview_message = trimmedMessage
  }

  if (payload.status === 'rejected') {
    dataPayload.rejection_message = trimmedMessage
  }

  const { data } = await http.patch(
    `/companies/me/applications/${payload.applicationId}/status`,
    dataPayload,
    {
      params: {
        period_days: 30,
      },
    },
  )

  return data
}

const getDecisionDefaultMessage = (payload: {
  status: ApplicationDecisionStatus
  applicantName: string
  vacancyTitle: string
}) => {
  if (payload.status === 'accepted') {
    return `Здравствуйте, ${payload.applicantName}!\n\nБлагодарим Вас за отклик на вакансию "${payload.vacancyTitle}". Ваше резюме показалось нам интересным. Хотим пригласить Вас на следующий этап.`
  }

  return `Здравствуйте, ${payload.applicantName}!\n\nБольшое спасибо за интерес к нашей компании. К сожалению, сейчас мы не готовы пригласить Вас на следующий этап. Ценим Ваше внимание и будем рады взаимодействию в будущем.`
}

const ApplicationStatusMessageModal = ({
  status,
  applicantName,
  resumeTitle,
  vacancyTitle,
  isPending,
  errorText,
  onClose,
  onSubmit,
}: {
  status: ApplicationDecisionStatus
  applicantName: string
  resumeTitle: string
  vacancyTitle: string
  isPending: boolean
  errorText?: string
  onClose: () => void
  onSubmit: (message: string) => void
}) => {
  const isAccepted = status === 'accepted'
  const [message, setMessage] = useState(() =>
    getDecisionDefaultMessage({
      status,
      applicantName,
      vacancyTitle,
    }),
  )

  useEffect(() => {
    const previousOverflow = document.body.style.overflow

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) {
        onClose()
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isPending, onClose])

  const trimmedMessage = message.trim()
  const modalTitle = isAccepted ? 'Приглашение на собеседование' : 'Отказ кандидату'
  const previewTitle = isAccepted ? 'Собеседование' : 'Отказ'
  const fieldLabel = isAccepted ? 'Текст приглашения' : 'Причина отказа'
  const placeholder = isAccepted
    ? 'Напишите приглашение кандидату'
    : 'Напишите причину отказа для кандидата'

  return (
    <div
      className="chat-status-modal-overlay"
      onMouseDown={isPending ? undefined : onClose}
    >
      <section
        className={`chat-status-modal ${isAccepted ? 'is-accepted' : 'is-rejected'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-status-message-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="chat-status-modal__header">
          <div>
            <p>{modalTitle}</p>
            <h2 id="chat-status-message-modal-title">{applicantName}</h2>
            <span>{resumeTitle}</span>
          </div>

          <button
            type="button"
            className="chat-status-modal__close"
            onClick={onClose}
            disabled={isPending}
            aria-label="Закрыть"
          >
            <RejectIcon />
          </button>
        </div>

        <div className="chat-status-modal__body">
          <div className="chat-status-preview">
            <strong>В чат будет отправлено:</strong>
            <div>
              <b>{previewTitle}</b>
              <p>{trimmedMessage || 'Текст сообщения пока не указан.'}</p>
            </div>
          </div>

          <label className="chat-status-field">
            <span>{fieldLabel}</span>
            <textarea
              value={message}
              maxLength={5000}
              placeholder={placeholder}
              onChange={(event) => setMessage(event.target.value)}
            />
            <small>{message.length}/5000</small>
          </label>

          {errorText ? (
            <div className="chat-status-modal__error">{errorText}</div>
          ) : null}
        </div>

        <div className="chat-status-modal__footer">
          <button
            type="button"
            className="chat-status-btn chat-status-btn--outline"
            onClick={onClose}
            disabled={isPending}
          >
            Отмена
          </button>

          <button
            type="button"
            className={isAccepted ? 'chat-status-btn chat-status-btn--success' : 'chat-status-btn chat-status-btn--danger'}
            disabled={isPending || !trimmedMessage}
            onClick={() => onSubmit(trimmedMessage)}
          >
            {isPending
              ? 'Отправляем...'
              : isAccepted
                ? 'Пригласить и отправить'
                : 'Отказать и отправить'}
          </button>
        </div>
      </section>
    </div>
  )
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) return fallback

  const data = error.response?.data

  if (!error.response) return 'Нет соединения с сервером.'

  if (Array.isArray(data?.detail)) {
    return data.detail[0]?.msg || fallback
  }

  if (typeof data?.detail === 'string') return data.detail

  if (data?.detail && typeof data.detail === 'object') {
    return data.detail.message || data.detail.error || fallback
  }

  if (error.response.status === 422) {
    return 'Не удалось отправить сообщение. Проверьте текст или файл.'
  }

  return data?.message || data?.error || fallback
}

const formatTime = (value?: string | null) => {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getDateKey = (value?: string | null) => {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

const isSameCalendarDay = (left: Date, right: Date) => {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

const formatChatDateLabel = (value?: string | null) => {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (isSameCalendarDay(date, today)) return 'Сегодня'
  if (isSameCalendarDay(date, yesterday)) return 'Вчера'

  const isCurrentYear = date.getFullYear() === today.getFullYear()
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    ...(isCurrentYear ? {} : { year: 'numeric' as const }),
  }

  return date.toLocaleDateString('ru-RU', options)
}

const formatMessageTimestamp = (value?: string | null) => {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const time = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isSameCalendarDay(date, today)) return time
  if (isSameCalendarDay(date, yesterday)) return `Вчера, ${time}`

  const isCurrentYear = date.getFullYear() === today.getFullYear()
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    ...(isCurrentYear ? {} : { year: 'numeric' as const }),
  }
  const day = date.toLocaleDateString('ru-RU', options)

  return `${day}, ${time}`
}

const formatFileSize = (value?: number | null) => {
  const size = Number(value || 0)

  if (!size) return ''
  if (size < 1024) return `${size} Б`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`

  return `${(size / 1024 / 1024).toFixed(1)} МБ`
}

const getInitials = (value?: string | null) => {
  const text = String(value || '').trim()

  if (!text) return 'JF'

  return text
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
const getAvatarUrlFromUser = (user?: ChatUser | null) => {
  return user?.avatar_url || user?.photo_url || user?.image_url || ''
}

const getCompanyLogoUrl = (application?: ChatApplication | null) => {
  return (
    application?.vacancy?.company_logo_url ||
    application?.vacancy?.logo_url ||
    application?.vacancy?.image_url ||
    ''
  )
}

const getChatAvatarUrl = (payload: {
  role: RoleValue
  application?: ChatApplication | null
  companion?: ChatUser | null
}) => {
  if (payload.role === 'company') {
    return getAvatarUrlFromUser(payload.companion)
  }

  return getCompanyLogoUrl(payload.application) || getAvatarUrlFromUser(payload.companion)
}

const PaperclipIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M21.44 11.05l-8.49 8.49a6 6 0 11-8.49-8.49l9.19-9.2a4 4 0 115.66 5.66l-9.2 9.19a2 2 0 11-2.82-2.83l8.49-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const SpinnerIcon = () => (
  <span className="chat-spinner" aria-hidden="true" />
)

const RejectIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M14 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8l-5-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)


const isImageAttachment = (attachment: ChatAttachment) => {
  const type = attachment.file_type || ''
  const name = attachment.file_name || attachment.file_url || ''

  return type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name)
}

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== 'object') return false

  const message = value as Partial<ChatMessage>

  return (
    typeof message.id === 'number' &&
    typeof message.chat_id === 'number' &&
    typeof message.sender_id === 'number' &&
    typeof message.created_at === 'string'
  )
}

const parseChatSocketPayload = (value: unknown): ChatSocketPayload | null => {
  if (!value || typeof value !== 'object') return null

  const payload = value as Partial<ChatSocketPayload>

  if (payload.type === 'message') {
    const messagePayload = value as Partial<ChatSocketMessagePayload>

    if (!isChatMessage(messagePayload.message)) return null

    return messagePayload as ChatSocketMessagePayload
  }

  if (payload.type === 'connected') return payload as ChatSocketConnectedPayload
  if (payload.type === 'read') return payload as ChatSocketReadPayload

  if (payload.type === 'user_online') {
    const onlinePayload = value as Partial<ChatSocketUserOnlinePayload>

    if (typeof onlinePayload.user_id !== 'number') return null

    return onlinePayload as ChatSocketUserOnlinePayload
  }

  if (payload.type === 'error') return payload as ChatSocketErrorPayload
  if (payload.type === 'pong') return payload as ChatSocketPongPayload

  return null
}

const getUserDisplayName = (user?: ChatUser | null) => {
  if (!user) return ''

  const fullName =
    user.full_name ||
    user.name ||
    [user.last_name, user.first_name, user.middle_name].filter(Boolean).join(' ')

  return fullName.trim() || user.email || ''
}

const getResumeTitle = (application?: ChatApplication | null) => {
  if (!application) return ''

  return (
    application.resume_title ||
    application.resume?.title ||
    application.resume?.profession_name ||
    application.resume?.profession?.name ||
    application.profession_name ||
    (application.resume_id ? `Резюме #${application.resume_id}` : '')
  )
}

const getVacancyTitle = (application?: ChatApplication | null) => {
  if (!application) return ''

  return (
    application.vacancy_title ||
    application.vacancy?.title ||
    application.profession_name ||
    (application.vacancy_id ? `Вакансия #${application.vacancy_id}` : '')
  )
}

const getApplicantName = (
  application?: ChatApplication | null,
  companion?: ChatUser | null,
) => {
  if (!application) return getUserDisplayName(companion) || 'Соискатель'

  return (
    application.applicant_full_name ||
    application.applicant_name ||
    application.resume?.applicant_full_name ||
    application.resume?.applicant_name ||
    getUserDisplayName(application.applicant) ||
    getUserDisplayName(application.resume?.applicant) ||
    getUserDisplayName(companion) ||
    'Соискатель'
  )
}

const getChatTitle = (
  role: RoleValue,
  application?: ChatApplication | null,
  companion?: ChatUser | null,
) => {
  if (role === 'company') {
    return getApplicantName(application, companion)
  }

  return getVacancyTitle(application) || getUserDisplayName(companion) || 'Вакансия'
}

const getChatSubtitle = (
  role: RoleValue,
  application?: ChatApplication | null,
  companion?: ChatUser | null,
) => {
  if (role === 'company') {
    return getResumeTitle(application) || getUserDisplayName(companion) || 'Резюме соискателя'
  }

  return application?.vacancy?.company_name || getUserDisplayName(companion) || 'Работодатель'
}

const getCompanionFromMessages = (messages: ChatMessage[], currentUserId: number | null) => {
  if (!currentUserId) return messages.find((message) => message.sender)?.sender || null

  return (
    messages.find((message) => message.sender && message.sender_id !== currentUserId)?.sender ||
    messages.find((message) => message.sender)?.sender ||
    null
  )
}

const getVacancyLockState = (statusName?: string | null) => {
  const value = String(statusName || '').toLowerCase()

  const isDeleted =
    value.includes('удален') ||
    value.includes('удалена') ||
    value.includes('deleted')

  const isArchived =
    value.includes('архив') ||
    value.includes('archive')

  return {
    isDeleted,
    isArchived,
    isLocked: isDeleted || isArchived,
  }
}

export const ChatPage = () => {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const chatSocketRef = useRef<WebSocket | null>(null)

  const onlineUserIds = useOnlineUserIds()

  const [selectedChatId, setSelectedChatId] = useState<number | null>(null)
  const [messageText, setMessageText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sendError, setSendError] = useState('')
  const [chatOnlineUserIds, setChatOnlineUserIds] = useState<Set<number>>(new Set())
  const [isSocketReady, setIsSocketReady] = useState(false)
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploadingFiles, setIsUploadingFiles] = useState(false)
  const [decisionModal, setDecisionModal] = useState<{
    status: ApplicationDecisionStatus
    applicationId: number
  } | null>(null)

  const currentUserId = useMemo(() => getCurrentUserId(), [])
  const currentRole = useMemo(() => getCurrentRole(), [])
  const applicationIdParam = searchParams.get('application_id')
  const lastAppliedApplicationIdRef = useRef<number | null>(null)

  const clearApplicationIdParam = () => {
    if (!searchParams.has('application_id')) return

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('application_id')
    setSearchParams(nextParams, { replace: true })
  }

  const chatsQuery = useQuery({
    queryKey: ['user-chats'],
    queryFn: fetchChats,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const chatDetailQuery = useQuery({
    queryKey: ['user-chat-detail', selectedChatId],
    queryFn: () => fetchChatDetail(selectedChatId as number),
    enabled: Boolean(selectedChatId),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const sendAttachmentsMutation = useMutation({
    mutationFn: sendChatAttachments,
    onMutate: () => {
      setIsUploadingFiles(true)
      setUploadProgress(0)
      setSendError('')
    },
    onSuccess: async (createdMessage) => {
      setMessageText('')
      setFiles([])
      setSendError('')
      setIsUploadingFiles(false)
      setUploadProgress(0)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      if (selectedChatId) {
        queryClient.setQueryData<ChatDetail>(
          ['user-chat-detail', selectedChatId],
          (prev): ChatDetail | undefined => {
            if (!prev) return prev

            const exists = prev.messages.some((message) => message.id === createdMessage.id)

            if (exists) return prev

            return {
              ...prev,
              messages: [...prev.messages, createdMessage],
            }
          },
        )

        queryClient.setQueryData<ChatListItem[]>(
          ['user-chats'],
          (prev): ChatListItem[] | undefined => {
            if (!prev) return prev

            return prev.map((chat) => {
              if (chat.id !== createdMessage.chat_id) return chat

              return {
                ...chat,
                last_message: createdMessage,
              }
            })
          },
        )
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['user-chats'] }),
        queryClient.invalidateQueries({ queryKey: ['user-chat-detail', selectedChatId] }),
        queryClient.invalidateQueries({ queryKey: ['chat-unread-count'] }),
      ])
    },
    onError: (error) => {
      setIsUploadingFiles(false)
      setUploadProgress(0)
      setSendError(getErrorMessage(error, 'Не удалось отправить файл.'))
    },
    onSettled: () => {
      setIsUploadingFiles(false)
    },
  })

  const applicationDecisionMutation = useMutation({
    mutationFn: updateApplicationStatus,
    onSuccess: async () => {
      setDecisionModal(null)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['user-chats'] }),
        queryClient.invalidateQueries({ queryKey: ['user-chat-detail', selectedChatId] }),
        queryClient.invalidateQueries({ queryKey: ['company-applications'] }),
        queryClient.invalidateQueries({ queryKey: ['employer-applications'] }),
        queryClient.invalidateQueries({ queryKey: ['chat-unread-count'] }),
      ])
    },
    onError: (error) => {
      setSendError(getErrorMessage(error, 'Не удалось обновить статус отклика.'))
    },
  })

  const chats = chatsQuery.data || []
  const activeChat = chatDetailQuery.data || null

  const markChatAsReadInCaches = (chatId: number) => {
    let removedUnreadCount = 0

    queryClient.setQueryData<ChatListItem[]>(
      ['user-chats'],
      (prev): ChatListItem[] | undefined => {
        if (!prev) return prev

        return prev.map((chat) => {
          if (chat.id !== chatId) return chat

          removedUnreadCount = Number(chat.unread_count || 0)

          return {
            ...chat,
            unread_count: 0,
          }
        })
      },
    )

    if (removedUnreadCount > 0) {
      queryClient.setQueryData<number | { unread_count?: number }>(
        ['chat-unread-count'],
        (prev) => {
          if (typeof prev === 'number') {
            return Math.max(0, prev - removedUnreadCount)
          }

          if (prev && typeof prev === 'object') {
            return {
              ...prev,
              unread_count: Math.max(0, Number(prev.unread_count || 0) - removedUnreadCount),
            }
          }

          return prev
        },
      )
    }

    window.setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['chat-unread-count'] })
    }, 150)
  }


  const selectedChatFromList = useMemo(() => {
    return chats.find((chat) => chat.id === selectedChatId) || null
  }, [chats, selectedChatId])

  const activeApplication =
    activeChat?.application || selectedChatFromList?.application || null

  const applicationStatus = String(activeApplication?.status || '').toLowerCase()

  const isRejected =
    Boolean(activeChat?.is_rejected || selectedChatFromList?.is_rejected) ||
    applicationStatus === 'rejected' ||
    applicationStatus === 'отказ'

  const isAccepted =
    applicationStatus === 'accepted' ||
    applicationStatus === 'interview' ||
    applicationStatus === 'собеседование'

  const vacancyLock = getVacancyLockState(activeApplication?.vacancy?.status_name)

  const canWriteToChat =
    !isRejected &&
    !vacancyLock.isLocked &&
    (activeChat?.can_write ?? selectedChatFromList?.can_write ?? true)

  const chatLockReason =
    activeChat?.lock_reason ||
    selectedChatFromList?.lock_reason ||
    (isRejected
      ? 'Чат закрыт: работодатель отказал по отклику'
      : vacancyLock.isDeleted
        ? 'Чат закрыт: вакансия удалена'
        : vacancyLock.isArchived
          ? 'Чат закрыт: вакансия в архиве'
          : '')

  const companion =
    activeChat?.companion ||
    selectedChatFromList?.companion ||
    getCompanionFromMessages(activeChat?.messages || [], currentUserId)

  const title = getChatTitle(currentRole, activeApplication, companion)
  const subtitle = getChatSubtitle(currentRole, activeApplication, companion)
  const avatarUrl = getChatAvatarUrl({
    role: currentRole,
    application: activeApplication,
    companion,
  })

  const companionOnline = companion?.id
    ? chatOnlineUserIds.has(companion.id) ||
      onlineUserIds.has(companion.id) ||
      Boolean(companion.is_online)
    : false

  const actionLink =
    currentRole === 'company'
      ? activeApplication?.resume_id
        ? `/employer/candidates/resumes/${activeApplication.resume_id}`
        : ''
      : !vacancyLock.isLocked && activeApplication?.vacancy_id
        ? `/vacancies/${activeApplication.vacancy_id}`
        : ''

  const actionText = currentRole === 'company' ? 'Посмотреть резюме' : 'Перейти к вакансии'

  const openDecisionModal = (status: ApplicationDecisionStatus) => {
    if (!activeApplication?.id || applicationDecisionMutation.isPending) return

    setSendError('')
    setDecisionModal({
      status,
      applicationId: activeApplication.id,
    })
  }

  const closeDecisionModal = () => {
    if (applicationDecisionMutation.isPending) return

    setDecisionModal(null)
  }

  const confirmDecisionModal = (message: string) => {
    if (!decisionModal) return

    applicationDecisionMutation.mutate({
      ...decisionModal,
      message,
    })
  }

  useEffect(() => {
    if (!chats.length) {
      if (selectedChatId !== null) {
        setSelectedChatId(null)
      }
      return
    }

    const applicationIdFromUrl = Number(applicationIdParam || 0)

    if (Number.isFinite(applicationIdFromUrl) && applicationIdFromUrl > 0) {
      const targetChat = chats.find((chat) => {
        const directApplicationId = Number(chat.application_id || 0)
        const nestedApplicationId = Number(chat.application?.id || 0)

        return (
          directApplicationId === applicationIdFromUrl ||
          nestedApplicationId === applicationIdFromUrl
        )
      })

      if (targetChat) {
        lastAppliedApplicationIdRef.current = applicationIdFromUrl

        if (selectedChatId !== targetChat.id) {
          setSelectedChatId(targetChat.id)
        }

        setIsMobileChatOpen(true)
        markChatAsReadInCaches(targetChat.id)

        const nextParams = new URLSearchParams(searchParams)
        nextParams.delete('application_id')
        setSearchParams(nextParams, { replace: true })

        return
      }

      if (lastAppliedApplicationIdRef.current !== applicationIdFromUrl) {
        lastAppliedApplicationIdRef.current = applicationIdFromUrl
      }
    }

    if (selectedChatId && chats.some((chat) => chat.id === selectedChatId)) {
      return
    }

    setSelectedChatId(chats[0].id)
  }, [applicationIdParam, chats, searchParams, selectedChatId, setSearchParams])

  useEffect(() => {
    if (!selectedChatId) return

    markChatAsReadInCaches(selectedChatId)
  }, [selectedChatId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [activeChat?.messages.length, selectedChatId])

  useEffect(() => {
    const textarea = messageTextareaRef.current

    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [messageText])

  useEffect(() => {
    const token = getAccessToken()

    if (!token || !selectedChatId) return

    chatSocketRef.current?.close()
    setIsSocketReady(false)
    setSendError('')

    const wsBaseUrl = getWsBaseUrl()
    const socket = new WebSocket(
      `${wsBaseUrl}/api/v1/chats/${selectedChatId}/ws?token=${encodeURIComponent(token)}`,
    )

    chatSocketRef.current = socket

    const addMessageToCache = (incomingMessage: ChatMessage) => {
      queryClient.setQueryData<ChatDetail>(
        ['user-chat-detail', selectedChatId],
        (prev): ChatDetail | undefined => {
          if (!prev) return prev

          const exists = prev.messages.some((message) => message.id === incomingMessage.id)

          if (exists) return prev

          return {
            ...prev,
            messages: [...prev.messages, incomingMessage],
          }
        },
      )

      queryClient.setQueryData<ChatListItem[]>(
        ['user-chats'],
        (prev): ChatListItem[] | undefined => {
          if (!prev) return prev

          return prev.map((chat) => {
            if (chat.id !== incomingMessage.chat_id) return chat

            return {
              ...chat,
              last_message: incomingMessage,
              unread_count:
                incomingMessage.sender_id === currentUserId
                  ? chat.unread_count || 0
                  : chat.id === selectedChatId
                    ? 0
                    : (chat.unread_count || 0) + 1,
            }
          })
        },
      )
    }

    const markMessagesAsReadInCache = (readPayload: ChatSocketReadPayload) => {
      queryClient.setQueryData<ChatDetail>(
        ['user-chat-detail', selectedChatId],
        (prev): ChatDetail | undefined => {
          if (!prev) return prev

          return {
            ...prev,
            messages: prev.messages.map((message) => {
              if (message.sender_id === readPayload.user_id) return message
              if (message.read_at) return message

              return {
                ...message,
                read_at: readPayload.read_at,
              }
            }),
          }
        },
      )
    }

    const sendReadEvent = () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'read' }))
        markChatAsReadInCaches(selectedChatId)

        window.setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['chat-unread-count'] })
        }, 250)
      }
    }

    const pingInterval = window.setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25_000)

    socket.onopen = () => {
      setIsSocketReady(true)
      setSendError('')
      sendReadEvent()
    }

    socket.onmessage = (event) => {
      try {
        const payload = parseChatSocketPayload(JSON.parse(event.data))

        if (!payload) return

        if (payload.type === 'connected') return
        if (payload.type === 'pong') return

        if (payload.type === 'message') {
          addMessageToCache(payload.message)

          if (payload.message.sender_id !== currentUserId) {
            sendReadEvent()
          }

          return
        }

        if (payload.type === 'read') {
          if (payload.chat_id === selectedChatId) {
            markMessagesAsReadInCache(payload)
          }

          queryClient.invalidateQueries({ queryKey: ['user-chats'] })
          queryClient.invalidateQueries({ queryKey: ['chat-unread-count'] })
          return
        }

        if (payload.type === 'user_online') {
          setChatOnlineUserIds((prev) => {
            const next = new Set(prev)

            if (payload.is_online) {
              next.add(payload.user_id)
            } else {
              next.delete(payload.user_id)
            }

            return next
          })

          return
        }

        if (payload.type === 'error') {
          setSendError(payload.detail || 'Ошибка WebSocket.')
        }
      } catch {
        // ignore invalid ws event
      }
    }

    socket.onerror = () => {
      setIsSocketReady(false)
      setSendError('Соединение с чатом потеряно.')
    }

    socket.onclose = () => {
      setIsSocketReady(false)
      window.clearInterval(pingInterval)
    }

    return () => {
      window.clearInterval(pingInterval)

      if (chatSocketRef.current === socket) {
        chatSocketRef.current = null
      }

      socket.close()
    }
  }, [selectedChatId, queryClient, currentUserId])

  const sendTextBySocket = (text: string) => {
    const socket = chatSocketRef.current

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setSendError('Соединение с чатом ещё не установлено. Подождите пару секунд.')
      return false
    }

    socket.send(
      JSON.stringify({
        type: 'message',
        text,
      }),
    )

    return true
  }

  const handleSelectFiles = (fileList?: FileList | null) => {
    if (!fileList) return

    setFiles((prev) => {
      const merged = [...prev, ...Array.from(fileList)]
      return merged.slice(0, 10)
    })

    setSendError('')
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== index))
  }

  const handleSendMessage = () => {
    if (!canWriteToChat) {
      setSendError(chatLockReason)
      return
    }

    if (!selectedChatId || sendAttachmentsMutation.isPending) return

    const trimmedText = messageText.trim()

    if (!trimmedText && files.length === 0) {
      setSendError('Введите сообщение или прикрепите файл.')
      return
    }

    setSendError('')

    if (files.length > 0) {
      sendAttachmentsMutation.mutate({
        chatId: selectedChatId,
        text: trimmedText,
        files,
        onProgress: (progress) => setUploadProgress(progress),
      })

      return
    }

    const sent = sendTextBySocket(trimmedText)

    if (!sent) return

    setMessageText('')
  }

  const messagesWithDateMarkers = useMemo(() => {
    const messages = activeChat?.messages || []
    let previousKey = ''

    return messages.map((message) => {
      const currentKey = getDateKey(message.created_at)
      const showDate = currentKey !== previousKey
      previousKey = currentKey

      return {
        message,
        dateLabel: showDate ? formatChatDateLabel(message.created_at) : '',
      }
    })
  }, [activeChat?.messages])

  return (
    <div className="chat-page">
      <Header />

      <main className="chat-page__main">
        <div className="chat-container">
          <section className={`chat-shell ${isMobileChatOpen ? 'is-chat-open' : ''}`}>
            <aside className="chat-sidebar">
              <div className="chat-sidebar__head">
                <div>
                  <span>Сообщения</span>
                  <h1>Чаты</h1>
                </div>

                <strong>{chats.length}</strong>
              </div>

              {chatsQuery.isLoading ? (
                <div className="chat-list-state">Загружаем чаты...</div>
              ) : null}

              {chatsQuery.isError ? (
                <div className="chat-list-state chat-list-state--error">
                  Не удалось загрузить чаты.
                </div>
              ) : null}

              {!chatsQuery.isLoading && !chatsQuery.isError && chats.length === 0 ? (
                <div className="chat-list-state">
                  Чатов пока нет. Они появятся после отклика и создания диалога.
                </div>
              ) : null}

              <div className="chat-list">
                {chats.map((chat) => {
                  const itemApplication = chat.application
                  const itemCompanion = chat.companion || chat.last_message?.sender || null
                  const itemTitle = getChatTitle(currentRole, itemApplication, itemCompanion)
                  const itemSubtitle = getChatSubtitle(currentRole, itemApplication, itemCompanion)
                  const itemVacancyLock = getVacancyLockState(
                    itemApplication?.vacancy?.status_name,
                  )

                  const isOnline = itemCompanion?.id
                    ? chatOnlineUserIds.has(itemCompanion.id) ||
                      onlineUserIds.has(itemCompanion.id) ||
                      Boolean(itemCompanion.is_online)
                    : false

                  const isActive = selectedChatId === chat.id

                  return (
                    <button
                      key={chat.id}
                      type="button"
                      className={`chat-list-item ${isActive ? 'is-active' : ''}`}
                      onClick={() => {
                        clearApplicationIdParam()
                        setSelectedChatId(chat.id)
                        markChatAsReadInCaches(chat.id)
                        setIsMobileChatOpen(true)
                      }}
                    >
                      <div className="chat-avatar chat-list-item__avatar">
                        {getChatAvatarUrl({ role: currentRole, application: itemApplication, companion: itemCompanion }) ? (
                          <img
                            src={getChatAvatarUrl({ role: currentRole, application: itemApplication, companion: itemCompanion })}
                            alt={itemTitle}
                            className="chat-avatar__image"
                          />
                        ) : (
                          getInitials(itemTitle)
                        )}
                        <span className={isOnline ? 'is-online' : ''} />
                      </div>

                      <div className="chat-list-item__body">
                        <div className="chat-list-item__top">
                          <strong>{itemTitle}</strong>
                          <span>{formatTime(chat.last_message?.created_at)}</span>
                        </div>

                        <p
                          className={
                            chat.is_rejected || itemVacancyLock.isLocked
                              ? 'is-chat-locked-text'
                              : ''
                          }
                        >
                          {chat.is_rejected
                            ? 'Отказ'
                            : itemVacancyLock.isDeleted
                              ? 'Вакансия удалена'
                              : itemVacancyLock.isArchived
                                ? 'Вакансия в архиве'
                                : chat.last_message?.text ||
                                  (chat.last_message?.attachments?.length ? 'Файл' : itemSubtitle)}
                        </p>
                      </div>

                      {chat.unread_count ? (
                        <div className="chat-list-item__badge">{chat.unread_count}</div>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </aside>

            <section className="chat-panel">
              {!selectedChatId ? (
                <div className="chat-empty">
                  <div className="chat-empty__icon">💬</div>
                  <h2>Выберите чат</h2>
                  <p>Откройте диалог слева, чтобы продолжить переписку.</p>
                </div>
              ) : null}

              {selectedChatId ? (
                <>
                  <header className="chat-panel__head">
                    <button
                      type="button"
                      className="chat-panel__back"
                      onClick={() => setIsMobileChatOpen(false)}
                      aria-label="Назад к списку чатов"
                    >
                      <BackIcon />
                    </button>

                    <div className="chat-avatar chat-panel__avatar">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={title} className="chat-avatar__image" />
                      ) : (
                        getInitials(title)
                      )}
                      <span className={companionOnline ? 'is-online' : ''} />
                    </div>

                    <div className="chat-panel__title">
                      <h2>{title}</h2>
                      <p>
                        {isRejected
                          ? `Отказ · ${subtitle}`
                          : vacancyLock.isDeleted
                            ? `Вакансия удалена · ${subtitle}`
                            : vacancyLock.isArchived
                              ? `Вакансия в архиве · ${subtitle}`
                              : `${companionOnline ? 'В сети' : 'Не в сети'} · ${subtitle}`}
                      </p>
                    </div>

                    <div className="chat-panel__head-actions">
                      {actionLink ? (
                        <Link to={actionLink} className="chat-panel__action">
                          {actionText}
                        </Link>
                      ) : null}

                      {currentRole === 'company' && activeApplication?.id && !isRejected ? (
                        <div className="chat-decision-actions">
                          <button
                            type="button"
                            className="chat-decision-btn chat-decision-btn--approve"
                            disabled={applicationDecisionMutation.isPending || isAccepted}
                            onClick={() => openDecisionModal('accepted')}
                          >
                            <span>Собеседование</span>
                          </button>

                          <button
                            type="button"
                            className="chat-decision-btn chat-decision-btn--reject"
                            disabled={applicationDecisionMutation.isPending || isRejected}
                            onClick={() => openDecisionModal('rejected')}
                          >
                            <span>Отказ</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </header>

                  <div className="chat-messages">
                    {chatDetailQuery.isLoading ? (
                      <div className="chat-messages__state">Загружаем переписку...</div>
                    ) : null}

                    {chatDetailQuery.isError ? (
                      <div className="chat-messages__state chat-messages__state--error">
                        Не удалось загрузить переписку.
                      </div>
                    ) : null}

                    {!chatDetailQuery.isLoading &&
                    !chatDetailQuery.isError &&
                    activeChat?.messages.length === 0 ? (
                      <div className="chat-messages__state">
                        Сообщений пока нет. Напишите первым.
                      </div>
                    ) : null}

                    {messagesWithDateMarkers.map(({ message, dateLabel }) => {
                      const isMine = currentUserId
                        ? message.sender_id === currentUserId
                        : message.sender_id !== companion?.id

                      return (
                        <div key={message.id} className="chat-message-row">
                          {dateLabel ? (
                            <div className="chat-date-divider">
                              <span>{dateLabel}</span>
                            </div>
                          ) : null}

                          <article className={`chat-message ${isMine ? 'is-mine' : 'is-other'}`}>
                            <div className="chat-message__bubble">
                              {message.text ? <p>{message.text}</p> : null}

                              {message.attachments?.length ? (
                                <div className="chat-attachments">
                                  {message.attachments.map((attachment) => (
                                    <a
                                      key={attachment.id}
                                      href={attachment.file_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`chat-attachment ${
                                        isImageAttachment(attachment) ? 'is-image' : ''
                                      }`}
                                    >
                                      {isImageAttachment(attachment) ? (
                                        <img
                                          src={attachment.file_url}
                                          alt={attachment.file_name || 'Файл'}
                                        />
                                      ) : (
                                        <span className="chat-attachment__icon"><FileIcon /></span>
                                      )}

                                      {!isImageAttachment(attachment) ? (
                                        <span className="chat-attachment__info">
                                          <strong>{attachment.file_name || 'Файл'}</strong>
                                          <small>{formatFileSize(attachment.file_size)}</small>
                                        </span>
                                      ) : null}
                                    </a>
                                  ))}
                                </div>
                              ) : null}

                              <span className="chat-message__time">
                                {formatMessageTimestamp(message.created_at)}
                                {isMine && message.read_at ? ' · прочитано' : ''}
                              </span>
                            </div>
                          </article>
                        </div>
                      )
                    })}

                    <div ref={messagesEndRef} />
                  </div>

                  {files.length > 0 ? (
                    <div className="chat-picked-files">
                      {files.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="chat-picked-file">
                          <span className="chat-picked-file__icon"><FileIcon /></span>

                          <div>
                            <strong>{file.name}</strong>
                            <small>
                              {formatFileSize(file.size)}
                              {isUploadingFiles ? ` · ${uploadProgress}%` : ''}
                            </small>
                            {isUploadingFiles ? (
                              <span className="chat-upload-bar">
                                <span style={{ width: `${uploadProgress}%` }} />
                              </span>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveFile(index)}
                            disabled={isUploadingFiles}
                            aria-label="Убрать файл"
                          >
                            <RejectIcon />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {!canWriteToChat && chatLockReason ? (
                    <div className="chat-locked-notice">
                      {chatLockReason}
                    </div>
                  ) : null}

                  {sendError ? <div className="chat-send-error">{sendError}</div> : null}

                  {canWriteToChat ? (
                    <footer className="chat-composer">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="chat-composer__file"
                        onChange={(event) => handleSelectFiles(event.target.files)}
                      />

                      <button
                        type="button"
                        className="chat-composer__attach"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sendAttachmentsMutation.isPending}
                        aria-label="Прикрепить файл"
                      >
                        <PaperclipIcon />
                      </button>

                      <textarea
                        ref={messageTextareaRef}
                        value={messageText}
                        placeholder="Напишите сообщение..."
                        onChange={(event) => {
                          setMessageText(event.target.value)
                          setSendError('')
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            handleSendMessage()
                          }
                        }}
                      />

                      <button
                        type="button"
                        className="chat-composer__send"
                        onClick={handleSendMessage}
                        disabled={sendAttachmentsMutation.isPending || isUploadingFiles || !isSocketReady}
                        aria-label={isUploadingFiles ? 'Идёт отправка' : 'Отправить сообщение'}
                      >
                        {sendAttachmentsMutation.isPending || isUploadingFiles ? <SpinnerIcon /> : <SendIcon />}
                      </button>
                    </footer>
                  ) : null}
                </>
              ) : null}
            </section>
          </section>
        </div>
      </main>

      {decisionModal ? (
        <ApplicationStatusMessageModal
          status={decisionModal.status}
          applicantName={title}
          resumeTitle={subtitle}
          vacancyTitle={getVacancyTitle(activeApplication) || 'вакансию'}
          isPending={applicationDecisionMutation.isPending}
          errorText={applicationDecisionMutation.isError ? sendError : ''}
          onClose={closeDecisionModal}
          onSubmit={confirmDecisionModal}
        />
      ) : null}
    </div>
  )
}