import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { Member, Staff, TxPreset, TierConfig, RoleConfig, CheckIn, Transaction } from './types';

// ── Transform DB → App types ──
const toRole = (r: any): RoleConfig => ({ id: r.id, slug: r.slug, name: r.name, description: r.description||'', togglePerms: r.toggle_perms||{}, levelPerms: r.level_perms||{}, is_system: r.is_system||false });
const toTier = (t: any): TierConfig => ({ id: t.id, name: t.name||t.tier||'', min_exp: t.min_exp, max_exp: t.max_exp, benefits: t.benefits||[], bg: t.bg||'#003820', text: t.text_color||'#003820', badgeText: t.badge_text||'#fff' });
const toStaff = (s: any): Staff => ({ id: s.id, full_name: s.full_name, email: s.email||'', role_ids: s.role_slugs||[], is_active: s.is_active, pin: s.pin });
const toMember = (m: any): Member => ({ id: m.id, full_name: m.full_name, email: m.email, phone: m.phone, avatar_url: m.avatar_url, date_of_birth: m.date_of_birth, joined_at: m.joined_at||m.created_at, is_active: m.is_active??true, total_exp: m.total_exp||0, koin_balance: m.koin_balance||0 });
const toPreset = (p: any): TxPreset => ({ id: p.id, label: p.label, description: p.description||'', exp_amount: p.exp_amount||0, koin_amount: p.koin_amount||0, category: p.category, allowed_role_ids: p.allowed_role_slugs||[], requires_pin: p.requires_pin||false, is_active: p.is_active, icon_url: p.icon_url });
const toCheckin = (c: any): CheckIn => ({ id: c.id, member_id: c.member_id, checked_in_by: c.checked_in_by, staff_name: c.staff_name||'', checked_in_at: c.checked_in_at||c.created_at, exp_earned: c.exp_earned||25 });
const toTx = (t: any): Transaction => ({ id: t.id, member_id: t.member_id, exp_amount: t.exp_amount||0, koin_amount: t.koin_amount||0, description: t.description||'', preset_id: t.preset_id, created_by: t.created_by||t.staff_id, staff_name: t.staff_name||'', created_at: t.created_at });

async function fetchTable(table: string, orderBy = 'created_at', asc = false) {
  const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending: asc });
  if (error) { console.error(`Fetch ${table}:`, error); return []; }
  return data || [];
}

