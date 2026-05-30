import React, { useState, useRef } from 'react';
import { IC } from '../components/ui';
import { parseMajooExcel, decideMajooRow, type MajooRow, type MatchDecision } from '../lib/majoo-parser';
import { normalizePhone, isValidIndonesianMobile } from '../lib/majoo-helpers';
import type { Staff, Member } from '../lib/types';
import type { MajooImport } from '../lib/types';
import { supabase } from '../lib/supabase';

// ── Types lokal ──

interface ProcessedRow {
  row: MajooRow;
  decision: MatchDecision;
}

interface ImportSummary {
  matched: ProcessedRow[];
  unmatched: ProcessedRow[];
  skipped: ProcessedRow[];
  totalExp: number;
  totalKoin: number;
  totalNominal: number;
}

type Step = 'upload' | 'preview' | 'processing' | 'done' | 'error';

// ── Props ──

interface Props {
  staff: Staff;
  onBack: () => void;
  findMemberByPhone: (phone: string) => Promise<Member | null>;
  createMajooImport: (payload: Omit<MajooImport, 'id' | 'imported_at'>) => Promise<MajooImport | null>;
  updateMajooImport: (id: string, updates: Partial<MajooImport>) => Promise<boolean>;
  addUnmatchedTx: (payload: any) => Promise<boolean>;
  addTransaction: (tx: any) => Promise<boolean>;
  updateMemberBalance: (memberId: string, addExp: number, addKoin: number) => Promise<boolean>;
  existingMajooTxIds: Set<string>;
}

// ── Label helper ──

const SKIP_LABELS: Record<string, string> = {
  not_paid: 'Belum Lunas',
  zero_or_negative_amount: 'Total Rp 0',
  refunded: 'Refund',
  voided: 'Batal/Void',
  duplicate: 'Duplikat',
};

const UNMATCHED_LABELS: Record<string, string> = {
  no_phone: 'Tanpa HP',
  invalid_phone: 'HP Tidak Valid',
  phone_not_found: 'HP Tidak Terdaftar',
};

