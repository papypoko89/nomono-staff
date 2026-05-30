import React from 'react';
import { IC } from '../components/ui';
import type { Staff, RoleConfig } from '../lib/types';
import { hasPerm } from '../lib/types';

interface Props {
  staff: Staff;
  roles: RoleConfig[];
  unmatchedCount: number;
  lastImportAt: string | null;
  onImport: () => void;
  onHistory: () => void;
  onReview: () => void;
}

export default function MajooHubPage({
  staff,
  roles,
  unmatchedCount,
  lastImportAt,
  onImport,
  onHistory,
  onReview,
}: Props) {
  const canImport = hasPerm(staff, roles, 'import_majoo');
  const canReview = hasPerm(staff, roles, 'review_unmatched');

  const fD = (s: string) => new Date(s).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-mono text-xl font-bold" style={{ color: '#231F20' }}>Majoo Sync</h1>
        <p className="font-mono text-[10px] mt-0.5" style={{ color: '#231F2066' }}>
          Import data penjualan dari Majoo POS
        </p>
      </div>

      {/* Last sync info */}
      {lastImportAt && (
        <div className="p-3 rounded-lg border flex items-center gap-2" style={{ borderColor: '#231F2010' }}>
          <div style={{ color: '#003820' }}>{IC.check}</div>
          <div>
            <div className="font-mono text-[10px] font-medium" style={{ color: '#231F20' }}>Sync terakhir</div>
            <div className="font-mono text-[10px]" style={{ color: '#231F2066' }}>{fD(lastImportAt)}</div>
          </div>
        </div>
      )}

      {/* Unmatched alert */}
      {unmatchedCount > 0 && (
        <div
          onClick={canReview ? onReview : undefined}
          className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${canReview ? 'cursor-pointer hover:border-[#C39A4B55]' : ''}`}
          style={{ borderColor: '#C39A4B33', background: '#C39A4B08' }}
        >
          <div className="flex items-center gap-2">
            <div style={{ color: '#C39A4B' }}>{IC.alert}</div>
            <div>
              <div className="font-mono text-[10px] font-bold" style={{ color: '#C39A4B' }}>
                {unmatchedCount} transaksi perlu review
              </div>
              <div className="font-mono text-[10px]" style={{ color: '#231F2066' }}>
                Nomor HP tidak terdaftar di sistem
              </div>
            </div>
          </div>
          {canReview && (
            <div className="font-mono text-[10px] font-bold shrink-0" style={{ color: '#C39A4B' }}>Review →</div>
          )}
        </div>
      )}

      {/* Menu cards */}
      <div className="space-y-3">
        {/* Import */}
        {canImport && (
          <button
            onClick={onImport}
            className="w-full p-4 rounded-lg border text-left hover:border-[#C39A4B55] active:scale-[0.99] transition-transform"
            style={{ borderColor: '#231F2015' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#00382012' }}>
                <div style={{ color: '#003820' }}>{IC.upload}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-bold" style={{ color: '#231F20' }}>Import File</div>
                <div className="font-mono text-[10px] mt-0.5" style={{ color: '#231F2066' }}>
                  Upload .xlsx Detail Penjualan dari Majoo
                </div>
              </div>
              <div className="font-mono text-[10px] font-bold shrink-0" style={{ color: '#C39A4B' }}>→</div>
            </div>
          </button>
        )}

        {/* Review unmatched */}
        {canReview && (
          <button
            onClick={onReview}
            className="w-full p-4 rounded-lg border text-left hover:border-[#C39A4B55] active:scale-[0.99] transition-transform"
            style={{ borderColor: '#231F2015' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#C39A4B12' }}>
                <div style={{ color: '#C39A4B' }}>{IC.alert}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold" style={{ color: '#231F20' }}>Review Unmatched</span>
                  {unmatchedCount > 0 && (
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#C39A4B', color: '#fff' }}>
                      {unmatchedCount}
                    </span>
                  )}
                </div>
                <div className="font-mono text-[10px] mt-0.5" style={{ color: '#231F2066' }}>
                  Assign transaksi ke member atau skip
                </div>
              </div>
              <div className="font-mono text-[10px] font-bold shrink-0" style={{ color: '#C39A4B' }}>→</div>
            </div>
          </button>
        )}

        {/* History */}
        <button
          onClick={onHistory}
          className="w-full p-4 rounded-lg border text-left hover:border-[#C39A4B55] active:scale-[0.99] transition-transform"
          style={{ borderColor: '#231F2015' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#231F2008' }}>
              <div style={{ color: '#231F2088' }}>{IC.history}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm font-bold" style={{ color: '#231F20' }}>Riwayat Import</div>
              <div className="font-mono text-[10px] mt-0.5" style={{ color: '#231F2066' }}>
                Lihat semua file yang pernah di-import
              </div>
            </div>
            <div className="font-mono text-[10px] font-bold shrink-0" style={{ color: '#C39A4B' }}>→</div>
          </div>
        </button>
      </div>

      {/* Info box */}
      <div className="p-4 rounded-lg border space-y-1.5" style={{ borderColor: '#231F2010', background: '#231F2004' }}>
        <div className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#231F2066' }}>Cara Kerja</div>
        {[
          'Member kasih nomor HP ke kasir Majoo saat checkout',
          'Admin export "Detail Penjualan" tiap hari dari Majoo',
          'Upload file di sini → EXP & Koin otomatis masuk ke member',
          'Transaksi tanpa HP masuk ke antrian review',
        ].map((s, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="font-mono text-[9px] mt-0.5 shrink-0" style={{ color: '#C39A4B' }}>{i + 1}.</span>
            <span className="font-mono text-[10px]" style={{ color: '#231F2088' }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
