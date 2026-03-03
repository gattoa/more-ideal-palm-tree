import { supabase } from './supabase.js'

// ─── Milestone CRUD ─────────────────────────────────────────────────────────

export async function loadMilestones() {
  const { data, error } = await supabase
    .from('milestones')
    .select('id, journey_id, name, description, target_count, target_date, completed_at, sort_order')
    .is('completed_at', null)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Failed to load milestones:', error.message)
    return []
  }
  return data
}

export async function createMilestone(journeyId, name, userId, { description = null, targetCount = null, targetDate = null } = {}) {
  const { data, error } = await supabase
    .from('milestones')
    .insert({
      journey_id: journeyId,
      name,
      user_id: userId,
      description,
      target_count: targetCount,
      target_date: targetDate,
    })
    .select('id, journey_id, name, description, target_count, target_date, completed_at, sort_order')
    .single()

  if (error) {
    console.error('Failed to create milestone:', error.message)
    return null
  }
  return data
}

export async function updateMilestone(id, updates) {
  const payload = {}
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.description !== undefined) payload.description = updates.description
  if (updates.targetCount !== undefined) payload.target_count = updates.targetCount
  if (updates.targetDate !== undefined) payload.target_date = updates.targetDate

  const { error } = await supabase
    .from('milestones')
    .update(payload)
    .eq('id', id)

  if (error) {
    console.error('Failed to update milestone:', error.message)
    return false
  }
  return true
}

export async function completeMilestone(id) {
  const { error } = await supabase
    .from('milestones')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Failed to complete milestone:', error.message)
    return false
  }
  return true
}

// ─── Progress Calculation (pure function) ────────────────────────────────────

export function calculateProgress(milestone, stepsInMilestone) {
  const current = stepsInMilestone.filter((s) => s.completed).length
  const target = milestone.target_count
  const percentage = target ? Math.min(current / target, 1) : null

  return { current, target, percentage }
}
