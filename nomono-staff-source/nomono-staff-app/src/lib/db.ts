import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import {
  Member,
  Staff,
  TxPreset,
  TierConfig,
  RoleConfig,
  CheckIn,
  Transaction,
  MajooImport,
  UnmatchedTransaction,
  TogglePerm,
  LevelPerm,
  PermLevel,
  DEFAULT_ROLES,
} from './types';

// ── Permission defaults ──
const emptyTogglePerms: Record<TogglePerm, boolean> = {
  checkin: false,
  assign_activity: false,
  view_members: false,
  edit_members: false,
  view_transactions: false,
  approve_pin: false,
  import_majoo: false,
  review_unmatched: false,
};

const emptyLevelPerms: Record<LevelPerm, PermLevel> = {
  master_presets: 'none',
  master_tiers: 'none',
  master_roles: 'none',
  manage_staff: 'none',
};

function normalizeTogglePerms(raw: any): Record<TogglePerm, boolean> {
  const p = raw || {};
  return {
    checkin: p.checkin === true || p.checkin_member === true,
    assign_activity: p.assign_activity === true || p.manage_rewards === true,
    view_members: p.view_members === true,
    edit_members: p.edit_members === true,
    view_transactions: p.view_transactions === true || p.view_reports === true,
    approve_pin: p.approve_pin === true,
    import_majoo: p.import_majoo === true,
    review_unmatched: p.review_unmatched === true,
  };
}

function normalizeLevelPerms(raw: any, togglePerms?: Record<TogglePerm, boolean>): Record<LevelPerm, PermLevel> {
  const p = raw || {};
  const t = togglePerms || emptyTogglePerms;

  const direct: Record<LevelPerm, PermLevel> = {
    master_presets: (p.master_presets as PermLevel) || 'none',
    master_tiers: (p.master_tiers as PermLevel) || 'none',
    master_roles: (p.master_roles as PermLevel) || 'none',
    manage_staff: (p.manage_staff as PermLevel) || 'none',
  };

  if (p.manage_staff === true) direct.manage_staff = 'modify';
  if (p.manage_settings === true) {
    direct.master_presets = 'modify';
    direct.master_tiers = 'modify';
    direct.master_roles = 'modify';
    direct.manage_staff = 'modify';
  }

  const looksLikeManager =
    t.checkin &&
    t.assign_activity &&
    t.view_members &&
    t.edit_members &&
    t.view_transactions &&
    t.approve_pin;

  const allNone =
    direct.master_presets === 'none' &&
    direct.master_tiers === 'none' &&
    direct.master_roles === 'none' &&
    direct.manage_staff === 'none';

  if (looksLikeManager && allNone) {
    return {
      master_presets: 'modify',
      master_tiers: 'modify',
      master_roles: 'modify',
      manage_staff: 'modify',
    };
  }

  return direct;
}

function normalizeRole(r: any): RoleConfig {
  const togglePerms = normalizeTogglePerms(r.toggle_perms);
  const levelPerms = normalizeLevelPerms(r.level_perms, togglePerms);

  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description || '',
    togglePerms,
    levelPerms,
    is_system: r.is_system || false,
  };
}

function mergeRolesWithDefaults(dbRoles: RoleConfig[]): RoleConfig[] {
  if (!dbRoles.length) return DEFAULT_ROLES;

  return dbRoles.map(role => {
    const fallback = DEFAULT_ROLES.find(
      d => d.id === role.id || (!!role.slug && d.slug === role.slug) || d.name === role.name
    );

    if (!fallback) return role;

    const hasAnyToggle = Object.values(role.togglePerms || {}).some(v => v === true);
    const hasAnyLevel = Object.values(role.levelPerms || {}).some(v => v !== 'none');

    return {
      ...fallback,
      ...role,
      togglePerms: hasAnyToggle ? role.togglePerms : fallback.togglePerms,
      levelPerms: hasAnyLevel ? role.levelPerms : fallback.levelPerms,
    };
  });
}

