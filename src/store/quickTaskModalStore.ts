import { create } from 'zustand'
import type { Priority } from '../types'

export interface QuickTaskModalProps {
  defaultTitle?: string
  defaultDueDate?: string
  defaultPriority?: Priority
  defaultProjectId?: string
  defaultUrgent?: boolean
  defaultImportant?: boolean
}

interface QuickTaskModalState {
  isOpen: boolean
  props: QuickTaskModalProps | null
  open: (props?: QuickTaskModalProps) => void
  close: () => void
}

export const useQuickTaskModalStore = create<QuickTaskModalState>((set) => ({
  isOpen: false,
  props: null,
  open: (props) => set({ isOpen: true, props: props ?? null }),
  close: () => set({ isOpen: false, props: null }),
}))
