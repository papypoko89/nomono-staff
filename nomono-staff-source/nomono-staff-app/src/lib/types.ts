// ── Permission keys ──
export type TogglePerm = 'checkin'|'assign_activity'|'view_members'|'edit_members'|'view_transactions'|'approve_pin';
export type LevelPerm = 'master_presets'|'master_tiers'|'master_roles'|'manage_staff';
export type PermKey = TogglePerm | LevelPerm;
export type PermLevel = 'none'|'view'|'modify';

export const TOGGLE_PERMS: {key:TogglePerm;label:string}[] = [
  {key:'checkin',label:'Check-in Member'},
  {key:'assign_activity',label:'Assign Aktivitas'},
  {key:'view_members',label:'Lihat Data Member'},
  {key:'edit_members',label:'Tambah/Edit Member'},
  {key:'view_transactions',label:'Lihat Transaksi'},
  {key:'approve_pin',label:'Approve PIN'},
];
export const LEVEL_PERMS: {key:LevelPerm;label:string}[] = [
  {key:'master_presets',label:'Master Transaksi'},
  {key:'master_tiers',label:'Master Tier'},
  {key:'master_roles',label:'Master Roles'},
  {key:'manage_staff',label:'Kelola Staff'},
];

// ── Role (dynamic) ──
export interface RoleConfig {
  id: string;
  slug?: string;
  name: string;
  description: string;
  togglePerms: Record<TogglePerm, boolean>;
  levelPerms: Record<LevelPerm, PermLevel>;
  is_system: boolean;
}

export type PresetCategory = 'court'|'fnb'|'merchandise'|'event'|'bonus'|'redeem';

export interface TierConfig {
  id: string; name: string; min_exp: number; max_exp: number|null;
  benefits: string[]; bg: string; text: string; badgeText: string;
}

export interface Member {
  id: string; full_name: string; email: string; phone: string|null;
  avatar_url: string|null; date_of_birth: string|null;
  joined_at: string; is_active: boolean; total_exp: number; koin_balance: number;
}

export interface Staff {
  id: string; full_name: string; email: string;
  role_ids: string[]; // references RoleConfig.id — can have multiple
  is_active: boolean; pin?: string;
}

export interface TxPreset {
  id: string; label: string; description: string;
  exp_amount: number; koin_amount: number;
  category: PresetCategory; allowed_role_ids: string[];
  requires_pin: boolean; is_active: boolean; icon_url?: string|null;
}

export interface CheckIn {
  id: string; member_id: string; checked_in_by: string; staff_name: string;
  checked_in_at: string; exp_earned: number;
}

export interface Transaction {
  id: string; member_id: string; exp_amount: number; koin_amount: number;
  description: string; preset_id: string|null;
  created_by: string; staff_name: string; created_at: string;
}

export const CHECK_IN_EXP = 25;

// ── Helper: check if staff has a toggle permission via any of their roles ──
export function hasPerm(staff: Staff, roles: RoleConfig[], perm: TogglePerm): boolean {
  return staff.role_ids.some(rid => {
    const r = roles.find(x=>x.id===rid);
    return r?.togglePerms[perm] === true;
  });
}

// ── Helper: get highest level permission across staff's roles ──
export function getLevel(staff: Staff, roles: RoleConfig[], perm: LevelPerm): PermLevel {
  let best: PermLevel = 'none';
  for (const rid of staff.role_ids) {
    const r = roles.find(x=>x.id===rid);
    if (!r) continue;
    const l = r.levelPerms[perm];
    if (l === 'modify') return 'modify';
    if (l === 'view' && best === 'none') best = 'view';
  }
  return best;
}

// ── Helper: can staff use this preset? ──
export function canUsePreset(staff: Staff, preset: TxPreset): boolean {
  return staff.role_ids.some(rid => preset.allowed_role_ids.includes(rid));
}

export function getTier(exp: number, tiers: TierConfig[]): TierConfig {
  return [...tiers].sort((a,b)=>b.min_exp-a.min_exp).find(t=>exp>=t.min_exp) || tiers[0];
}
export function nextTierExp(t: TierConfig): number|null { return t.max_exp!==null?t.max_exp+1:null; }

export const CAT_LABELS: Record<PresetCategory,string> = {court:'Court',fnb:'F&B',merchandise:'Merchandise',event:'Event',bonus:'Bonus',redeem:'Redeem'};

export const isBdayToday=(d:string|null)=>{if(!d)return false;const t=new Date(),x=new Date(d);return x.getMonth()===t.getMonth()&&x.getDate()===t.getDate();};
export const isBdayTomorrow=(d:string|null)=>{if(!d)return false;const t=new Date();t.setDate(t.getDate()+1);const x=new Date(d);return x.getMonth()===t.getMonth()&&x.getDate()===t.getDate();};

// ── Default Tiers ──
export const DEFAULT_TIERS: TierConfig[] = [
  {id:'tier1',name:'Rookie',min_exp:0,max_exp:499,benefits:['Welcome drink','Birthday bonus 50 Koin'],bg:'#4A6741',text:'#4A6741',badgeText:'#fff'},
  {id:'tier2',name:'Rally',min_exp:500,max_exp:1499,benefits:['10% F&B discount','Priority booking','Birthday bonus 100 Koin'],bg:'#C39A4B',text:'#8B6914',badgeText:'#fff'},
  {id:'tier3',name:'Smash',min_exp:1500,max_exp:3999,benefits:['15% F&B discount','1 free court/month','Birthday bonus 200 Koin'],bg:'#6B6340',text:'#6B6340',badgeText:'#fff'},
  {id:'tier4',name:'Ace',min_exp:4000,max_exp:null,benefits:['20% all discount','2 free court/month','VIP lounge','Birthday bonus 500 Koin'],bg:'#003820',text:'#003820',badgeText:'#E0DBBC'},
];

// ── Default Roles ──
const allToggleOn: Record<TogglePerm,boolean> = {checkin:true,assign_activity:true,view_members:true,edit_members:true,view_transactions:true,approve_pin:true};
const allLevelMod: Record<LevelPerm,PermLevel> = {master_presets:'modify',master_tiers:'modify',master_roles:'modify',manage_staff:'modify'};
const allToggleOff: Record<TogglePerm,boolean> = {checkin:false,assign_activity:false,view_members:false,edit_members:false,view_transactions:false,approve_pin:false};
const allLevelNone: Record<LevelPerm,PermLevel> = {master_presets:'none',master_tiers:'none',master_roles:'none',manage_staff:'none'};

export const DEFAULT_ROLES: RoleConfig[] = [
  {id:'role_manager',name:'Manager',description:'Akses penuh ke semua fitur',togglePerms:{...allToggleOn},levelPerms:{...allLevelMod},is_system:true},
  {id:'role_fd',name:'Front Desk',description:'Check-in, assign court/event',togglePerms:{...allToggleOff,checkin:true,assign_activity:true,view_members:true,view_transactions:true},levelPerms:{...allLevelNone},is_system:false},
  {id:'role_fnb',name:'F&B',description:'Assign F&B, redeem F&B',togglePerms:{...allToggleOff,assign_activity:true,view_members:true},levelPerms:{...allLevelNone},is_system:false},
  {id:'role_merchant',name:'Merchant',description:'Assign merchandise, redeem',togglePerms:{...allToggleOff,assign_activity:true,view_members:true},levelPerms:{...allLevelNone},is_system:false},
];