// ── Transform DB → App types ──
const toRole = (r: any): RoleConfig => normalizeRole(r);
const toTier = (t: any): TierConfig => ({
  id: t.id,
  name: t.name || t.tier || '',
  min_exp: t.min_exp,
  max_exp: t.max_exp,
  benefits: t.benefits || [],
  bg: t.bg || '#003820',
  text: t.text_color || '#003820',
  badgeText: t.badge_text || '#fff'
});
const toStaff = (s: any): Staff => ({
  id: s.id,
  full_name: s.full_name,
  email: s.email || '',
  role_ids: s.role_slugs || [],
  is_active: s.is_active,
  pin: s.pin
});
const toMember = (m: any): Member => ({
  id: m.id,
  full_name: m.full_name,
  email: m.email,
  phone: m.phone,
  phone_normalized: m.phone_normalized ?? null,
  avatar_url: m.avatar_url,
  date_of_birth: m.date_of_birth,
  joined_at: m.joined_at || m.created_at,
  is_active: (m.is_active ?? (m.status !== 'inactive')),
  total_exp: m.total_exp || 0,
  koin_balance: m.koin_balance ?? m.coin_balance ?? 0,
  majoo_synced_at: m.majoo_synced_at ?? null,
});
const toPreset = (p: any): TxPreset => ({
  id: p.id,
  label: p.label,
  description: p.description || '',
  exp_amount: p.exp_amount || 0,
  koin_amount: p.koin_amount || 0,
  category: p.category,
  allowed_role_ids: p.allowed_role_slugs || [],
  requires_pin: p.requires_pin || false,
  is_active: p.is_active,
  icon_url: p.icon_url
});
const toCheckin = (c: any): CheckIn => ({
  id: c.id,
  member_id: c.member_id,
  checked_in_by: c.checked_in_by,
  staff_name: c.staff_name || '',
  checked_in_at: c.checked_in_at || c.created_at,
  exp_earned: c.exp_earned || 25
});
const toTx = (t: any): Transaction => ({
  id: t.id,
  member_id: t.member_id,
  exp_amount: t.exp_amount || 0,
  koin_amount: t.koin_amount || 0,
  description: t.description || '',
  preset_id: t.preset_id,
  created_by: t.created_by || t.staff_id,
  staff_name: t.staff_name || '',
  created_at: t.created_at,
  source: t.source ?? 'manual',
  majoo_import_id: t.majoo_import_id ?? null,
  majoo_transaction_id: t.majoo_transaction_id ?? null,
  nominal_amount: t.nominal_amount ?? null,
});

const toMajooImport = (r: any): MajooImport => ({
  id: r.id,
  imported_at: r.imported_at,
  imported_by: r.imported_by ?? null,
  imported_by_name: r.imported_by_name ?? null,
  file_name: r.file_name ?? null,
  periode_start: r.periode_start ?? null,
  periode_end: r.periode_end ?? null,
  total_rows: r.total_rows || 0,
  matched_count: r.matched_count || 0,
  unmatched_count: r.unmatched_count || 0,
  skipped_count: r.skipped_count || 0,
  total_exp_added: r.total_exp_added || 0,
  total_koin_added: r.total_koin_added || 0,
  total_nominal: r.total_nominal || 0,
  status: r.status || 'pending',
  notes: r.notes ?? null,
  skip_reasons: r.skip_reasons ?? null,
});

