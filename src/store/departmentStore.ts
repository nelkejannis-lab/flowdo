import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { DepartmentRole, OrgDepartment } from '../types'

interface DeptState {
  departments: OrgDepartment[]
  loading: boolean
  fetch: (orgId: string) => Promise<void>
  create: (orgId: string, name: string, description?: string, parentId?: string) => Promise<string | null>
  update: (id: string, name: string, description?: string) => Promise<string | null>
  remove: (id: string) => Promise<string | null>
  assignMember: (departmentId: string, userId: string, role?: DepartmentRole) => Promise<string | null>
  removeMember: (departmentId: string, userId: string) => Promise<string | null>
  assignOrgMemberDepartment: (orgId: string, userId: string, departmentId: string | null) => Promise<string | null>
}

export const useDepartmentStore = create<DeptState>()((set, get) => ({
  departments: [],
  loading: false,

  fetch: async (orgId) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('org_departments')
      .select('id, org_id, name, description, parent_id')
      .eq('org_id', orgId)
      .order('name')

    if (error) {
      set({ loading: false })
      return
    }

    const departments: OrgDepartment[] = (data ?? []).map((d: any) => ({
      id: d.id,
      orgId: d.org_id,
      name: d.name,
      description: d.description ?? undefined,
      parentId: d.parent_id ?? undefined,
    }))
    set({ departments, loading: false })
  },

  create: async (orgId, name, description, parentId) => {
    const trimmed = name.trim()
    if (!trimmed) return 'Name required'
    const { error } = await supabase.from('org_departments').insert({
      org_id: orgId,
      name: trimmed,
      description: description?.trim() || null,
      parent_id: parentId ?? null,
    })
    if (error) return error.message
    await get().fetch(orgId)
    return null
  },

  update: async (id, name, description) => {
    const dept = get().departments.find((d) => d.id === id)
    if (!dept) return 'Not found'
    const { error } = await supabase
      .from('org_departments')
      .update({ name: name.trim(), description: description?.trim() || null })
      .eq('id', id)
    if (error) return error.message
    await get().fetch(dept.orgId)
    return null
  },

  remove: async (id) => {
    const dept = get().departments.find((d) => d.id === id)
    if (!dept) return 'Not found'
    const { error } = await supabase.from('org_departments').delete().eq('id', id)
    if (error) return error.message
    await get().fetch(dept.orgId)
    return null
  },

  assignMember: async (departmentId, userId, role = 'member') => {
    const { error } = await supabase.from('department_members').upsert({
      department_id: departmentId,
      user_id: userId,
      role,
    })
    if (error) return error.message
    const dept = get().departments.find((d) => d.id === departmentId)
    if (dept) await get().fetch(dept.orgId)
    return null
  },

  removeMember: async (departmentId, userId) => {
    const { error } = await supabase
      .from('department_members')
      .delete()
      .eq('department_id', departmentId)
      .eq('user_id', userId)
    if (error) return error.message
    const dept = get().departments.find((d) => d.id === departmentId)
    if (dept) await get().fetch(dept.orgId)
    return null
  },

  assignOrgMemberDepartment: async (orgId, userId, departmentId) => {
    const { error } = await supabase
      .from('organization_members')
      .update({ department_id: departmentId })
      .eq('org_id', orgId)
      .eq('user_id', userId)
    if (error) return error.message
    return null
  },
}))
