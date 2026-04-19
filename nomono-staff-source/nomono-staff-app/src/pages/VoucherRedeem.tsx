import React, { useState, useEffect, useRef } from 'react';
import { Staff } from '../lib/types';
import { supabase } from '../lib/supabase';
import { IC } from '../components/ui';

interface VoucherInfo {
  found: boolean;
  error?: string;
  redemption_id?: string;
  voucher_code?: string;
  status?: string;
  reward_name?: string;
  reward_icon?: string;
  reward_category?: string;
  member_name?: string;
  member_id?: string;
  coins_spent?: number;
  created_at?: string;
  expires_at?: string;
  redeemed_at?: string;
  staff_name?: string;
  nota_majoo?: string;
}

interface RedeemResult {
  success: boolean;
  voucher_code: string;
  reward_name: string;
  reward_icon: string;
  member_name: string;
  staff_name: string;
  nota_majoo?: string;
  redeemed_at: string;
}

interface Props {
  staff: Staff;
}

export default function VoucherRedeemPage({ staff }: Props) {
  const [mode, setMode] = useState<'scan'|'manual'>('manual');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [voucher, setVoucher] = useState<VoucherInfo|null>(null);
  const [notaMajoo, setNotaMajoo] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<RedeemResult|null>(null);
  const [error, setError] = useState('');
  const [recentRedeems, setRecentRedeems] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent redeems
  useEffect(() => {
    supabase
      .from('redemptions')
      .select('*, reward_catalog(name, icon)')
      .eq('status', 'redeemed')
      .order('redeemed_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setRecentRedeems(data); });
  }, [result]);

  const lookupVoucher = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setLoading(true); setError(''); setVoucher(null); setResult(null);

    const { data, error: err } = await supabase.rpc('lookup_voucher', { p_voucher_code: c });
    setLoading(false);

    if (err) {
      setError(err.message || 'Gagal lookup voucher');
      return;
    }

    if (!data?.found) {
      setError(data?.error || 'Voucher tidak ditemukan');
      return;
    }

    setVoucher(data as VoucherInfo);
  };

  const confirmRedeem = async () => {
    if (!voucher) return;
    setConfirming(true); setError('');

    const { data, error: err } = await supabase.rpc('confirm_voucher_redeem', {
      p_voucher_code: voucher.voucher_code,
      p_staff_id: staff.id,
      p_nota_majoo: notaMajoo.trim() || null,
    });
    setConfirming(false);

    if (err) {
      setError(err.message || 'Gagal redeem voucher');
      return;
    }

    setResult(data as RedeemResult);
    setVoucher(null);
    setCode('');
    setNotaMajoo('');
  };

  const reset = () => {
    setVoucher(null); setResult(null); setError(''); setCode(''); setNotaMajoo('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const fD = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const fDT = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const statusLabel: Record<string, { text: string; bg: string; color: string }> = {
    available: { text: 'AKTIF', bg: '#e8f0e4', color: '#2a8a50' },
    redeemed: { text: 'SUDAH DIPAKAI', bg: '#ffeaea', color: '#c44' },
    expired: { text: 'EXPIRED', bg: '#f5f2e8', color: '#a09a8a' },
  };

  return (
    <div className="space-y-5">
      <h1 className="font-mono text-xl font-bold" style={{ color: '#231F20' }}>Redeem Voucher</h1>

      {/* Success flash */}
      {result && (
        <div className="rounded-xl border-2 overflow-hidden animate-[fadeIn_0.3s]" style={{ borderColor: '#2a8a50', background: '#e8f0e4' }}>
          <div className="p-4 text-center">
            <div className="text-3xl mb-2">✅</div>
            <div className="font-mono text-sm font-bold" style={{ color: '#2a8a50' }}>Voucher Berhasil Di-Redeem!</div>
            <div className="mt-3 space-y-1">
              <div className="font-mono text-xs" style={{ color: '#231F20' }}>
                <span className="text-lg mr-1">{result.reward_icon}</span> {result.reward_name}
              </div>
              <div className="font-mono text-[10px]" style={{ color: '#6b6560' }}>
                Member: <strong>{result.member_name}</strong>
              </div>
              <div className="font-mono text-[10px]" style={{ color: '#6b6560' }}>
                Staff: <strong>{result.staff_name}</strong>
              </div>
              {result.nota_majoo && (
                <div className="font-mono text-[10px]" style={{ color: '#6b6560' }}>
                  Nota Majoo: <strong>{result.nota_majoo}</strong>
                </div>
              )}
              <div className="font-mono text-[10px]" style={{ color: '#a09a8a' }}>
                {fDT(result.redeemed_at)}
              </div>
            </div>
            <button onClick={reset} className="mt-4 px-6 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold text-white" style={{ background: '#003820' }}>
              Scan Berikutnya
            </button>
          </div>
        </div>
      )}

      {/* Error flash */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 font-mono text-xs text-red-600 animate-[fadeIn_0.3s]">
          {error}
        </div>
      )}

      {/* Input modes */}
      {!result && !voucher && (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => setMode('scan')}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border font-mono text-xs uppercase tracking-widest"
              style={mode === 'scan' ? { background: '#003820', color: '#E0DBBC', borderColor: '#003820' } : { borderColor: '#231F2015', color: '#231F2088' }}
            >
              {IC.scan} Scan QR
            </button>
            <button
              onClick={() => setMode('manual')}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border font-mono text-xs uppercase tracking-widest"
              style={mode === 'manual' ? { background: '#003820', color: '#E0DBBC', borderColor: '#003820' } : { borderColor: '#231F2015', color: '#231F2088' }}
            >
              {IC.search} Manual
            </button>
          </div>

          {mode === 'scan' ? (
            <div className="rounded-lg border-2 border-dashed border-[#C39A4B] overflow-hidden">
              <div className="aspect-square max-h-[240px] flex flex-col items-center justify-center gap-4" style={{ background: '#003820' }}>
                <div className="w-40 h-40 border-2 border-[#C39A4B] rounded-lg relative">
                  <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-[3px] border-l-[3px] border-[#C39A4B] rounded-tl" />
                  <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-[3px] border-r-[3px] border-[#C39A4B] rounded-tr" />
                  <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-[3px] border-l-[3px] border-[#C39A4B] rounded-bl" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-[3px] border-r-[3px] border-[#C39A4B] rounded-br" />
                  <div className="absolute inset-x-2 h-0.5 bg-[#C39A4B] opacity-60 animate-[scanLine_2s_ease-in-out_infinite]" />
                </div>
                <p className="font-mono text-[10px] text-[#E0DBBC88] uppercase tracking-widest">Scan QR voucher member</p>
              </div>
              <div className="p-3 text-center">
                <p className="font-mono text-[10px]" style={{ color: '#a09a8a' }}>Camera QR belum tersedia. Gunakan input manual.</p>
                <button onClick={() => setMode('manual')} className="mt-2 font-mono text-[10px] font-bold underline" style={{ color: '#003820' }}>Input Manual →</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: '#231F2088' }}>Kode Voucher</label>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
                    placeholder="NMN-XXXXXXXX"
                    className="flex-1 px-3 py-2.5 rounded-lg border font-mono text-sm tracking-wider focus:outline-none focus:border-[#C39A4B] uppercase"
                    style={{ borderColor: '#231F2015', color: '#231F20', background: '#FAFAF7' }}
                    onKeyDown={e => e.key === 'Enter' && lookupVoucher()}
                  />
                  <button
                    onClick={lookupVoucher}
                    disabled={!code.trim() || loading}
                    className="px-4 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold text-white disabled:opacity-40"
                    style={{ background: '#003820' }}
                  >
                    {loading ? '...' : 'CARI'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Voucher preview card */}
      {voucher && (
        <div className="rounded-xl border-2 overflow-hidden animate-[fadeIn_0.3s]" style={{
          borderColor: voucher.status === 'available' ? '#C39A4B' : voucher.status === 'redeemed' ? '#c44' : '#a09a8a'
        }}>
          <div className="p-4 space-y-3">
            {/* Status badge */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded"
                style={statusLabel[voucher.status || 'expired'] || statusLabel.expired}>
                {statusLabel[voucher.status || 'expired']?.text || 'UNKNOWN'}
              </span>
              <span className="font-mono text-xs tracking-wider" style={{ color: '#a09a8a' }}>{voucher.voucher_code}</span>
            </div>

            {/* Reward info */}
            <div className="flex items-center gap-3 py-2">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: '#003820' }}>
                {voucher.reward_icon}
              </div>
              <div>
                <div className="font-mono text-sm font-bold" style={{ color: '#231F20' }}>{voucher.reward_name}</div>
                <div className="font-mono text-[10px]" style={{ color: '#C39A4B' }}>🪙 {voucher.coins_spent} koin</div>
              </div>
            </div>

            {/* Member info */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: '#231F2006' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold" style={{ background: '#00382012', color: '#003820', border: '2px solid #003820' }}>
                {voucher.member_name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-mono text-xs font-medium" style={{ color: '#231F20' }}>{voucher.member_name}</div>
                <div className="font-mono text-[10px]" style={{ color: '#a09a8a' }}>Ditukar: {fD(voucher.created_at || '')}</div>
              </div>
            </div>

            {/* Expiry */}
            <div className="font-mono text-[10px]" style={{ color: '#6b6560' }}>
              Berlaku sampai: <strong>{fD(voucher.expires_at || '')}</strong>
            </div>

            {/* Already redeemed info */}
            {voucher.status === 'redeemed' && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
                <div className="font-mono text-[10px] text-red-600">
                  Sudah di-redeem oleh <strong>{voucher.staff_name || '-'}</strong> pada {fDT(voucher.redeemed_at || '')}
                  {voucher.nota_majoo && <><br/>Nota Majoo: <strong>{voucher.nota_majoo}</strong></>}
                </div>
              </div>
            )}

            {/* Confirm section — only for available vouchers */}
            {voucher.status === 'available' && (
              <div className="space-y-3 pt-2 border-t" style={{ borderColor: '#231F2010' }}>
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: '#231F2088' }}>
                    Nomor Nota Majoo <span style={{ color: '#a09a8a' }}>(opsional)</span>
                  </label>
                  <input
                    value={notaMajoo}
                    onChange={e => setNotaMajoo(e.target.value)}
                    placeholder="Contoh: MJ-20260419-001"
                    className="w-full px-3 py-2.5 rounded-lg border font-mono text-sm focus:outline-none focus:border-[#C39A4B]"
                    style={{ borderColor: '#231F2015', color: '#231F20', background: '#FAFAF7' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={reset} className="flex-1 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest border" style={{ borderColor: '#231F2015', color: '#231F2088' }}>
                    Batal
                  </button>
                  <button
                    onClick={confirmRedeem}
                    disabled={confirming}
                    className="flex-1 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold text-white disabled:opacity-40 hover:brightness-110 active:scale-[0.98]"
                    style={{ background: '#003820' }}
                  >
                    {confirming ? 'Processing...' : '✓ KONFIRMASI REDEEM'}
                  </button>
                </div>
              </div>
            )}

            {/* Close for non-available vouchers */}
            {voucher.status !== 'available' && (
              <button onClick={reset} className="w-full py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest border" style={{ borderColor: '#231F2015', color: '#231F2088' }}>
                Tutup
              </button>
            )}
          </div>
        </div>
      )}

      {/* Recent redeems */}
      {!voucher && !result && recentRedeems.length > 0 && (
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-widest mb-3" style={{ color: '#231F2088' }}>Riwayat Redeem</h3>
          <div className="space-y-1.5">
            {recentRedeems.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: '#231F2010' }}>
                <div className="flex items-center gap-3">
                  <div className="text-lg">{r.reward_catalog?.icon || '🎁'}</div>
                  <div>
                    <div className="font-mono text-xs font-medium" style={{ color: '#231F20' }}>
                      {r.reward_catalog?.name || 'Reward'}
                    </div>
                    <div className="font-mono text-[10px]" style={{ color: '#a09a8a' }}>
                      {r.voucher_code} • {r.staff_name || '-'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px]" style={{ color: '#6b6560' }}>
                    {fD(r.redeemed_at)}
                  </div>
                  {r.nota_majoo && <div className="font-mono text-[9px]" style={{ color: '#C39A4B' }}>#{r.nota_majoo}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
