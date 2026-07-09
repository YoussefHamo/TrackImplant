import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { patientService } from '../services/patientService';
import type { Patient } from '../types';
import {
  Search, ChevronLeft, ChevronRight, Plus, Calendar
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
        console.log('SEARCH DONE:', q, '→', results.length, 'results');
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
    <div className="font-sans select-auto space-y-5">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t('patients.title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {isLoading ? t('common.loading') : t('patients.subtitle', { count: patients.length })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
            <input
              type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder={t('patients.search_placeholder')}
              className="w-full h-10 pl-10 pr-4 rounded-xl text-sm outline-none transition-all duration-200 placeholder-gray-500"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)' }}
              dir="auto"
            />
          </div>
          <button onClick={() => setShowAddModal(true)}
            className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-bold transition-all duration-300 active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #45D6FF, #53C7F0)',
              color: '#050B14',
              boxShadow: '0 4px 20px rgba(69,214,255,0.25)',
            }}>
            <Plus className="w-4 h-4" /> {t('patients.add_patient')}
          </button>
        </div>
      </div>

      {/* ===== 2-COLUMN LAYOUT ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">

        {/* ===== MAIN TABLE ===== */}
        <div className="rounded-[22px] overflow-hidden"
          style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
          <div className="flex text-[11px] font-semibold uppercase tracking-wider px-6 py-4 border-b border-[rgba(255,255,255,0.05)]"
            style={{ color: 'rgba(255,255,255,0.25)' }}>
            <div className="flex-[3]">{t('patients.table_patient')}</div>
            <div className="flex-[2]">{t('patients.table_phone')}</div>
            <div className="flex-[1.5]">{t('patients.table_code')}</div>
            <div className="flex-[1.5]">{t('patients.table_insurance')}</div>
            <div className="flex-[1.5]">{t('patients.table_created')}</div>
          </div>

          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-[#4FD1FF] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : paged.length === 0 ? (
              <div className="py-16 text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {searchQuery ? t('patients.empty_search') : t('patients.empty_all')}
              </div>
              ) : paged.map(p => {
              return (
                <div key={p.id}
                  onClick={() => selectPatient(p.id)}
                  className="flex items-center px-6 py-4 transition-all duration-150 cursor-pointer relative"
                  style={{ background: selectedId === p.id ? 'rgba(79,209,255,0.04)' : 'transparent' }}
                  onMouseEnter={e => { if (selectedId !== p.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { if (selectedId !== p.id) e.currentTarget.style.background = 'transparent'; }}>
                  {selectedId === p.id && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full" style={{ background: '#4FD1FF', boxShadow: '0 0 8px rgba(79,209,255,0.5)' }} />
                  )}
                  <div className="flex-[3] flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: p.profile_image_url ? 'transparent' : 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.12)', color: '#4FD1FF' }}>
                      {p.profile_image_url ? (
                        <img src={p.profile_image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        p.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className="text-sm font-medium text-white">{p.full_name}</span>
                  </div>
                  <div className="flex-[2] text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {p.phone ? <Copyable text={p.phone}>{p.phone}</Copyable> : t('common.dash')}
                  </div>
                  <div className="flex-[1.5] text-sm font-mono" style={{ color: p.external_medical_code ? '#4FD1FF' : 'rgba(255,255,255,0.3)' }}>
                    {p.external_medical_code ? <Copyable text={p.external_medical_code}><span>{p.external_medical_code}</span></Copyable> : t('common.dash')}
                  </div>
                  <div className="flex-[1.5] text-sm" style={{ color: p.insurance_company ? '#4FD1FF' : '#00E5A8' }}>
                    {p.insurance_company || 'Cash'}
                  </div>
                  <div className="flex-[1.5] text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString() : t('common.dash')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, patients.length)} of {patients.length} entries
            </span>
            <div className="flex items-center gap-1.5">
              <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                style={{ border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
                const n = idx + 1;
                return (
                  <button key={n} onClick={() => setPage(n)}
                    className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: page === n ? 'rgba(79,209,255,0.12)' : 'transparent',
                      border: page === n ? '1px solid rgba(79,209,255,0.2)' : '1px solid rgba(255,255,255,0.06)',
                      color: page === n ? '#4FD1FF' : 'rgba(255,255,255,0.4)',
                    }}>{n}</button>
                );
              })}
              <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                style={{ border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ===== RIGHT PATIENT DETAILS PANEL ===== */}
        {selectedPatient ? (
          <div className="rounded-[22px] p-6"
            style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 4px 24px rgba(0,0,0,0.3), 0 0 40px rgba(79,209,255,0.03)' }}>
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-lg font-bold mb-3"
                style={{ background: selectedPatient.profile_image_url ? 'transparent' : 'rgba(79,209,255,0.12)', border: '2px solid rgba(79,209,255,0.2)', color: '#4FD1FF', boxShadow: '0 0 20px rgba(79,209,255,0.1)' }}>
                {selectedPatient.profile_image_url ? (
                  <img src={selectedPatient.profile_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  selectedPatient.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                )}
              </div>
              <h3 className="text-lg font-bold text-white">{selectedPatient.full_name}</h3>
              <div className="text-xs font-mono mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                #{(selectedPatient.id || '').slice(0, 6).toUpperCase()}
              </div>
            </div>

            {/* Quick Info */}
            <div className="space-y-0 divide-y divide-[rgba(255,255,255,0.04)] mb-5">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{t('patients.phone_label')}</span>
                <span className="text-xs font-medium text-white">{selectedPatient.phone || t('common.dash')}</span>
              </div>
              {selectedPatient.external_medical_code && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>External Code</span>
                  <span className="text-xs font-mono font-medium text-[#4FD1FF]">{selectedPatient.external_medical_code}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2.5">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Payment</span>
                <span className="text-xs font-medium" style={{ color: selectedPatient.insurance_company ? '#4FD1FF' : '#00E5A8' }}>
                  {selectedPatient.insurance_company || 'Cash'}
                </span>
              </div>
              {selectedPatient.home_branch_name && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Branch</span>
                  <span className="text-xs font-medium text-[#4FD1FF]">{selectedPatient.home_branch_name}</span>
                </div>
              )}
            </div>

            {/* Medical History */}
            {selectedPatient.medical_history ? (
              <div className="mb-5 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('patients.medical_history')}</span>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{selectedPatient.medical_history}</p>
              </div>
            ) : null}

            {/* View Full Profile */}
            <button onClick={() => navigate(`/dashboard/patients/${selectedPatient.id}/profile`)}
              className="w-full h-10 mb-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14', boxShadow: '0 4px 20px rgba(69,214,255,0.25)' }}>
              {t('patients.view_full_profile')}
            </button>

            {/* Created At */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(79,209,255,0.04)', border: '1px solid rgba(79,209,255,0.1)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-[#4FD1FF]" />
                <span className="text-sm font-semibold text-white">{t('patients.patient_since')}</span>
              </div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {selectedPatient.created_at ? new Date(selectedPatient.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : t('common.dash')}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[22px] p-6 flex items-center justify-center h-64"
            style={{ background: 'rgba(13,24,40,0.82)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ color: 'rgba(255,255,255,0.2)' }} className="text-sm">{t('patients.select_hint')}</p>
          </div>
        )}
      </div>

      <AddPatientModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
};
