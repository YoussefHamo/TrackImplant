import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { patientService } from '../services/patientService';
import type { Patient } from '../types';
import {
  Search, ChevronLeft, ChevronRight, Plus, Calendar,
  Phone, CreditCard, Building2, Hash, ArrowRight
} from 'lucide-react';
import AddPatientModal from '../components/AddPatientModal';
import Copyable from '../components/ui/Copyable';
import { useLanguage } from '../context/LanguageContext';

export const Patients = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;

  const selectedId = searchParams.get('selected') || null;

  const { data: allPatients = [], isLoading: loadingAll } = useQuery({
    queryKey: ['patients'],
    queryFn: () => patientService.getAll(),
    enabled: !searchQuery,
  });

  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery) { setSearchResults([]); setSearching(false); return; }
    const q = searchQuery.trim();
    setSearching(true);
    patientService.search(q)
      .then(results => {
        console.log('SEARCH DONE:', q, '\u2192', results.length, 'results');
        if (results.length > 0) console.log('FIRST RESULT:', { name: results[0].full_name, code: results[0].external_medical_code });
        setSearchResults(results);
      })
      .catch(err => {
        console.error('SEARCH ERROR:', err);
        setSearchResults([]);
      })
      .finally(() => setSearching(false));
  }, [searchQuery]);

  const patients = searchQuery ? searchResults : allPatients;
  const isLoading = searchQuery ? searching : loadingAll;

  const totalPages = Math.max(1, Math.ceil(patients.length / perPage));
  const paged = patients.slice((page - 1) * perPage, page * perPage);

  const selectedPatient = patients.find(p => p.id === selectedId) || paged[0] || null;

  const selectPatient = (id: string) => {
    setSearchParams({ selected: id });
  };

  return (
    <div className="p-6 space-y-6">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {t('patients.title')}
          </h1>
          <p className="text-sm mt-1 text-[var(--app-text-muted)]">
            {isLoading ? t('common.loading') : t('patients.subtitle', { count: patients.length })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--app-text-dim)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder={t('patients.search_placeholder')}
              className="input-cyber pl-10 pr-4"
              dir="auto"
              aria-label={t('patients.search_placeholder')}
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary btn-sm"
            aria-label={t('patients.add_patient')}
          >
            <Plus className="w-4 h-4" />
            {t('patients.add_patient')}
          </button>
        </div>
      </div>

      {/* ===== 2-COLUMN LAYOUT ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">

        {/* ===== MAIN TABLE ===== */}
        <div className="glass-strong rounded-xl overflow-hidden">
          <div className="min-w-[600px]">
            {/* Table Header */}
            <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[var(--app-border)] text-[var(--app-text-muted)]">
              <div className="flex-[3]">{t('patients.table_patient')}</div>
              <div className="flex-[2]">{t('patients.table_phone')}</div>
              <div className="flex-[1.5]">{t('patients.table_code')}</div>
              <div className="flex-[1.5]">{t('patients.table_insurance')}</div>
              <div className="flex-[1.5]">{t('patients.table_created')}</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-[var(--app-border)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading" />
                </div>
              ) : paged.length === 0 ? (
                <div className="py-16 text-center text-sm text-[var(--app-text-muted)]">
                  {searchQuery ? t('patients.empty_search') : t('patients.empty_all')}
                </div>
              ) : paged.map(p => (
                <div
                  key={p.id}
                  onClick={() => selectPatient(p.id)}
                  onKeyDown={e => { if (e.key === 'Enter') selectPatient(p.id); }}
                  role="row"
                  tabIndex={0}
                  aria-selected={selectedId === p.id}
                  className={`flex items-center px-6 py-4 transition-all duration-150 cursor-pointer relative hover:bg-[var(--app-table-hover)] ${
                    selectedId === p.id ? 'bg-[var(--color-primary)]/[0.04]' : ''
                  }`}
                >
                  {selectedId === p.id && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[var(--color-primary)] shadow-[0_0_8px_var(--color-primary)]" />
                  )}
                  <div className="flex-[3] flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold flex-shrink-0 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)]">
                      {p.profile_image_url ? (
                        <img src={p.profile_image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        p.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className="text-sm font-medium text-white">{p.full_name}</span>
                  </div>
                  <div className="flex-[2] text-sm text-[var(--app-text-dim)]">
                    {p.phone ? (
                      <Copyable text={p.phone}>{p.phone}</Copyable>
                    ) : (
                      <span className="text-[var(--app-text-muted)]">{t('common.dash')}</span>
                    )}
                  </div>
                  <div className="flex-[1.5] text-sm font-mono" style={{ color: p.external_medical_code ? 'var(--color-primary)' : 'var(--app-text-muted)' }}>
                    {p.external_medical_code ? (
                      <Copyable text={p.external_medical_code}><span>{p.external_medical_code}</span></Copyable>
                    ) : (
                      t('common.dash')
                    )}
                  </div>
                  <div className="flex-[1.5]">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      p.insurance_company
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                        : 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                    }`}>
                      {p.insurance_company || 'Cash'}
                    </span>
                  </div>
                  <div className="flex-[1.5] text-sm text-[var(--app-text-dim)]">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString() : t('common.dash')}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {patients.length > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--app-border)]">
                <span className="text-xs text-[var(--app-text-muted)]">
                  Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, patients.length)} of {patients.length} entries
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="flex items-center justify-center w-8 h-8 rounded-lg transition-all disabled:opacity-30 border border-[var(--app-border)] text-[var(--app-text-dim)] hover:bg-white/[0.04]"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
                    const n = idx + 1;
                    const isActive = page === n;
                    return (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)]'
                            : 'border border-[var(--app-border)] text-[var(--app-text-dim)] hover:bg-white/[0.04]'
                        }`}
                        aria-label={`Page ${n}`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {n}
                      </button>
                    );
                  })}
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="flex items-center justify-center w-8 h-8 rounded-lg transition-all disabled:opacity-30 border border-[var(--app-border)] text-[var(--app-text-dim)] hover:bg-white/[0.04]"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== RIGHT — PATIENT DETAILS PANEL ===== */}
        {selectedPatient ? (
          <div className="glass-strong rounded-xl p-6 space-y-5">
            {/* Avatar + Name */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-lg font-bold mb-3 bg-[var(--color-primary)]/10 border-2 border-[var(--color-primary)]/20 text-[var(--color-primary)]">
                {selectedPatient.profile_image_url ? (
                  <img src={selectedPatient.profile_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  selectedPatient.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                )}
              </div>
              <h3 className="text-lg font-bold text-white">{selectedPatient.full_name}</h3>
              <p className="text-xs font-mono mt-1 text-[var(--app-text-muted)]">
                #{(selectedPatient.id || '').slice(0, 6).toUpperCase()}
              </p>
            </div>

            {/* Quick Info */}
            <div className="divide-y divide-[var(--app-border)]">
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[var(--app-text-muted)]" />
                  <span className="text-xs text-[var(--app-text-muted)]">{t('patients.phone_label')}</span>
                </div>
                <span className="text-xs font-medium text-white">{selectedPatient.phone || <span className="text-[var(--app-text-muted)]">{t('common.dash')}</span>}</span>
              </div>
              {selectedPatient.external_medical_code && (
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-[var(--app-text-muted)]" />
                    <span className="text-xs text-[var(--app-text-muted)]">External Code</span>
                  </div>
                  <span className="text-xs font-mono font-medium text-[var(--color-primary)]">{selectedPatient.external_medical_code}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-[var(--app-text-muted)]" />
                  <span className="text-xs text-[var(--app-text-muted)]">Payment</span>
                </div>
                <span className={`text-xs font-medium ${selectedPatient.insurance_company ? 'text-[var(--color-primary)]' : 'text-[var(--color-success)]'}`}>
                  {selectedPatient.insurance_company || 'Cash'}
                </span>
              </div>
              {selectedPatient.home_branch_name && (
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-[var(--app-text-muted)]" />
                    <span className="text-xs text-[var(--app-text-muted)]">Branch</span>
                  </div>
                  <span className="text-xs font-medium text-[var(--color-primary)]">{selectedPatient.home_branch_name}</span>
                </div>
              )}
            </div>

            {/* Medical History */}
            {selectedPatient.medical_history && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-[var(--app-card-border)]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">{t('patients.medical_history')}</span>
                <p className="text-sm mt-1 leading-relaxed text-white/60">{selectedPatient.medical_history}</p>
              </div>
            )}

            {/* View Full Profile */}
            <button
              onClick={() => navigate(`/dashboard/patients/${selectedPatient.id}/profile`)}
              className="btn-primary btn-sm w-full"
              aria-label={t('patients.view_full_profile')}
            >
              {t('patients.view_full_profile')}
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Patient Since */}
            <div className="rounded-xl p-4 bg-[var(--color-primary)]/[0.04] border border-[var(--color-primary)]/10">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-[var(--color-primary)]" />
                <span className="text-sm font-semibold text-white">{t('patients.patient_since')}</span>
              </div>
              <p className="text-xs text-[var(--app-text-muted)]">
                {selectedPatient.created_at
                  ? new Date(selectedPatient.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                  : t('common.dash')}
              </p>
            </div>
          </div>
        ) : (
          <div className="glass-strong rounded-xl p-6 flex items-center justify-center min-h-[300px]">
            <p className="text-sm text-[var(--app-text-muted)]">{t('patients.select_hint')}</p>
          </div>
        )}
      </div>

      <AddPatientModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
};
