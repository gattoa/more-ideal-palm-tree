import { supabase } from './supabase.js'

export const signInAnonymously = () => supabase.auth.signInAnonymously()

export const signUp = (email, password) =>
  supabase.auth.updateUser({ email, password })

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getSession = () => supabase.auth.getSession()

export const onAuthStateChange = (cb) => supabase.auth.onAuthStateChange(cb)

export const claimAnonymousTodos = (anonUserId) =>
  supabase.rpc('claim_anonymous_todos', { anon_user_id: anonUserId })
