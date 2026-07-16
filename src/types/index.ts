export type Priority = 'low' | 'medium' | 'high'

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface Attachment {
  id: string
  name: string
  url: string
  path: string
  size: number
  createdAt: string
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
  /** Explicit Eisenhower placement; false = uncategorized inbox (not Q4). */
  matrixPlaced?: boolean
  completed: boolean
  completedAt?: string
  boardId?: string
  columnId?: string
  ownerId?: string
  assignedTo?: string
  assigneeIds?: string[]
  assignee?: {
    id: string
    username: string
    display_name: string
    avatar_color: string
  }
  subtasks: Subtask[]
  attachments: Attachment[]
  createdAt: string
  evening?: boolean
  someday?: boolean
  recurrence?: 'daily' | 'weekly' | 'monthly'
  dependsOn?: string[]
  startTime?: string // HH:MM, optional suggested/scheduled start time within dueDate
  estimatedMinutes?: number
  statusNote?: string // free-text status / progress note
  snoozedUntil?: string
  reminderAt?: string
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

export interface BoardFolder {
  id: string
  ownerId: string
  title: string
  position: number
  createdAt: string
}

export interface BoardMilestone {
  id: string
  boardId: string
  title: string
  dueDate: string
  completed: boolean
  createdAt: string
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
  folderId?: string
  responsibleUserId?: string
  responsibleProfile?: { id: string; display_name: string; avatar_color: string }
  columns: BoardColumn[]
  members: ProjectMember[]
  attachments: Attachment[]
  createdAt: string
  timeBudgetMinutes?: number
}

export interface SocialAccount {
  id: string
  platform: 'instagram'
  username: string
  igUserId: string
  /** @deprecated Tokens are stored server-side only. Use tokenConfigured. */
  accessToken?: string
  tokenConfigured?: boolean
  name?: string
  biography?: string
  website?: string
  profilePictureUrl?: string
  lastSyncedAt?: string
  createdAt: string
  sharedWith?: string[]
  ownerId?: string
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
  mediaUrl?: string
  thumbnailUrl?: string
  impressions?: number
  reach?: number
  replies?: number
  exits?: number
  tapsForward?: number
  tapsBack?: number
}

export type AbsenceType = 'vacation' | 'sick' | 'overtime'
export type AbsenceStatus = 'pending' | 'approved' | 'rejected'

export interface AbsencePeriod {
  id: string
  userId?: string
  type: AbsenceType
  startDate: string
  endDate: string
  note?: string
  status?: AbsenceStatus
  reviewedBy?: string
  reviewedAt?: string
  profile?: { display_name: string; username: string }
}

export type AppRole = 'user' | 'admin'
export type OrgRole = 'owner' | 'admin' | 'manager' | 'member'
export type DepartmentRole = 'head' | 'member'

export interface Organization {
  id: string
  name: string
  ownerId: string
  createdAt: string
}

export interface OrgDepartment {
  id: string
  orgId: string
  name: string
  description?: string
  parentId?: string
  memberCount?: number
}

export interface OrganizationMember {
  userId: string
  role: OrgRole
  departmentId?: string
  profile: {
    id: string
    display_name: string
    username: string
    avatar_color: string
    job_title?: string | null
    role_description?: string | null
    app_role?: AppRole
    is_admin?: boolean
  }
}

export interface WorkDayEntry {
  date: string // ISO date string (yyyy-MM-dd)
  workedMinutes: number
  breakMinutes: number
  startTime?: string // HH:mm
  endTime?: string // HH:mm
  sickDay?: boolean // true = krank, zählt als Soll-Zeit, kein Tracking
}

export interface WorkTimeSettings {
  weeklyHours: number       // contract hours/week (e.g. 38.5)
  workDaysPerWeek: number
  defaultBreakMinutes: number
  weekdayHours?: number     // Mon-Thu schedule target (e.g. 8.0)
  fridayHours?: number      // Friday schedule target (e.g. 7.25)
}

export interface WorkProfile {
  id: string
  name: string
  weeklyHours: number
  workDaysPerWeek: number
  defaultBreakMinutes: number
  weekdayHours?: number
  fridayHours?: number
}

// Tamper-proof punch event ("Stempeluhr") — append-only, never edited or deleted
export interface WorkTimePunch {
  id: string
  punchedAt: string // ISO timestamp
  kind: 'in' | 'out'
  source: string // 'app' | 'manual' | ...
}

// Change/audit trail entry for manual corrections — append-only
export interface WorkTimeAuditEntry {
  id: string
  entryDate: string // yyyy-MM-dd
  field: string
  oldValue: string | null
  newValue: string | null
  reason: string | null
  changedAt: string // ISO timestamp
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
  badge?: string | null
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
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  completed?: boolean
  meetingLink?: string
  visibility?: 'public' | 'department' | 'private'
  externalId?: string
  cancelled?: boolean
}
