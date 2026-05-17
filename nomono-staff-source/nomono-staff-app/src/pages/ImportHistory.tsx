import React from 'react';
import { IC } from '../components/ui';
import type { MajooImport } from '../lib/types';

interface Props {
  imports: MajooImport[];
  onBack: () => void;
}

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  completed:   { label: 'Selesai',    bg: '#00382015', color: '#003820' },
  pending:     { label: 'Pending',    bg: '#C39A4B15', color: '#C39A4B' },
  failed:      { label: 'Gagal',      bg: '#dc262615', color: '#dc2626' },
  rolled_back: { label: 'Di-rollback', bg: '#231F2015', color: '#231F2088' },
};

const fD = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const fT = (s: string) =>
  new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

export default function ImportHistoryPage({ imports, onBack }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} style={{ color: '#231F2088' }}>{IC.back}</button>
        <h1 className="font-mono text-sm font-bold" style={{ color: '#231F20' }}>Riwayat Import</h1>
        <div className="w-5" />
      </div>

      {imports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div style={{ color: '#231F2033' }}>{IC.history}</div>
          <div className="font-mono text-sm" style={{ color: '#231F2066' }}>Belum ada import</div>
        </div>
      ) : (
        <div className="space-y-3">
          {imports.map(imp => {
            const st = STATUS_STYLE[imp.status] ?? STATUS_STYLE.pending;
            const skipReasons = imp.skip_reasons ?? {};

            return (
              <div key={imp.id} className="p-4 rounded-lg border space-y-3" style={{ borderColor: '#231F2010' }}>
                {/* Header baris */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs font-medium truncate" style={{ color: '#231F20' }}>
                      {imp.file_name || 'Unknown file'}
                    </div>
                    <div className="font-mono text-[10px] mt-0.5" style={{ color: '#231F2066' }}>
                      {fD(imp.imported_at)} · {fT(imp.imported_at)}
                      {imp.imported_by_name && ` · ${imp.imported_by_name}`}
                    </div>
                    {imp.periode_start && (
                      <div className="font-mono text-[10px]" style={{ color: '#231F2066' }}>
                        Periode: {fD(imp.periode_start)}
                        {imp.periode_end && imp.periode_end !== imp.periode_start &&
                          ` — ${fD(imp.periode_end)}`}
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-[9px] px-2 py-1 rounded shrink-0 font-bold"
                    style={{ background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded text-center" style={{ background: '#00382010' }}>
                    <div className="font-mono text-base font-bold" style={{ color: '#003820' }}>
                      {imp.matched_count}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-wider" style={{ color: '#231F2066' }}>Matched</div>
                  </div>
                  <div className="p-2 rounded text-center" style={{ background: '#C39A4B10' }}>
                    <div className="font-mono text-base font-bold" style={{ color: '#C39A4B' }}>
                      {imp.unmatched_count}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-wider" style={{ color: '#231F2066' }}>Unmatched</div>
                  </div>
                  <div className="p-2 rounded text-center" style={{ background: '#231F2008' }}>
                    <div className="font-mono text-base font-bold" style={{ color: '#231F2088' }}>
                      {imp.skipped_count}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-wider" style={{ color: '#231F2066' }}>Skip</div>
                  </div>
                </div>

                {/* EXP / Koin */}
                {imp.matched_count > 0 && (
                  <div className="flex gap-3 pt-1">
                    <span className="font-mono text-[10px] font-bold text-green-600">
                      +{imp.total_exp_added} EXP
                    </span>
                    <span className="font-mono text-[10px] font-bold" style={{ color: '#C39A4B' }}>
                      +{imp.total_koin_added} Koin
                    </span>
                    <span className="font-mono text-[10px]" style={{ color: '#231F2066' }}>
                      Rp {(imp.total_nominal || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                )}

                {/* Skip reasons */}
                {Object.keys(skipReasons).length > 0 && (
                  <div className="text-[10px] font-mono" style={{ color: '#231F2066' }}>
                    Skip: {Object.entries(skipReasons).map(([k, v]) =>
                      `${v}x ${k.replace(/_/g, ' ')}`
                    ).join(' · ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