export function useSupabaseData() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [tiers, setTiers] = useState<TierConfig[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [presets, setPresets] = useState<TxPreset[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesD, tiersD, staffD, membersD, presetsD, ciD, txD] = await Promise.all([
        fetchTable('roles'), fetchTable('tier_settings', 'sort_order', true),
        fetchTable('staff'), fetchTable('members'),
        fetchTable('tx_presets'), fetchTable('checkins'), fetchTable('transactions'),
      ]);
      setRoles(rolesD.map(toRole));
      setTiers(tiersD.map(toTier));
      setStaffList(staffD.map(toStaff));
      setMembers(membersD.map(toMember));
      setPresets(presetsD.map(toPreset));
      const today = new Date().toISOString().split('T')[0];
      setCheckins(ciD.filter((c:any) => (c.checked_in_at||c.created_at)?.startsWith(today)).map(toCheckin));
      setTransactions(txD.map(toTx));
    } catch (e) { console.error('Load error:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── CRUD ──
  const upsertRole = async (role: RoleConfig) => {
    const payload = { id: role.id, slug: role.slug || role.name.toLowerCase().replace(/\s+/g,'_'), name: role.name, description: role.description, toggle_perms: role.togglePerms, level_perms: role.levelPerms, is_system: role.is_system };
    const { error } = await supabase.from('roles').upsert(payload);
    if (!error) { setRoles(p => { const ex = p.find(r=>r.id===role.id); return ex ? p.map(r=>r.id===role.id?role:r) : [...p, role]; }); }
    return !error;
  };
  const deleteRole = async (id: string) => {
    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (!error) setRoles(p => p.filter(r=>r.id!==id));
    return !error;
  };

  const upsertTier = async (tier: TierConfig) => {
    const { error } = await supabase.from('tier_settings').update({
      name: tier.name, min_exp: tier.min_exp, max_exp: tier.max_exp,
      benefits: tier.benefits, bg: tier.bg, text_color: tier.text, badge_text: tier.badgeText,
    }).eq('id', tier.id);
    if (!error) setTiers(p => p.map(t=>t.id===tier.id?tier:t));
    return !error;
  };

  const upsertStaff = async (s: Staff) => {
    const payload = { id: s.id, full_name: s.full_name, email: s.email, role_slugs: s.role_ids, is_active: s.is_active, pin: s.pin };
    const { data, error } = await supabase.from('staff').upsert(payload).select().single();
    if (!error && data) { const st = toStaff(data); setStaffList(p => { const ex=p.find(x=>x.id===st.id); return ex?p.map(x=>x.id===st.id?st:x):[...p,st]; }); }
    return !error;
  };

  const upsertMember = async (m: Partial<Member> & { id?: string }) => {
    const payload: any = { full_name: m.full_name, email: m.email, phone: m.phone, date_of_birth: m.date_of_birth, is_active: m.is_active ?? true, total_exp: m.total_exp ?? 0, koin_balance: m.koin_balance ?? 0 };
    if (m.id) payload.id = m.id;
    const { data, error } = await supabase.from('members').upsert(payload).select().single();
    if (!error && data) { const mem = toMember(data); setMembers(p => { const ex=p.find(x=>x.id===mem.id); return ex?p.map(x=>x.id===mem.id?mem:x):[mem,...p]; }); return mem; }
    return null;
  };

  const updateMemberBalance = async (memberId: string, addExp: number, addKoin: number) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return false;
    const { error } = await supabase.from('members').update({ total_exp: member.total_exp + addExp, koin_balance: member.koin_balance + addKoin }).eq('id', memberId);
    if (!error) setMembers(p => p.map(m => m.id === memberId ? { ...m, total_exp: m.total_exp + addExp, koin_balance: m.koin_balance + addKoin } : m));
    return !error;
  };

  const upsertPreset = async (p: TxPreset) => {
    const payload = { id: p.id, label: p.label, description: p.description, exp_amount: p.exp_amount, koin_amount: p.koin_amount, category: p.category, allowed_role_slugs: p.allowed_role_ids, requires_pin: p.requires_pin, is_active: p.is_active, icon_url: p.icon_url };
    const { data, error } = await supabase.from('tx_presets').upsert(payload).select().single();
    if (!error && data) { const pr = toPreset(data); setPresets(prev => { const ex=prev.find(x=>x.id===pr.id); return ex?prev.map(x=>x.id===pr.id?pr:x):[...prev,pr]; }); }
    return !error;
  };
  const deletePreset = async (id: string) => {
    const { error } = await supabase.from('tx_presets').delete().eq('id', id);
    if (!error) setPresets(p => p.filter(x=>x.id!==id));
    return !error;
  };

  const addCheckin = async (ci: Omit<CheckIn, 'id'>) => {
    const { data, error } = await supabase.from('checkins').insert({ member_id: ci.member_id, checked_in_by: ci.checked_in_by, staff_name: ci.staff_name, checked_in_at: ci.checked_in_at, exp_earned: ci.exp_earned }).select().single();
    if (!error && data) setCheckins(p => [toCheckin(data), ...p]);
    return !error;
  };

  const addTransaction = async (tx: Omit<Transaction, 'id'>) => {
    const { data, error } = await supabase.from('transactions').insert({ member_id: tx.member_id, exp_amount: tx.exp_amount, koin_amount: tx.koin_amount, description: tx.description, preset_id: tx.preset_id, created_by: tx.created_by, staff_name: tx.staff_name }).select().single();
    if (!error && data) setTransactions(p => [toTx(data), ...p]);
    return !error;
  };

  return { loading, roles, setRoles, tiers, setTiers, staffList, setStaffList, members, setMembers, presets, setPresets, checkins, setCheckins, transactions, setTransactions, loadAll, upsertRole, deleteRole, upsertTier, upsertStaff, upsertMember, updateMemberBalance, upsertPreset, deletePreset, addCheckin, addTransaction };
}

// ── Auth ──
export async function loginStaff(email: string, password: string): Promise<{ staff: Staff | null; error: string | null }> {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) return { staff: null, error: authErr.message };
  const { data, error } = await supabase.from('staff').select('*').eq('email', email).eq('is_active', true).single();
  if (error || !data) return { staff: null, error: 'Staff tidak ditemukan atau nonaktif' };
  return { staff: toStaff(data), error: null };
}

export async function logoutStaff() { await supabase.auth.signOut(); }
