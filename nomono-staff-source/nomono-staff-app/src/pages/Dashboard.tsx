import React from 'react';
import { Member, CheckIn, Transaction, Staff, TierConfig, RoleConfig, getTier, hasPerm, isBdayToday, isBdayTomorrow } from '../lib/types';
import { IC, Badge, Av, Stat, RolePills, TxAmt, fT } from '../components/ui';

export default function DashboardPage({members,checkins,transactions,onNav,staff,tiers,roles}:{members:Member[];checkins:CheckIn[];transactions:Transaction[];onNav:(p:string)=>void;staff:Staff;tiers:TierConfig[];roles:RoleConfig[]}) {
  const tierCounts=members.reduce((a,m)=>{const t=getTier(m.total_exp,tiers);a[t.name]=(a[t.name]||0)+1;return a;},{} as Record<string,number>);
  const recentTx=[...transactions].sort((a,b)=>+new Date(b.created_at)-+new Date(a.created_at)).slice(0,5);
  const bdToday=members.filter(m=>m.is_active&&isBdayToday(m.date_of_birth));
  const bdTmr=members.filter(m=>m.is_active&&isBdayTomorrow(m.date_of_birth));
  const canScan=hasPerm(staff,roles,'checkin')||hasPerm(staff,roles,'assign_activity');
  const canViewTx=hasPerm(staff,roles,'view_transactions');

  return(<div className="space-y-6">
    <div><h1 className="font-mono text-xl font-bold" style={{color:'#231F20'}}>Halo, {staff.full_name.split(' ')[0]}</h1><p className="font-mono text-xs mt-0.5" style={{color:'#231F2088'}}>{new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p></div>
    {(bdToday.length>0||bdTmr.length>0)&&(<div className="rounded-lg p-4 border-2 border-[#C39A4B]" style={{background:'#C39A4B08'}}>
      <div className="flex items-center gap-2 mb-2" style={{color:'#C39A4B'}}>{IC.cake}<span className="font-mono text-[10px] uppercase tracking-widest font-bold">Birthday Alert</span></div>
      {bdToday.map(m=><div key={m.id} className="flex items-center gap-3 py-1.5"><Av name={m.full_name} size={28} tier={getTier(m.total_exp,tiers)}/><span className="font-mono text-xs font-bold" style={{color:'#231F20'}}>{m.full_name}</span><span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#C39A4B] text-white font-bold">HARI INI 🎂</span></div>)}
      {bdTmr.map(m=><div key={m.id} className="flex items-center gap-3 py-1.5"><Av name={m.full_name} size={28} tier={getTier(m.total_exp,tiers)}/><span className="font-mono text-xs font-bold" style={{color:'#231F20'}}>{m.full_name}</span><span className="font-mono text-[10px] px-1.5 py-0.5 rounded font-medium" style={{background:'#C39A4B22',color:'#C39A4B'}}>BESOK</span></div>)}
    </div>)}
    <div className="grid grid-cols-2 gap-3">
      <Stat label="Active Members" value={members.filter(m=>m.is_active).length} accent="#003820"/>
      <Stat label="Check-in Hari Ini" value={checkins.length} accent="#C39A4B"/>
      <Stat label="EXP Hari Ini" value={transactions.reduce((s,t)=>s+t.exp_amount,0)} accent="#4A6741" suf=" EXP"/>
      <Stat label="Koin Beredar" value={members.reduce((s,m)=>s+m.koin_balance,0).toLocaleString()} accent="#8B6914" suf=" K"/>
    </div>
    <div className="rounded-lg p-4 border" style={{borderColor:'#231F2010'}}><h3 className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{color:'#231F2088'}}>Distribusi Tier</h3><div className="flex gap-2">{tiers.map(t=><div key={t.id} className="flex-1 text-center"><div className="font-mono text-xl font-bold" style={{color:t.text}}>{tierCounts[t.name]||0}</div><div className="mt-0.5"><Badge tier={t}/></div></div>)}</div></div>
    <div className="grid grid-cols-2 gap-3">
      {canScan&&<button onClick={()=>onNav('scan')} className="flex items-center gap-3 p-4 rounded-lg border hover:border-[#C39A4B] text-left" style={{borderColor:'#231F2010'}}><div style={{color:'#003820'}}>{IC.scan}</div><div><div className="font-mono text-sm font-bold" style={{color:'#231F20'}}>Scan</div><div className="font-mono text-[10px]" style={{color:'#231F2088'}}>Scan member</div></div></button>}
      <button onClick={()=>onNav('members')} className="flex items-center gap-3 p-4 rounded-lg border hover:border-[#C39A4B] text-left" style={{borderColor:'#231F2010'}}><div style={{color:'#003820'}}>{IC.members}</div><div><div className="font-mono text-sm font-bold" style={{color:'#231F20'}}>Members</div><div className="font-mono text-[10px]" style={{color:'#231F2088'}}>Lihat semua</div></div></button>
    </div>
    {canViewTx&&<div><h3 className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{color:'#231F2088'}}>Transaksi Terbaru</h3><div className="space-y-2">{recentTx.map(tx=>{const m=members.find(x=>x.id===tx.member_id);return(<div key={tx.id} className="p-3 rounded-lg border" style={{borderColor:'#231F2010'}}><div className="flex items-center justify-between"><div className="flex items-center gap-3 min-w-0 flex-1">{m&&<Av name={m.full_name} size={32} tier={getTier(m.total_exp,tiers)}/>}<div className="min-w-0"><div className="font-mono text-xs font-medium truncate" style={{color:'#231F20'}}>{m?.full_name}</div><div className="font-mono text-[10px]" style={{color:'#231F2088'}}>{tx.description}</div></div></div><div className="shrink-0 ml-2"><TxAmt exp={tx.exp_amount} koin={tx.koin_amount} compact/></div></div><div className="flex justify-between mt-1.5"><div className="font-mono text-[9px] flex items-center gap-1" style={{color:'#231F2066'}}>{IC.staff} {tx.staff_name}</div><div className="font-mono text-[9px]" style={{color:'#231F2066'}}>{fT(tx.created_at)}</div></div></div>);})}</div></div>}
  </div>);
}
