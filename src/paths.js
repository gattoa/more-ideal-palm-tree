import { supabase } from './supabase.js'

// ─── Path CRUD ──────────────────────────────────────────────────────────────

export async function loadPaths() {
  const { data, error } = await supabase
    .from('paths')
    .select('id, name, description, is_archived, created_at')
    .eq('is_archived', false)
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to load paths:', error.message)
    return []
  }
  return data
}

export async function createPath(name, userId, description = null) {
  const { data, error } = await supabase
    .from('paths')
    .insert({ name, description, user_id: userId })
    .select('id, name, description, is_archived, created_at')
    .single()

  if (error) {
    console.error('Failed to create path:', error.message)
    return null
  }
  return data
}

export async function renamePath(id, name) {
  const { error } = await supabase
    .from('paths')
    .update({ name })
    .eq('id', id)

  if (error) {
    console.error('Failed to rename path:', error.message)
    return false
  }
  return true
}

export async function archivePath(id) {
  const { error } = await supabase
    .from('paths')
    .update({ is_archived: true })
    .eq('id', id)

  if (error) {
    console.error('Failed to archive path:', error.message)
    return false
  }
  return true
}

// ─── Step-Path Junction CRUD ────────────────────────────────────────────────

export async function addStepToPath(stepId, pathId) {
  const { error } = await supabase
    .from('step_paths')
    .insert({ step_id: stepId, path_id: pathId })

  if (error) {
    console.error('Failed to add step to path:', error.message)
    return false
  }
  return true
}

export async function removeStepFromPath(stepId, pathId) {
  const { error } = await supabase
    .from('step_paths')
    .delete()
    .eq('step_id', stepId)
    .eq('path_id', pathId)

  if (error) {
    console.error('Failed to remove step from path:', error.message)
    return false
  }
  return true
}

export async function loadStepPathsMap() {
  const { data, error } = await supabase
    .from('step_paths')
    .select('step_id, path_id, paths(id, name)')

  if (error) {
    console.error('Failed to load step-path associations:', error.message)
    return new Map()
  }

  const map = new Map()
  for (const row of data) {
    if (!map.has(row.step_id)) {
      map.set(row.step_id, [])
    }
    if (row.paths) {
      map.get(row.step_id).push(row.paths)
    }
  }
  return map
}
