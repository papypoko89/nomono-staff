import React, { useState } from 'react';
import { IC, Av, Badge } from '../components/ui';
import type { Staff, Member, TierConfig, RoleConfig } from '../lib/types';
import { getTier } from '../lib/types';
import type { UnmatchedTransaction } from '../lib/types';

const REASON_LABELS: Record<string, string> = {
  no_phone: 'Tanpa HP',
  invalid_phone: 'HP Tidak Valid',
  phone_not_found: 'HP Tidak Terdaftar',
};

interface Props {
  staff: Staff;
  roles: RoleConfig[];
  tiers: TierConfig[];
  members: Member[];
  unmatchedTxs: UnmatchedTransaction[];
  onBack: () => void;
  resolveUnmatchedTx: (id: string, memberId: string, staffId: string, staffName: string) => Promise<boolean>;
  skipUnmatchedTx: (id: string, staffId: string, staffName: string, notes?: string) => Promise<boolean>;
  addTransaction: (tx: any) => Promise<boolean>;
  updateMemberBalance: (memberId: string, exp: number, koin: number) => Promise<boolean>;
}

export default function UnmatchedReviewPage({
  staff,
  tiers,
  members,
  unmatchedTxs,
  onBack,
  resolveUnmatchedTx,
  skipUnmatchedTx,
  addTransaction,
  updateMemberBalance,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const active = unmatchedTxs.find(u => u.id === activeId) ?? null;

  // Hasil pencarian member
  const memberResults = searchQ.length >= 2
    ? members.filter(m =>
        m.is_active && (
          m.full_name.toLowerCase().includes(searchQ.toLowerCase()) ||
          m.phone?.includes(searchQ) ||
          m.email.toLowerCase().includes(searchQ.toLowerCase())
        )
      ).slice(0, 8)
    : [];

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  };

  // Assign ke member
  const doAssign = async (unmatched: UnmatchedTransaction, member: Member) => {
    setLoadingId(unmatched.id);
    try {
      const multiplier = Math.floor((unmatched.total_nominal || 0) / 10000);
      const exp = multiplier * 100;
      const koin = multiplier * 10;

      await addTransaction({
        member_id: member.id,
        exp_amount: exp,
        koin_amount: koin,
        description: `Import Majoo (manual assign) — ${unmatched.majoo_transaction_id || ''}`,
        preset_id: null,
        created_by: staff.id,
        staff_name: staff.full_name,
        source: 'majoo',
        majoo_import_id: unmatched.import_id,
        majoo_transaction_id: unmatched.majoo_transaction_id,
        nominal_amount: unmatched.total_nominal,
      });

      await updateMemberBalance(member.id, exp, koin);
      await resolveUnmatchedTx(unmatched.id, member.id, staff.id, staff.full_name);

      setActiveId(null);
      setSearchQ('');
      showFlash(`✓ Assigned ke ${member.full_name} — +${exp} EXP, +${koin} Koin`);
    } finally {
      setLoadingId(null);
    }
  };

  // Skip (bukan member)
  const doSkip = async (unmatched: UnmatchedTransaction) => {
    setLoadingId(unmatched.id);
    try {
      await skipUnmatchedTx(unmatched.id, staff.id, staff.full_name, 'Non-member');
      setActiveId(null);
      showFlash('Transaksi di-skip');
    } finally {
      setLoadingId(null);
    }
  };

  // ── Detail panel ──
  if (active) {
    const multiplier = Math.floor((active.total_nominal || 0) / 10000);
    const expEstimate = multiplier * 100;
    const koinEstimate = multiplier * 10;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { setActiveId(null); setSearchQ(''); }} style={{ color: '#231F2088' }}>{IC.back}</button>
          <h1 className="font-mono text-sm font-bold" style={{ color: '#231F20' }}>Assign Transaksi</h1>
          <div className="w-5" />
        </div>

        {/* Info transaksi */}
        <div className="p-4 rounded-lg border space-y-2" style={{ borderColor: '#C39A4B33', background: '#C39A4B08' }}>
          <div className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: '#C39A4B' }}>Transaksi Unmatched</div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px]" style={{ color: '#231F2088' }}>No Transaksi</span>
            <span className="font-mono text-[10px] font-medium" style={{ color: '#231F20' }}>{active.majoo_transaction_id || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px]" style={{ color: '#231F2088' }}>Pelanggan</span>
            <span className="font-mono text-[10px] font-medium" style={{ color: '#231F20' }}>{active.majoo_customer_name || 'Guest'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px]" style={{ color: '#231F2088' }}>HP di Majoo</span>
            <span className="font-mono text-[10px] font-medium" style={{ color: '#231F20' }}>{active.majoo_phone || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px]" style={{ color: '#231F2088' }}>Total</span>
            <span className="font-mono text-[10px] font-bold" style={{ color: '#231F20' }}>
              Rp {(active.total_nominal || 0).toLocaleString('id-ID')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px]" style={{ color: '#231F2088' }}>Alasan</span>
            <span className="font-mono text-[10px]" style={{ color: '#C39A4B' }}>
              {REASON_LABELS[active.reason || ''] || active.reason || '—'}
            </span>
          </div>
          {expEstimate > 0 && (
            <div className="flex justify-between pt-1 border-t" style={{ borderColor: '#C39A4B22' }}>
              <span className="font-mono text-[10px]" style={{ color: '#231F2088' }}>Akan dapat</span>
              <span className="font-mono text-[10px] font-bold text-green-600">+{expEstimate} EXP · +{koinEstimate} Koin</span>
            </div>
          )}
        </div>

        {/* Cari member */}
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#231F2066' }}>
            Cari member untuk di-assign
          </div>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#231F2066' }}>{IC.search}</div>
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border font-mono text-sm focus:outline-none focus:border-[#C39A4B]"
              style={{ borderColor: '#231F2015', color: '#231F20' }}
              placeholder="Nama, HP, atau email..."
              autoFocus
            />
          </div>

          {searchQ.length >= 2 && (
            <div className="mt-2 space-y-1.5">
              {memberResults.length === 0
                ? <p className="font-mono text-xs text-center py-4" style={{ color: '#231F2088' }}>Tidak ditemukan</p>
                : memberResults.map(m => {
                    const tier = getTier(m.total_exp, tiers);
                    return (
                      <button
                        key={m.id}
                        onClick={() => doAssign(active, m)}
                        disabled={loadingId === active.id}
                        className="w-full flex items-center justify-between p-3 rounded-lg border hover:border-[#C39A4B55] text-left disabled:opacity-50"
                        style={{ borderColor: '#231F2015' }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Av name={m.full_name} size={36} tier={tier} />
                          <div className="min-w-0">
                            <div className="font-mono text-xs font-medium truncate" style={{ color: '#231F20' }}>{m.full_name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge tier={tier} />
                              {m.phone && <span className="font-mono text-[10px]" style={{ color: '#231F2066' }}>{m.phone}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="font-mono text-[10px] font-bold shrink-0" style={{ color: '#C39A4B' }}>Assign →</div>
                      </button>
                    );
                  })
              }
            </div>
          )}
        </div>

        {/* Skip */}
        <div className="pt-2 border-t" style={{ borderColor: '#231F2010' }}>
          <div className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#231F2066' }}>
            Atau lewati transaksi ini
          </div>
          <button
            onClick={() => doSkip(active)}
            disabled={loadingId === active.id}
            className="w-full py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest border disabled:opacity-50"
            style={{ borderColor: '#231F2015', color: '#231F2088' }}
          >
            Skip — Bukan Member
          </button>
        </div>
      </div>
    );
  }

  // ── Daftar unmatched ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} style={{ color: '#231F2088' }}>{IC.back}</button>
        <h1 className="font-mono text-sm font-bold" style={{ color: '#231F20' }}>Review Unmatched</h1>
        <div className="w-5" />
      </div>

      {flash && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center font-mono text-xs text-green-700 font-bold">
          {flash}
        </div>
      )}

      {unmatchedTxs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="font-mono text-3xl">✓</div>
          <div className="font-mono text-sm font-bold" style={{ color: '#003820' }}>Semua sudah ditangani</div>
          <div className="font-mono text-[10px]" style={{ color: '#231F2066' }}>Tidak ada transaksi yang perlu direview</div>
        </div>
      ) : (
        <>
          <p className="font-mono text-[10px]" style={{ color: '#231F2066' }}>
            {unmatchedTxs.length} transaksi menunggu — tap untuk assign ke member atau skip
          </p>

          <div className="space-y-2">
            {unmatchedTxs.map(u => (
              <button
                key={u.id}
                onClick={() => setActiveId(u.id)}
                className="w-full p-3 rounded-lg border text-left hover:border-[#C39A4B55]"
                style={{ borderColor: '#231F2015' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs font-medium truncate" style={{ color: '#231F20' }}>
                      {u.majoo_customer_name || 'Guest'}
                    </div>
                    <div className="font-mono text-[10px] mt-0.5" style={{ color: '#231F2066' }}>
                      {u.majoo_phone || 'Tanpa HP'} · {u.majoo_transaction_id || '—'}
                    </div>
                    <span className="inline-block mt-1 font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#C39A4B15', color: '#C39A4B' }}>
                      {REASON_LABELS[u.reason || ''] || u.reason || '—'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-bold" style={{ color: '#231F20' }}>
                      Rp {(u.total_nominal || 0).toLocaleString('id-ID')}
                    </div>
                    <div className="font-mono text-[10px] font-bold shrink-0 mt-1" style={{ color: '#C39A4B' }}>Review →</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
