export type Priority = 'low' | 'medium' | 'high'

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface Task {
  id: string
  title: string
  description?: string
  dueDate?: string // ISO date string (yyyy-MM-dd)
  priority: Priority
  tags: string[]
  urgent: boolean
  important: boolean
  completed: boolean
  completedAt?: string
  boardId?: string
  columnId?: string
  ownerId?: string
  assignedTo?: string
  assignee?: {
    id: string
    username: string
    display_name: string
    avatar_color: string
  }
  subtasks: Subtask[]
  createdAt: string
}

export type EisenhowerQuadrant = 'do' | 'decide' | 'delegate' | 'delete'

export interface BoardColumn {
  id: string
  title: string
}

export interface ProjectMember {
  userId: string
  role: 'owner' | 'member'
  profile: {
    id: string
    username: string
    display_name: string
    avatar_color: string
  }
}

export interface Board {
  id: string
  ownerId: string
  title: string
  description?: string
  color: string
  deadline?: string
  internalLaunch?: string
  externalLaunch?: string
  columns: BoardColumn[]
  members: ProjectMember[]
  createdAt: string
}

export interface SocialAccount {
  id: string
  platform: 'instagram'
  username: string
  igUserId: string
  accessToken?: string
  name?: string
  biography?: string
  website?: string
  profilePictureUrl?: string
  lastSyncedAt?: string
  createdAt: string
}

export interface SocialMetric {
  date: string
  followersCount?: number
  followsCount?: number
  mediaCount?: number
  reach?: number
  profileViews?: number
  accountsEngaged?: number
  totalInteractions?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  followsAndUnfollows?: number
}

export interface SocialPost {
  id: string
  mediaId: string
  mediaType?: string
  caption?: string
  permalink?: string
  mediaUrl?: string
  thumbnailUrl?: string
  postedAt?: string
  likeCount?: number
  commentsCount?: number
  reach?: number
  saved?: number
  shares?: number
  totalInteractions?: number
}

export interface SocialStory {
  id: string
  mediaId: string
  mediaType?: string
  postedAt?: string
  impressions?: number
  reach?: number
  replies?: number
  exits?: number
  tapsForward?: number
  tapsBack?: number
}

export interface WorkDayEntry {
  date: string // ISO date string (yyyy-MM-dd)
  workedMinutes: number
  breakMinutes: number
}

export interface WorkTimeSettings {
  weeklyHours: number
  workDaysPerWeek: number
  defaultBreakMinutes: number
}

export interface CalendarEvent {
  id: string
  title: string
  date: string // ISO date string (yyyy-MM-dd), start date
  endDate?: string // ISO date string (yyyy-MM-dd), inclusive end date for multi-day events
  description?: string
  color: string
  createdAt: string
}

export type CalendarEntryType = 'termin' | 'reise' | 'urlaub'

export interface CalendarEntryInvitee {
  id: string
  username: string
  display_name: string
  avatar_color: string
}

export interface CalendarEntry {
  id: string
  ownerId: string
  owner?: CalendarEntryInvitee
  type: CalendarEntryType
  title: string
  description?: string
  date: string // ISO date string (yyyy-MM-dd), start date
  endDate?: string // ISO date string (yyyy-MM-dd), inclusive end date for multi-day entries
  startTime?: string // HH:MM
  endTime?: string // HH:MM
  color: string
  invitees: CalendarEntryInvitee[]
  createdAt: string
}