const toUnmatched = (r: any): UnmatchedTransaction => ({
  id: r.id,
  import_id: r.import_id ?? null,
  majoo_transaction_id: r.majoo_transaction_id ?? null,
  majoo_phone: r.majoo_phone ?? null,
  majoo_phone_normalized: r.majoo_phone_normalized ?? null,
  majoo_customer_name: r.majoo_customer_name ?? null,
  transaction_date: r.transaction_date ?? null,
  total_nominal: r.total_nominal || 0,
  reason: r.reason ?? null,
  status: r.status || 'pending',
  assigned_member_id: r.assigned_member_id ?? null,
  resolved_at: r.resolved_at ?? null,
  resolved_by: r.resolved_by ?? null,
  resolved_by_name: r.resolved_by_name ?? null,
  notes: r.notes ?? null,
  created_at: r.created_at,
});

async function fetchTable(table: string, orderBy = 'created_at', asc = false) {
  const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending: asc });
  if (error) {
    console.error(`Fetch ${table}:`, error);
    return [];
  }
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
  const [majooImports, setMajooImports] = useState<MajooImport[]>([]);
  const [unmatchedTxs, setUnmatchedTxs] = useState<UnmatchedTransaction[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesD, tiersD, staffD, membersD, presetsD, ciD, txD] = await Promise.all([
        fetchTable('roles'),
        fetchTable('tier_settings', 'sort_order', true),
        fetchTable('staff'),
        fetchTable('members'),
        fetchTable('tx_presets'),
        fetchTable('checkins'),
        fetchTable('transactions'),
      ]);

      const majooImportsD = await fetchTable('majoo_imports', 'imported_at', false).catch(() => [] as any[]);
      const unmatchedRes = await supabase.from('unmatched_transactions').select('*').eq('status','pending').order('created_at',{ascending:false});
      const unmatchedD = unmatchedRes.data || [];

      const mappedRoles = mergeRolesWithDefaults(rolesD.map(toRole));

      setRoles(mappedRoles);
      setTiers(tiersD.map(toTier));
      setStaffList(staffD.map(toStaff));
      setMembers(membersD.map(toMember));
      setPresets(presetsD.map(toPreset));

      const today = new Date().toISOString().split('T')[0];
      setCheckins(
        ciD
          .filter((c:any) => (c.checked_in_at || c.created_at)?.startsWith(today))
          .map(toCheckin)
      );
      setTransactions(txD.map(toTx));
      setMajooImports(majooImportsD.map(toMajooImport));
      setUnmatchedTxs(unmatchedD.map(toUnmatched));
    } catch (e) {
      console.error('Load error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── CRUD ──
  const upsertRole = async (role: RoleConfig) => {
    const payload = {
      id: role.id,
      slug: role.slug || role.name.toLowerCase().replace(/\s+/g,'_'),
      name: role.name,
      description: role.description,
      toggle_perms: role.togglePerms,
      level_perms: role.levelPerms,
      is_system: role.is_system
    };
    const { error } = await supabase.from('roles').upsert(payload);
    if (!error) {
      setRoles(p => {
        const ex = p.find(r => r.id === role.id);
        return ex ? p.map(r => r.id === role.id ? role : r) : [...p, role];
      });
    }
    return !error;
  };

  const deleteRole = async (id: string) => {
    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (!error) setRoles(p => p.filter(r => r.id !== id));
    return !error;
  };

  const upsertTier = async (tier: TierConfig) => {
    const { error } = await supabase.from('tier_settings').update({
      name: tier.name,
      min_exp: tier.min_exp,
      max_exp: tier.max_exp,
      benefits: tier.benefits,
      bg: tier.bg,
      text_color: tier.text,
      badge_text: tier.badgeText,
    }).eq('id', tier.id);
    if (!error) setTiers(p => p.map(t => t.id === tier.id ? tier : t));
    return !error;
  };

  const upsertStaff = async (s: Staff) => {
    const payload = {
      id: s.id,
      full_name: s.full_name,
      email: s.email,
      role_slugs: s.role_ids,
      is_active: s.is_active,
      pin: s.pin
    };
    const { data, error } = await supabase.from('staff').upsert(payload).select().single();
    if (!error && data) {
      const st = toStaff(data);
      setStaffList(p => {
        const ex = p.find(x => x.id === st.id);
        return ex ? p.map(x => x.id === st.id ? st : x) : [...p, st];
      });
    }
    return !error;
  };

  const upsertMember = async (m: Partial<Member> & { id?: string }) => {
    const payload: any = {
      full_name: m.full_name,
      email: m.email,
      phone: m.phone,
      date_of_birth: m.date_of_birth,
      is_active: m.is_active ?? true,
      total_exp: m.total_exp ?? 0,
      koin_balance: m.koin_balance ?? 0
    };
    if (m.id) payload.id = m.id;
    const { data, error } = await supabase.from('members').upsert(payload).select().single();
    if (!error && data) {
      const mem = toMember(data);
      setMembers(p => {
        const ex = p.find(x => x.id === mem.id);
        return ex ? p.map(x => x.id === mem.id ? mem : x) : [mem, ...p];
      });
      return mem;
    }
    return null;
  };

  const updateMemberBalance = async (memberId: string, addExp: number, addKoin: number) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return false;

    const { error } = await supabase
      .from('members')
      .update({
        total_exp: member.total_exp + addExp,
        coin_balance: member.koin_balance + addKoin
      })
      .eq('id', memberId);

    if (!error) {
      setMembers(p => p.map(m => m.id === memberId
        ? { ...m, total_exp: m.total_exp + addExp, koin_balance: m.koin_balance + addKoin }
        : m
      ));
    }
    return !error;
  };

  const upsertPreset = async (p: TxPreset) => {
    const payload = {
      id: p.id,
      label: p.label,
      description: p.description,
      exp_amount: p.exp_amount,
      koin_amount: p.koin_amount,
      category: p.category,
      allowed_role_slugs: p.allowed_role_ids,
      requires_pin: p.requires_pin,
      is_active: p.is_active,
      icon_url: p.icon_url
    };
    const { data, error } = await supabase.from('tx_presets').upsert(payload).select().single();
    if (!error && data) {
      const pr = toPreset(data);
      setPresets(prev => {
        const ex = prev.find(x => x.id === pr.id);
        return ex ? prev.map(x => x.id === pr.id ? pr : x) : [...prev, pr];
      });
    }
    return !error;
  };

  const deletePreset = async (id: string) => {
    const { error } = await supabase.from('tx_presets').delete().eq('id', id);
    if (!error) setPresets(p => p.filter(x => x.id !== id));
    return !error;
  };

  const addCheckin = async (ci: Omit<CheckIn, 'id'>) => {
    const { data, error } = await supabase.from('checkins').insert({
      member_id: ci.member_id,
      checked_in_by: ci.checked_in_by,
      staff_name: ci.staff_name,
      checked_in_at: ci.checked_in_at,
      exp_earned: ci.exp_earned
    }).select().single();
    if (!error && data) setCheckins(p => [toCheckin(data), ...p]);
    return !error;
  };

  const addTransaction = async (tx: Omit<Transaction, 'id'>) => {
    const { data, error } = await supabase.from('transactions').insert({
      member_id: tx.member_id,
      exp_amount: tx.exp_amount,
      koin_amount: tx.koin_amount,
      description: tx.description,
      preset_id: tx.preset_id,
      created_by: tx.created_by,
      staff_name: tx.staff_name,
      source: tx.source ?? 'manual',
      majoo_import_id: tx.majoo_import_id ?? null,
      majoo_transaction_id: tx.majoo_transaction_id ?? null,
      nominal_amount: tx.nominal_amount ?? null,
    }).select().single();
    if (!error && data) setTransactions(p => [toTx(data), ...p]);
    return !error;
  };

  // ── Fetch majoo imports (refresh manual) ──
  const fetchMajooImports = async () => {
    const data = await fetchTable('majoo_imports', 'imported_at', false).catch(() => []);
    setMajooImports(data.map(toMajooImport));
  };

  // ── Fetch unmatched yang masih pending ──
  const fetchUnmatchedTxs = async () => {
    const { data } = await supabase
      .from('unmatched_transactions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setUnmatchedTxs((data || []).map(toUnmatched));
  };

  // ── Cari member berdasarkan normalized phone ──
  const findMemberByPhone = async (normalizedPhone: string): Promise<Member | null> => {
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('phone_normalized', normalizedPhone)
      .limit(1);
    return data && data.length > 0 ? toMember(data[0]) : null;
  };

  // ── Simpan hasil import Majoo ke DB ──
  const createMajooImport = async (payload: Omit<MajooImport, 'id' | 'imported_at'>): Promise<MajooImport | null> => {
    const { data, error } = await supabase.from('majoo_imports').insert(payload).select().single();
    if (error || !data) return null;
    const record = toMajooImport(data);
    setMajooImports(p => [record, ...p]);
    return record;
  };

  const updateMajooImport = async (id: string, updates: Partial<MajooImport>) => {
    const { error } = await supabase.from('majoo_imports').update(updates).eq('id', id);
    if (!error) setMajooImports(p => p.map(m => m.id === id ? { ...m, ...updates } : m));
    return !error;
  };

  // ── Tambah unmatched transaction ke queue ──
  const addUnmatchedTx = async (payload: Omit<UnmatchedTransaction, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('unmatched_transactions').insert(payload).select().single();
    if (!error && data) setUnmatchedTxs(p => [toUnmatched(data), ...p]);
    return !error;
  };

  // ── Assign unmatched ke member ──
  const resolveUnmatchedTx = async (
    unmatchedId: string,
    memberId: string,
    staffId: string,
    staffName: string,
  ) => {
    const { error } = await supabase.from('unmatched_transactions').update({
      status: 'assigned',
      assigned_member_id: memberId,
      resolved_at: new Date().toISOString(),
      resolved_by: staffId,
      resolved_by_name: staffName,
    }).eq('id', unmatchedId);
    if (!error) setUnmatchedTxs(p => p.filter(u => u.id !== unmatchedId));
    return !error;
  };

  // ── Skip unmatched (non-member) ──
  const skipUnmatchedTx = async (unmatchedId: string, staffId: string, staffName: string, notes?: string) => {
    const { error } = await supabase.from('unmatched_transactions').update({
      status: 'skipped',
      resolved_at: new Date().toISOString(),
      resolved_by: staffId,
      resolved_by_name: staffName,
      notes: notes ?? null,
    }).eq('id', unmatchedId);
    if (!error) setUnmatchedTxs(p => p.filter(u => u.id !== unmatchedId));
    return !error;
  };

  return {
    loading,
    roles,
    setRoles,
    tiers,
    setTiers,
    staffList,
    setStaffList,
    members,
    setMembers,
    presets,
    setPresets,
    checkins,
    setCheckins,
    transactions,
    setTransactions,
    loadAll,
    upsertRole,
    deleteRole,
    upsertTier,
    upsertStaff,
    upsertMember,
    updateMemberBalance,
    upsertPreset,
    deletePreset,
    addCheckin,
    addTransaction,
    // Majoo
    majooImports,
    setMajooImports,
    unmatchedTxs,
    setUnmatchedTxs,
    fetchMajooImports,
    fetchUnmatchedTxs,
    findMemberByPhone,
    createMajooImport,
    updateMajooImport,
    addUnmatchedTx,
    resolveUnmatchedTx,
    skipUnmatchedTx,
  };
}

// ── Auth ──
export async function loginStaff(email: string, password: string): Promise<{ staff: Staff | null; error: string | null }> {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('email', email)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return { staff: null, error: 'Staff tidak ditemukan atau nonaktif' };
  }

  if (password !== 'nomono2025') {
    return { staff: null, error: 'Password salah' };
  }

  return { staff: toStaff(data), error: null };
}

export async function logoutStaff() { return; }
