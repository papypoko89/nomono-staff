import React, { useState } from 'react';
import {
  Member,
  CheckIn,
  Transaction,
  Staff,
  TierConfig,
  RoleConfig,
  CHECK_IN_EXP,
  getTier,
  hasPerm,
} from '../lib/types';
import { IC, Badge, Av, fT } from '../components/ui';

export default function ScanPage({
  members,
  checkins,
  setCheckins,
  setMembers,
  setTransactions,
  staff,
  tiers,
  roles,
  onViewMember,
  updateMemberBalance
}:{
  members:Member[];
  checkins:CheckIn[];
  setCheckins:React.Dispatch<React.SetStateAction<CheckIn[]>>;
  setMembers:React.Dispatch<React.SetStateAction<Member[]>>;
  setTransactions:React.Dispatch<React.SetStateAction<Transaction[]>>;
  staff:Staff;
  tiers:TierConfig[];
  roles:RoleConfig[];
  onViewMember:(id:string)=>void;
  updateMemberBalance:(memberId:string, addExp:number, addKoin:number)=>Promise<boolean>;
}) {
  const [q,setQ]=useState('');
  const [scanMode,setScanMode]=useState(false);
  const [target,setTarget]=useState<Member|null>(null);
  const [flash,setFlash]=useState<string|null>(null);

  const canCI=hasPerm(staff,roles,'checkin');
  const ciIds=new Set(checkins.map(c=>c.member_id));

  const results=q.length>=2
    ?members.filter(m=>
      m.is_active&&(
        m.full_name.toLowerCase().includes(q.toLowerCase())||
        m.phone?.includes(q)||
        m.email.toLowerCase().includes(q.toLowerCase())
      )
    )
    :[];

  const pick=(m:Member)=>{
    setTarget(m);
    setQ('');
    setScanMode(false);
  };

  const doCheckin=async()=>{
    if(!target||!canCI)return;
    const alreadyCI=ciIds.has(target.id);
    if(alreadyCI)return;

    const now=Date.now();
    const ciAt=new Date().toISOString();

    setCheckins(p=>[
      {
        id:`c${now}`,
        member_id:target.id,
        checked_in_by:staff.id,
        staff_name:staff.full_name,
        checked_in_at:ciAt,
        exp_earned:CHECK_IN_EXP
      },
      ...p
    ]);

    setTransactions(p=>[
      {
        id:`tx${now}`,
        member_id:target.id,
        exp_amount:CHECK_IN_EXP,
        koin_amount:0,
        description:'Check-in reward',
        preset_id:null,
        created_by:staff.id,
        staff_name:staff.full_name,
        created_at:ciAt,
        source:'manual'
      },
      ...p
    ]);

    setMembers(p=>p.map(m=>m.id===target.id?{...m,total_exp:m.total_exp+CHECK_IN_EXP}:m));
    await updateMemberBalance(target.id,CHECK_IN_EXP,0);

    setFlash(`✓ ${target.full_name} — Check-in +${CHECK_IN_EXP} EXP`);
    setTarget(null);
    setTimeout(()=>setFlash(null),3000);
  };

  // ── Detail member yang dipilih ──
  if(target){
    const tier=getTier(target.total_exp,tiers);
    const alreadyCI=ciIds.has(target.id);
    const ci=checkins.find(c=>c.member_id===target.id);

    return(
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={()=>setTarget(null)} style={{color:'#231F2088'}}>{IC.back}</button>
          <h1 className="font-mono text-sm font-bold" style={{color:'#231F20'}}>Check-in Member</h1>
          <div className="w-5"/>
        </div>

        {flash&&(
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center font-mono text-xs text-green-700 font-bold">
            {flash}
          </div>
        )}

        {/* Card member */}
        <div className="p-4 rounded-lg border-2 flex items-center gap-3" style={{borderColor:tier.text,background:`${tier.text}08`}}>
          <Av name={target.full_name} size={48} tier={tier}/>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm font-bold truncate" style={{color:'#231F20'}}>{target.full_name}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge tier={tier}/>
              <span className="font-mono text-[10px]" style={{color:'#231F20'}}>{target.total_exp} EXP</span>
              <span className="font-mono text-[10px]" style={{color:'#C39A4B'}}>{target.koin_balance} Koin</span>
            </div>
            {target.phone&&(
              <div className="font-mono text-[10px] mt-0.5" style={{color:'#231F2066'}}>{target.phone}</div>
            )}
          </div>
        </div>

        {/* Status check-in */}
        {alreadyCI?(
          <div className="p-4 rounded-lg text-center border" style={{background:'#00382008',borderColor:'#00382020'}}>
            <div className="font-mono text-xs font-bold" style={{color:'#003820'}}>✓ Sudah check-in hari ini</div>
            {ci&&(
              <div className="font-mono text-[10px] mt-1" style={{color:'#231F2066'}}>
                pukul {fT(ci.checked_in_at)}
              </div>
            )}
          </div>
        ):(
          <div className="p-3 rounded-lg text-center font-mono text-xs font-medium" style={{background:'#003820',color:'#E0DBBC'}}>
            Check-in akan memberikan +{CHECK_IN_EXP} EXP
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={()=>setTarget(null)}
            className="flex-1 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest border"
            style={{borderColor:'#231F2015',color:'#231F2088'}}
          >
            Batal
          </button>
          <button
            onClick={doCheckin}
            disabled={!canCI||alreadyCI}
            className="flex-1 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold text-white disabled:opacity-40 hover:brightness-110 active:scale-[0.98]"
            style={{background:'#003820'}}
          >
            {alreadyCI?'Sudah Check-in':'Check-in +25 EXP'}
          </button>
        </div>
      </div>
    );
  }

  // ── Halaman utama scan ──
  return(
    <div className="space-y-5">
      <h1 className="font-mono text-xl font-bold" style={{color:'#231F20'}}>Scan Member</h1>

      {flash&&(
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center font-mono text-xs text-green-700 font-bold">
          {flash}
        </div>
      )}

      {/* Toggle QR / Manual */}
      <div className="flex gap-2">
        <button
          onClick={()=>setScanMode(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border font-mono text-xs uppercase tracking-widest"
          style={scanMode?{background:'#003820',color:'#E0DBBC',borderColor:'#003820'}:{borderColor:'#231F2015',color:'#231F2088'}}
        >
          {IC.scan} QR
        </button>
        <button
          onClick={()=>setScanMode(false)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border font-mono text-xs uppercase tracking-widest"
          style={!scanMode?{background:'#003820',color:'#E0DBBC',borderColor:'#003820'}:{borderColor:'#231F2015',color:'#231F2088'}}
        >
          {IC.search} Manual
        </button>
      </div>

      {scanMode?(
        <div className="rounded-lg border-2 border-dashed border-[#C39A4B] overflow-hidden">
          <div className="aspect-square max-h-[240px] flex flex-col items-center justify-center gap-4" style={{background:'#003820'}}>
            <div className="w-40 h-40 border-2 border-[#C39A4B] rounded-lg relative">
              <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-[3px] border-l-[3px] border-[#C39A4B] rounded-tl"/>
              <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-[3px] border-r-[3px] border-[#C39A4B] rounded-tr"/>
              <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-[3px] border-l-[3px] border-[#C39A4B] rounded-bl"/>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-[3px] border-r-[3px] border-[#C39A4B] rounded-br"/>
              <div className="absolute inset-x-2 h-0.5 bg-[#C39A4B] opacity-60 animate-[scanLine_2s_ease-in-out_infinite]"/>
            </div>
            <p className="font-mono text-[10px] text-[#E0DBBC88] uppercase tracking-widest">Arahkan ke QR member</p>
          </div>
        </div>
      ):(
        <>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:'#231F2066'}}>{IC.search}</div>
            <input
              value={q}
              onChange={e=>setQ(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border font-mono text-sm focus:outline-none focus:border-[#C39A4B]"
              style={{borderColor:'#231F2015',color:'#231F20'}}
              placeholder="Cari nama, phone, email..."
              autoFocus
            />
          </div>

          {q.length>=2&&(
            <div className="space-y-2">
              {results.length===0
                ?<p className="font-mono text-xs text-center py-6" style={{color:'#231F2088'}}>Tidak ditemukan</p>
                :results.map(m=>{
                  const tier=getTier(m.total_exp,tiers);
                  const done=ciIds.has(m.id);
                  return(
                    <button
                      key={m.id}
                      onClick={()=>pick(m)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:border-[#C39A4B55] text-left"
                      style={{borderColor:'#231F2015'}}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Av name={m.full_name} size={40} tier={tier}/>
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-medium truncate" style={{color:'#231F20'}}>{m.full_name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge tier={tier}/>
                            {done&&canCI&&<span className="text-[8px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-mono">✓ In</span>}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 font-mono text-[10px] uppercase tracking-widest font-bold" style={{color:'#C39A4B'}}>Pilih →</div>
                    </button>
                  );
                })}
            </div>
          )}
        </>
      )}

      {/* Daftar check-in hari ini */}
      {canCI&&checkins.length>0&&(
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{color:'#231F2088'}}>
            Check-in Hari Ini ({checkins.length})
          </h3>
          <div className="space-y-1.5">
            {checkins.map(ci=>{
              const m=members.find(x=>x.id===ci.member_id);
              if(!m)return null;
              const tier=getTier(m.total_exp,tiers);
              return(
                <div
                  key={ci.id}
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:border-[#C39A4B55]"
                  style={{borderColor:'#231F2010'}}
                  onClick={()=>onViewMember(m.id)}
                >
                  <div className="flex items-center gap-3">
                    <Av name={m.full_name} size={34} tier={tier}/>
                    <div>
                      <div className="font-mono text-xs font-medium" style={{color:'#231F20'}}>{m.full_name}</div>
                      <Badge tier={tier}/>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5" style={{color:'#231F2066'}}>
                    {IC.clock}
                    <span className="font-mono text-[10px]">{fT(ci.checked_in_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
