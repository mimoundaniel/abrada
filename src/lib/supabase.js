import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = (url && key) ? createClient(url, key) : null
export const hasSupa = () => !!supabase
export const signIn = (e, p) => supabase ? supabase.auth.signInWithPassword({ email: e, password: p }) : { error: { message: 'Not configured' } }
export const signUp = (e, p, n) => supabase ? supabase.auth.signUp({ email: e, password: p, options: { data: { display_name: n } } }) : { error: { message: 'Not configured' } }
export const signOut = () => supabase?.auth.signOut()
export const getSession = async () => { if (!supabase) return null; const { data } = await supabase.auth.getSession(); return data?.session || null }
export const getProfile = async (id) => { if (!supabase) return null; const { data } = await supabase.from('profiles').select('*').eq('id', id).single(); return data }
export const onAuthChange = (cb) => supabase ? supabase.auth.onAuthStateChange(cb) : { data: { subscription: { unsubscribe: () => {} } } }