export default function MajooImportPage({
  staff,
  onBack,
  findMemberByPhone,
  createMajooImport,
  updateMajooImport,
  addUnmatchedTx,
  addTransaction,
  updateMemberBalance,
  existingMajooTxIds,
}: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<MajooRow[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [processing, setProcessing] = useState(false);
  const [doneImport, setDoneImport] = useState<MajooImport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDrag, setIsDrag] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Langkah 1: parse file ──
  const handleFile = async (f: File) => {
    // Cek ukuran file — max 10MB
    if (f.size > 10 * 1024 * 1024) {
      setParseError('File terlalu besar (maks 10MB). Pastikan file yang dipilih benar.');
      return;
    }

    setFile(f);
    setParseError(null);
    try {
      const result = await parseMajooExcel(f);
      setMeta(result.meta);
      setRows(result.rows);

      // Fetch existingIds dan member phones sekaligus — 2 query, bukan N query
      const [existingTxRes, phoneBatchRes] = await Promise.all([
        supabase.from('transactions').select('majoo_transaction_id').not('majoo_transaction_id', 'is', null),
        (() => {
          const phones = result.rows
            .map(r => normalizePhone(r.no_telepon))
            .filter(p => isValidIndonesianMobile(p));
          if (phones.length === 0) return Promise.resolve({ data: [] });
          return supabase.from('members').select('*').in('phone_normalized', phones);
        })(),
      ]);

      const previewIds = new Set<string>(
        (existingTxRes.data || []).map((t: any) => t.majoo_transaction_id as string)
      );
      const memberByPhone = new Map<string, Member>(
        (phoneBatchRes.data || []).map((m: any) => [
          m.phone_normalized as string,
          {
            id: m.id, full_name: m.full_name, email: m.email, phone: m.phone,
            phone_normalized: m.phone_normalized ?? null,
            avatar_url: m.avatar_url, date_of_birth: m.date_of_birth,
            joined_at: m.joined_at || m.created_at, is_active: m.is_active ?? true,
            total_exp: m.total_exp || 0,
            koin_balance: m.koin_balance ?? m.coin_balance ?? 0,
            majoo_synced_at: m.majoo_synced_at ?? null,
          } as Member,
        ])
      );

      // Preview: gunakan Map hasil batch — tidak ada DB call per baris
      const decisions = await Promise.all(
        result.rows.map(row =>
          decideMajooRow(row, previewIds, async (phone) => memberByPhone.get(phone) ?? null)
        )
      );

      const processed: ProcessedRow[] = result.rows.map((row, i) => ({ row, decision: decisions[i] }));
      setSummary(buildSummary(processed));
      setStep('preview');
    } catch (e: any) {
      setParseError(e.message || 'Gagal membaca file');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ── Langkah 2: konfirmasi → proses ──
  const doImport = async () => {
    if (!file || !summary) return;
    setProcessing(true);
    setStep('processing');

    try {
      // Buat record import dulu (status pending)
      const importRecord = await createMajooImport({
        imported_by: staff.id,
        imported_by_name: staff.full_name,
        file_name: file.name,
        periode_start: meta?.periode_start?.toISOString() ?? null,
        periode_end: meta?.periode_end?.toISOString() ?? null,
        total_rows: rows.length,
        matched_count: 0,
        unmatched_count: 0,
        skipped_count: 0,
        total_exp_added: 0,
        total_koin_added: 0,
        total_nominal: 0,
        status: 'pending',
        notes: null,
        skip_reasons: null,
      });

      if (!importRecord) throw new Error('Gagal membuat import record');

      const importId = importRecord.id;
      let matchedCount = 0;
      let unmatchedCount = 0;
      let skippedCount = 0;
      let totalExp = 0;
      let totalKoin = 0;
      let totalNominal = 0;
      const skipReasons: Record<string, number> = {};
      // Akumulasi delta per member — hindari stale state kalau 1 member ada >1 transaksi
      const memberDeltas = new Map<string, { exp: number; koin: number }>();

      // Fetch fresh IDs dari DB (bukan dari state) untuk cek duplikat yang akurat
      const { data: existingTxData } = await supabase
        .from('transactions')
        .select('majoo_transaction_id')
        .not('majoo_transaction_id', 'is', null);
      const freshIds = new Set<string>(
        (existingTxData || []).map((t: any) => t.majoo_transaction_id as string)
      );

      // Re-compute decisions dengan freshIds
      const decisions = await Promise.all(
        rows.map(row => decideMajooRow(row, freshIds, findMemberByPhone))
      );

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const d = decisions[i];

        if (d.action === 'skip') {
          skippedCount++;
          const r = d.skipReason || 'unknown';
          skipReasons[r] = (skipReasons[r] || 0) + 1;

        } else if (d.action === 'unmatched') {
          unmatchedCount++;
          await addUnmatchedTx({
            import_id: importId,
            majoo_transaction_id: row.no_transaksi,
            majoo_phone: row.no_telepon || null,
            majoo_phone_normalized: d.normalizedPhone || null,
            majoo_customer_name: row.pelanggan || null,
            transaction_date: row.waktu_bayar?.toISOString() ?? row.waktu_order?.toISOString() ?? null,
            total_nominal: row.total_penjualan,
            reason: d.unmatchedReason || null,
            status: 'pending',
            assigned_member_id: null,
            resolved_at: null,
            resolved_by: null,
            resolved_by_name: null,
            notes: null,
          });

        } else if (d.action === 'match' && d.member) {
          const txSuccess = await addTransaction({
            member_id: d.member.id,
            exp_amount: d.exp ?? 0,
            koin_amount: d.koin ?? 0,
            description: `Import Majoo — ${row.no_transaksi}`,
            preset_id: null,
            created_by: staff.id,
            staff_name: staff.full_name,
            source: 'majoo',
            majoo_import_id: importId,
            majoo_transaction_id: row.no_transaksi,
            nominal_amount: row.total_penjualan,
          });

          if (!txSuccess) {
            // Insert gagal (kemungkinan duplikat di DB level), skip baris ini
            skippedCount++;
            skipReasons['db_error'] = (skipReasons['db_error'] || 0) + 1;
            continue;
          }

          // Tambah ke freshIds supaya intra-file duplicate terdeteksi
          freshIds.add(row.no_transaksi);

          matchedCount++;
          totalExp += d.exp ?? 0;
          totalKoin += d.koin ?? 0;
          totalNominal += row.total_penjualan;

          // Akumulasi delta — jangan langsung update balance di sini
          const cur = memberDeltas.get(d.member.id) || { exp: 0, koin: 0 };
          memberDeltas.set(d.member.id, {
            exp: cur.exp + (d.exp ?? 0),
            koin: cur.koin + (d.koin ?? 0),
          });
        }
      }

      // Update balance per member 1x dengan total delta — fresh fetch dari DB
      for (const [memberId, delta] of memberDeltas) {
        await updateMemberBalance(memberId, delta.exp, delta.koin);
      }

      // Update record import dengan hasil final
      await updateMajooImport(importId, {
        matched_count: matchedCount,
        unmatched_count: unmatchedCount,
        skipped_count: skippedCount,
        total_exp_added: totalExp,
        total_koin_added: totalKoin,
        total_nominal: totalNominal,
        status: 'completed',
        skip_reasons: Object.keys(skipReasons).length ? skipReasons : null,
      });

      setDoneImport({ ...importRecord, matched_count: matchedCount, unmatched_count: unmatchedCount, skipped_count: skippedCount, total_exp_added: totalExp, total_koin_added: totalKoin, total_nominal: totalNominal, status: 'completed' });
      setStep('done');

    } catch (e: any) {
      setErrorMsg(e.message || 'Terjadi error saat proses import');
      setStep('error');
    } finally {
      setProcessing(false);
    }
  };

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} style={{ color: '#231F2088' }}>{IC.back}</button>
        <h1 className="font-mono text-sm font-bold" style={{ color: '#231F20' }}>Import Majoo</h1>
        <div className="w-5" />
      </div>

      {/* ── Step: Upload ── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#231F2066' }}>
            Upload file Detail Penjualan dari Majoo
          </p>

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
            onDragLeave={() => setIsDrag(false)}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors"
            style={{ borderColor: isDrag ? '#C39A4B' : '#231F2020', background: isDrag ? '#C39A4B08' : 'transparent' }}
          >
            <div style={{ color: isDrag ? '#C39A4B' : '#231F2044' }}>{IC.upload}</div>
            <div className="text-center">
              <div className="font-mono text-xs font-medium" style={{ color: '#231F20' }}>
                Drag & drop atau tap untuk pilih file
              </div>
              <div className="font-mono text-[10px] mt-1" style={{ color: '#231F2066' }}>
                Format: .xlsx (Detail Penjualan Majoo)
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {parseError && (
            <div className="p-3 rounded-lg border font-mono text-xs" style={{ background: '#dc262608', borderColor: '#dc262620', color: '#dc2626' }}>
              {IC.alert} {parseError}
            </div>
          )}

          {/* Panduan */}
          <div className="p-4 rounded-lg border space-y-2" style={{ borderColor: '#231F2010' }}>
            <div className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#231F2066' }}>Cara Export dari Majoo</div>
            {['Buka Majoo → Laporan → Detail Penjualan', 'Pilih periode (hari ini)', 'Pastikan template "Nomono Sync" aktif', 'Klik Export → Download .xlsx'].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="font-mono text-[9px] mt-0.5 shrink-0" style={{ color: '#C39A4B' }}>{i + 1}.</span>
                <span className="font-mono text-[10px]" style={{ color: '#231F20' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step: Preview ── */}
      {step === 'preview' && summary && file && (
        <div className="space-y-4">
          {/* Info file */}
          <div className="p-3 rounded-lg border flex items-center gap-3" style={{ borderColor: '#231F2015' }}>
            <div style={{ color: '#003820' }}>{IC.fileSpreadsheet}</div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs font-medium truncate" style={{ color: '#231F20' }}>{file.name}</div>
              {meta?.periode_start && (
                <div className="font-mono text-[10px]" style={{ color: '#231F2066' }}>
                  {meta.periode_start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {meta.periode_end && meta.periode_end.toDateString() !== meta.periode_start.toDateString() &&
                    ` — ${meta.periode_end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  }
                </div>
              )}
            </div>
            <div className="font-mono text-[10px] shrink-0" style={{ color: '#231F2066' }}>{rows.length} baris</div>
          </div>

          {/* Banner: >80% duplikat — kemungkinan salah file */}
          {(() => {
            const dupCount = summary.skipped.filter(p => p.decision.skipReason === 'duplicate').length;
            const dupRatio = rows.length > 0 ? dupCount / rows.length : 0;
            if (dupRatio > 0.8) return (
              <div className="p-3 rounded-lg border-2 flex items-start gap-2" style={{ borderColor: '#dc2626', background: '#dc262610' }}>
                <span className="text-sm shrink-0">🚨</span>
                <div>
                  <div className="font-mono text-xs font-bold" style={{ color: '#dc2626' }}>Sebagian besar transaksi duplikat ({dupCount} dari {rows.length})</div>
                  <div className="font-mono text-[10px] mt-0.5" style={{ color: '#dc2626' }}>Apakah yakin ini file yang benar?</div>
                </div>
              </div>
            );
            if (dupCount > 0) return (
              <div className="p-3 rounded-lg border-2 flex items-start gap-2" style={{ borderColor: '#C39A4B', background: '#C39A4B10' }}>
                <span className="text-sm shrink-0">⚠️</span>
                <div>
                  <div className="font-mono text-xs font-bold" style={{ color: '#231F20' }}>{dupCount} transaksi duplikat</div>
                  <div className="font-mono text-[10px] mt-0.5" style={{ color: '#231F2088' }}>Sudah pernah di-import sebelumnya. Akan di-skip otomatis.</div>
                </div>
              </div>
            );
            return null;
          })()}

          {/* Ringkasan */}
          <div className="p-4 rounded-lg border space-y-3" style={{ borderColor: '#231F2010' }}>
            <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#231F2066' }}>Ringkasan Hasil</div>

            <div className="space-y-2">
              {/* Matched */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px]">✅</span>
                  <span className="font-mono text-xs" style={{ color: '#231F20' }}>Matched</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-bold" style={{ color: '#003820' }}>{summary.matched.length}</span>
                  {summary.matched.length > 0 && (
                    <span className="font-mono text-[10px] ml-2" style={{ color: '#231F2066' }}>
                      +{summary.totalExp} EXP · +{summary.totalKoin} Koin
                    </span>
                  )}
                </div>
              </div>

              {/* Unmatched */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px]">⚠️</span>
                  <span className="font-mono text-xs" style={{ color: '#231F20' }}>Unmatched</span>
                </div>
                <span className="font-mono text-sm font-bold" style={{ color: '#C39A4B' }}>{summary.unmatched.length}</span>
              </div>

              {/* Skipped */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px]">⏭</span>
                  <span className="font-mono text-xs" style={{ color: '#231F20' }}>Dilewati</span>
                </div>
                <span className="font-mono text-sm font-bold" style={{ color: '#231F2066' }}>{summary.skipped.length}</span>
              </div>
            </div>

            {/* Detail skip */}
            {summary.skipped.length > 0 && (
              <div className="pt-2 border-t space-y-1" style={{ borderColor: '#231F2010' }}>
                {Object.entries(
                  summary.skipped.reduce((acc, p) => {
                    const k = p.decision.skipReason || 'unknown';
                    acc[k] = (acc[k] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([reason, count]) => (
                  <div key={reason} className="flex justify-between">
                    <span className="font-mono text-[10px]" style={{ color: '#231F2066' }}>
                      — {SKIP_LABELS[reason] || reason}
                    </span>
                    <span className="font-mono text-[10px]" style={{ color: '#231F2066' }}>{count}x</span>
                  </div>
                ))}
              </div>
            )}

            {/* Detail unmatched */}
            {summary.unmatched.length > 0 && (
              <div className="pt-2 border-t space-y-1" style={{ borderColor: '#231F2010' }}>
                {Object.entries(
                  summary.unmatched.reduce((acc, p) => {
                    const k = p.decision.unmatchedReason || 'unknown';
                    acc[k] = (acc[k] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([reason, count]) => (
                  <div key={reason} className="flex justify-between">
                    <span className="font-mono text-[10px]" style={{ color: '#C39A4B' }}>
                      ⚠ {UNMATCHED_LABELS[reason] || reason}
                    </span>
                    <span className="font-mono text-[10px]" style={{ color: '#C39A4B' }}>{count}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detail matched (collapsible list) */}
          {summary.matched.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#231F2066' }}>
                Transaksi yang akan diproses
              </div>
              {summary.matched.map(({ row, decision }) => (
                <div key={row.no_transaksi} className="flex items-center justify-between p-2.5 rounded-lg border" style={{ borderColor: '#231F2010' }}>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-medium truncate" style={{ color: '#231F20' }}>
                      {decision.member?.full_name}
                    </div>
                    <div className="font-mono text-[10px]" style={{ color: '#231F2066' }}>
                      {row.no_transaksi} · Rp {row.total_penjualan.toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="font-mono text-[10px] font-bold text-green-600">+{decision.exp} EXP</div>
                    <div className="font-mono text-[10px]" style={{ color: '#C39A4B' }}>+{decision.koin} Koin</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {summary.matched.length === 0 && summary.unmatched.length === 0 && (
            <div className="p-4 rounded-lg text-center font-mono text-xs" style={{ background: '#231F2008', color: '#231F2066' }}>
              Tidak ada transaksi yang bisa diproses dari file ini.
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { setStep('upload'); setFile(null); setSummary(null); }}
              className="flex-1 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest border"
              style={{ borderColor: '#231F2015', color: '#231F2088' }}
            >
              Ganti File
            </button>
            <button
              onClick={doImport}
              disabled={processing || (summary.matched.length === 0 && summary.unmatched.length === 0)}
              className="flex-1 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold text-white disabled:opacity-40"
              style={{ background: '#003820' }}
            >
              Proses Import
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Processing ── */}
      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-10 h-10 border-2 border-[#C39A4B] border-t-transparent rounded-full animate-spin" />
          <div className="font-mono text-xs uppercase tracking-widest" style={{ color: '#231F2088' }}>
            Memproses transaksi...
          </div>
        </div>
      )}

      {/* ── Step: Done ── */}
      {step === 'done' && doneImport && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border-2 text-center" style={{ borderColor: '#003820', background: '#00382008' }}>
            <div className="font-mono text-base font-bold mb-1" style={{ color: '#003820' }}>✓ Import Berhasil</div>
            <div className="font-mono text-[10px]" style={{ color: '#231F2066' }}>{file?.name}</div>
          </div>

          <div className="p-4 rounded-lg border space-y-3" style={{ borderColor: '#231F2010' }}>
            <div className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: '#231F2066' }}>Hasil</div>

            <div className="flex justify-between items-center">
              <span className="font-mono text-xs" style={{ color: '#231F20' }}>✅ Matched</span>
              <div className="text-right">
                <span className="font-mono text-sm font-bold" style={{ color: '#003820' }}>{doneImport.matched_count}</span>
                {doneImport.matched_count > 0 && (
                  <span className="font-mono text-[10px] ml-2" style={{ color: '#231F2066' }}>
                    +{doneImport.total_exp_added} EXP · +{doneImport.total_koin_added} Koin
                  </span>
                )}
              </div>
            </div>

            {doneImport.unmatched_count > 0 && (
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs" style={{ color: '#C39A4B' }}>⚠️ Unmatched (perlu review)</span>
                <span className="font-mono text-sm font-bold" style={{ color: '#C39A4B' }}>{doneImport.unmatched_count}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="font-mono text-xs" style={{ color: '#231F2066' }}>⏭ Dilewati</span>
              <span className="font-mono text-sm font-bold" style={{ color: '#231F2066' }}>{doneImport.skipped_count}</span>
            </div>
          </div>

          <button
            onClick={onBack}
            className="w-full py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold text-white"
            style={{ background: '#003820' }}
          >
            Selesai
          </button>
        </div>
      )}

      {/* ── Step: Error ── */}
      {step === 'error' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border text-center" style={{ background: '#dc262608', borderColor: '#dc262620' }}>
            <div className="font-mono text-xs font-bold mb-1" style={{ color: '#dc2626' }}>Import Gagal</div>
            <div className="font-mono text-[10px]" style={{ color: '#dc2626' }}>{errorMsg}</div>
          </div>
          <button
            onClick={() => { setStep('upload'); setFile(null); setSummary(null); setErrorMsg(null); }}
            className="w-full py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest border"
            style={{ borderColor: '#231F2015', color: '#231F2088' }}
          >
            Coba Lagi
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helper: build summary dari processed rows ──
function buildSummary(processed: ProcessedRow[]): ImportSummary {
  const matched = processed.filter(p => p.decision.action === 'match');
  const unmatched = processed.filter(p => p.decision.action === 'unmatched');
  const skipped = processed.filter(p => p.decision.action === 'skip');
  const totalExp = matched.reduce((s, p) => s + (p.decision.exp ?? 0), 0);
  const totalKoin = matched.reduce((s, p) => s + (p.decision.koin ?? 0), 0);
  const totalNominal = matched.reduce((s, p) => s + p.row.total_penjualan, 0);
  return { matched, unmatched, skipped, totalExp, totalKoin, totalNominal };
}
