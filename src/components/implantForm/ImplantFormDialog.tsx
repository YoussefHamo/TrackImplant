import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { implantFormService } from '../../services/implantFormService';
import type { Patient, ImplantForm, ImplantFormAttachment } from '../../types';
import { toast } from 'sonner';
import { supabase } from '../../integrations/supabase/client';
import { X, Upload, Image, FileText, File, Trash2, Search, Plus } from 'lucide-react';
import Portal from '../ui/Portal';

const inputCls = 'w-full h-10 px-3 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500 transition-all';
const labelCls = 'text-[11px] font-semibold uppercase tracking-wider block mb-1.5';
const labelStyle: React.CSSProperties = { color: 'rgba(255,255,255,0.3)' };
const selectCls = inputCls + ' cursor-pointer appearance-none';
const requiredMark = <span className="text-[#FF6B6B] ml-0.5">*</span>;

const IMPLANT_TYPES = [
  'Korean',
  'Germany',
  'American',
];

const MANUFACTURERS = [
  'Straumann', 'Nobel Biocare', 'Dentium', 'Megagen',
  'NeoBiotech', 'Osstem', 'BioHorizons', 'Zimmer', 'MIS',
];

const DIAMETERS = ['3.3 mm', '3.5 mm', '3.75 mm', '4.0 mm', '4.1 mm', '4.5 mm', '5.0 mm'];
const LENGTHS = ['6 mm', '8 mm', '10 mm', '11.5 mm', '13 mm', '15 mm'];
const CUSTOM_MANUFACTURER = 'Other';

function computeAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function fileIcon(type: string) {
  if (type.startsWith('image/')) return <Image className="w-4 h-4" style={{ color: '#4FD1FF' }} />;
  if (type.includes('pdf')) return <FileText className="w-4 h-4" style={{ color: '#FF6B6B' }} />;
  return <File className="w-4 h-4" style={{ color: '#FFC107' }} />;
}

interface Props {
  open: boolean;
  patient: Patient;
  editForm?: ImplantForm | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ImplantFormDialog({ open, patient, editForm, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const doctorSearchRef = useRef<HTMLInputElement>(null);

  const [implantType, setImplantType] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [customManufacturer, setCustomManufacturer] = useState('');
  const [diameter, setDiameter] = useState('');
  const [length, setLength] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [toothNumber, setToothNumber] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [warrantyNumber, setWarrantyNumber] = useState('');
  const [selectedDoctors, setSelectedDoctors] = useState<{ id: string; name: string }[]>([]);
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<ImplantFormAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const { data: allDoctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => implantFormService.getDoctors(),
  });

  const filteredDoctors = useMemo(() => {
    if (!doctorSearch) return allDoctors;
    const q = doctorSearch.toLowerCase();
    return allDoctors.filter(d => d.name.toLowerCase().includes(q));
  }, [allDoctors, doctorSearch]);

  useEffect(() => {
    if (editForm) {
      setImplantType(editForm.implant_type);
      setManufacturer(editForm.manufacturer);
      setCustomManufacturer(MANUFACTURERS.includes(editForm.manufacturer) ? '' : editForm.manufacturer);
      setDiameter(editForm.diameter);
      setLength(editForm.length || '');
      setQuantity(editForm.quantity);
      setToothNumber(editForm.tooth_number);
      setBatchNumber(editForm.batch_number || '');
      setSerialNumber(editForm.serial_number || '');
      setWarrantyNumber(editForm.warranty_number || '');
      setSelectedDoctors(editForm.doctors || []);
      setNotes(editForm.notes || '');
      setAttachments(editForm.attachments || []);
      setPendingFiles([]);
      setErrors({});
    } else {
      setImplantType(''); setManufacturer(''); setCustomManufacturer('');
      setDiameter(''); setLength(''); setQuantity(1); setToothNumber('');
      setBatchNumber(''); setSerialNumber(''); setWarrantyNumber('');
      setSelectedDoctors([]); setNotes(''); setAttachments([]);
      setPendingFiles([]); setErrors({});
    }
  }, [editForm, open]);

  const validate = () => {
    const errs: Record<string, boolean> = {};
    if (!implantType) errs.implantType = true;
    if (!manufacturer && !customManufacturer) errs.manufacturer = true;
    if (!diameter) errs.diameter = true;
    if (!toothNumber) errs.toothNumber = true;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: async (status: 'Draft' | 'Completed') => {
      if (!validate() && status === 'Completed') {
        toast.error('Please fill in all required fields');
        return;
      }

      setUploading(true);
      const resolvedManufacturer = manufacturer === CUSTOM_MANUFACTURER ? customManufacturer : manufacturer;

      const allAttachments = [...attachments];

      for (const file of pendingFiles) {
        const att = await implantFormService.uploadAttachment(patient.id, editForm?.id || 'new', file);
        allAttachments.push(att);
      }

      if (editForm) {
        await implantFormService.update(editForm.id, {
          implant_type: implantType,
          manufacturer: resolvedManufacturer,
          diameter,
          length: length || undefined,
          quantity,
          tooth_number: toothNumber,
          batch_number: batchNumber || undefined,
          serial_number: serialNumber || undefined,
          warranty_number: warrantyNumber || undefined,
          doctors: selectedDoctors,
          attachments: allAttachments,
          notes: notes || undefined,
          status,
        });
      } else {
        await implantFormService.create({
          patient_id: patient.id,
          implant_type: implantType,
          manufacturer: resolvedManufacturer,
          diameter,
          length: length || undefined,
          quantity,
          tooth_number: toothNumber,
          batch_number: batchNumber || undefined,
          serial_number: serialNumber || undefined,
          warranty_number: warrantyNumber || undefined,
          doctors: selectedDoctors,
          attachments: allAttachments,
          notes: notes || undefined,
          branch_id: patient.branch_id,
          status,
        });
      }

      setUploading(false);
    },
    onSuccess: () => {
      toast.success(editForm ? 'Implant form updated' : 'Implant form saved');
      queryClient.invalidateQueries({ queryKey: ['patient-implant-forms', patient.id] });
      onSaved();
      onClose();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setUploading(false);
    },
  });

  const handleRemovePendingFile = (idx: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleRemoveAttachment = async (att: ImplantFormAttachment) => {
    if (editForm) {
      try {
        await implantFormService.deleteAttachment(editForm.id, att);
      } catch { /* ignore */ }
    }
    setAttachments(prev => prev.filter(a => a.id !== att.id));
      // Also remove from storage if not yet in DB
    if (!editForm) {
      await supabase.storage.from('patient-documents').remove([att.storage_path]);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files?.length) return;
    setPendingFiles(prev => [...prev, ...Array.from(files)]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  };

  const addDoctor = (doc: { id: string; name: string }) => {
    if (!selectedDoctors.find(d => d.id === doc.id)) {
      setSelectedDoctors(prev => [...prev, doc]);
    }
    setDoctorSearch('');
    setShowDoctorDropdown(false);
  };

  const removeDoctor = (docId: string) => {
    setSelectedDoctors(prev => prev.filter(d => d.id !== docId));
  };

  useEffect(() => {
    if (!showDoctorDropdown) setDoctorSearch('');
  }, [showDoctorDropdown]);

  if (!open) return null;

  return (
    <Portal>
    <div className="fixed inset-0 flex items-start justify-center p-4 pt-8 pb-8 overflow-y-auto"
      style={{ zIndex: 'var(--z-dialog-overlay)', background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl rounded-[24px] overflow-hidden" style={{ background: 'rgba(13,24,40,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.05)]">
          <h2 className="text-lg font-bold text-white">
            {editForm ? 'Edit Implant Form' : 'New Implant Form'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Patient Information (read-only) */}
          <div className="rounded-[16px] p-4" style={{ background: 'rgba(79,209,255,0.04)', border: '1px solid rgba(79,209,255,0.1)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4FD1FF' }}>Patient Information</h3>
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-lg font-bold flex-shrink-0"
                style={{ background: 'rgba(79,209,255,0.12)', border: '2px solid rgba(79,209,255,0.2)' }}>
                {patient.profile_image_url ? (
                  <img src={patient.profile_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span style={{ color: '#4FD1FF' }}>{patient.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 flex-1">
                <div><span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Name</span><p className="text-sm font-medium text-white">{patient.full_name}</p></div>
                <div><span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Patient ID</span><p className="text-sm text-white font-mono">#{patient.id.slice(0, 8).toUpperCase()}</p></div>
                <div><span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Age</span><p className="text-sm text-white">{patient.date_of_birth ? computeAge(patient.date_of_birth) + ' yrs' : '—'}</p></div>
                <div><span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Gender</span><p className="text-sm text-white">{patient.gender || '—'}</p></div>
                <div><span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Phone</span><p className="text-sm text-white">{patient.phone || '—'}</p></div>
                <div><span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Branch ID</span><p className="text-sm text-white font-mono">{patient.branch_id ? patient.branch_id.slice(0, 8).toUpperCase() : '—'}</p></div>
              </div>
            </div>
            <div className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>Date: {new Date().toLocaleDateString()}</div>
          </div>

          {/* Implant Information */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Implant Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Implant Type */}
              <div>
                <label className={labelCls} style={labelStyle}>Implant Type{requiredMark}</label>
                <select value={implantType} onChange={e => { setImplantType(e.target.value); setErrors(f => ({ ...f, implantType: false })); }}
                  className={selectCls} style={errors.implantType ? { borderColor: '#FF6B6B' } : {}}>
                  <option value="" style={{ background: '#0D1B2A' }}>Select type...</option>
                  {IMPLANT_TYPES.map(t => <option key={t} value={t} style={{ background: '#0D1B2A' }}>{t}</option>)}
                </select>
              </div>

              {/* Manufacturer */}
              <div>
                <label className={labelCls} style={labelStyle}>Manufacturer{requiredMark}</label>
                <select value={manufacturer} onChange={e => { setManufacturer(e.target.value); setErrors(f => ({ ...f, manufacturer: false })); }}
                  className={selectCls} style={errors.manufacturer ? { borderColor: '#FF6B6B' } : {}}>
                  <option value="" style={{ background: '#0D1B2A' }}>Select manufacturer...</option>
                  {MANUFACTURERS.map(m => <option key={m} value={m} style={{ background: '#0D1B2A' }}>{m}</option>)}
                  <option value={CUSTOM_MANUFACTURER} style={{ background: '#0D1B2A' }}>Other...</option>
                </select>
                {manufacturer === CUSTOM_MANUFACTURER && (
                  <input value={customManufacturer} onChange={e => setCustomManufacturer(e.target.value)}
                    placeholder="Enter manufacturer name" className={inputCls + ' mt-2'} />
                )}
              </div>

              {/* Diameter */}
              <div>
                <label className={labelCls} style={labelStyle}>Diameter{requiredMark}</label>
                <select value={diameter} onChange={e => { setDiameter(e.target.value); setErrors(f => ({ ...f, diameter: false })); }}
                  className={selectCls} style={errors.diameter ? { borderColor: '#FF6B6B' } : {}}>
                  <option value="" style={{ background: '#0D1B2A' }}>Select diameter...</option>
                  {DIAMETERS.map(d => <option key={d} value={d} style={{ background: '#0D1B2A' }}>{d}</option>)}
                </select>
              </div>

              {/* Length */}
              <div>
                <label className={labelCls} style={labelStyle}>Length <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <select value={length} onChange={e => setLength(e.target.value)} className={selectCls}>
                  <option value="" style={{ background: '#0D1B2A' }}>Select length...</option>
                  {LENGTHS.map(l => <option key={l} value={l} style={{ background: '#0D1B2A' }}>{l}</option>)}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className={labelCls} style={labelStyle}>Quantity</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>−</button>
                  <div className="flex-1 h-10 rounded-xl flex items-center justify-center text-lg font-bold text-white"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>{quantity}</div>
                  <button onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>+</button>
                </div>
              </div>

              {/* Tooth Number */}
              <div>
                <label className={labelCls} style={labelStyle}>Tooth Number{requiredMark}</label>
                <input value={toothNumber} onChange={e => { setToothNumber(e.target.value); setErrors(f => ({ ...f, toothNumber: false })); }}
                  placeholder="e.g. 11, 21, 36, 46" className={inputCls}
                  style={errors.toothNumber ? { borderColor: '#FF6B6B' } : {}} />
              </div>

              {/* Batch / Lot Number */}
              <div>
                <label className={labelCls} style={labelStyle}>Batch / Lot # <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder="Enter batch number" className={inputCls} />
              </div>

              {/* Serial Number */}
              <div>
                <label className={labelCls} style={labelStyle}>Serial # <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="Enter serial number" className={inputCls} />
              </div>

              {/* Warranty Number */}
              <div>
                <label className={labelCls} style={labelStyle}>Warranty # <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <input value={warrantyNumber} onChange={e => setWarrantyNumber(e.target.value)} placeholder="Enter warranty number" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Doctors */}
          <div>
            <label className={labelCls} style={labelStyle}>Doctors</label>
            {/* Selected doctors as chips */}
            {selectedDoctors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedDoctors.map(d => (
                  <span key={d.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                    style={{ background: 'rgba(79,209,255,0.1)', border: '1px solid rgba(79,209,255,0.15)', color: '#4FD1FF' }}>
                    {d.name}
                    <button onClick={() => removeDoctor(d.id)} className="ml-0.5 hover:opacity-70"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
            {/* Search + dropdown */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} />
              <input ref={doctorSearchRef} value={doctorSearch} onChange={e => { setDoctorSearch(e.target.value); setShowDoctorDropdown(true); }}
                onFocus={() => setShowDoctorDropdown(true)} placeholder="Search doctors..."
                className="w-full h-10 pl-9 pr-3 rounded-xl text-sm outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] text-white placeholder-gray-500" />
              {showDoctorDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-10 shadow-xl"
                  style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {filteredDoctors.length === 0 ? (
                    <div className="px-3 py-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>No doctors found</div>
                  ) : filteredDoctors.map(d => (
                    <button key={d.id} onClick={() => addDoctor(d)}
                      className="w-full px-3 py-2 text-sm text-left text-white hover:bg-[rgba(255,255,255,0.04)] flex items-center gap-2 transition-all">
                      <Plus className="w-3 h-3" style={{ color: '#4FD1FF' }} /> {d.name}
                    </button>
                  ))}
                </div>
              )}
              {showDoctorDropdown && <div className="fixed inset-0 z-0" onClick={() => setShowDoctorDropdown(false)} />}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls} style={labelStyle}>Notes <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={3} className={inputCls + ' h-20 pt-2 resize-none'} placeholder="Additional notes..." />
          </div>

          {/* Attachments */}
          <div>
            <label className={labelCls} style={labelStyle}>Attachments <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
            {/* Drop zone */}
            <div ref={dropRef} onDragOver={e => e.preventDefault()} onDrop={handleDrop}
              className="rounded-xl p-6 text-center cursor-pointer transition-all hover:bg-[rgba(79,209,255,0.03)] mb-3"
              style={{ border: '2px dashed rgba(79,209,255,0.2)', background: 'rgba(79,209,255,0.02)' }}
              onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: '#4FD1FF' }} />
              <p className="text-sm font-medium text-white">Drop files here or click to upload</p>
              <p className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Implant passport, sticker, box label, X-ray, PDF</p>
              <input ref={fileInputRef} type="file" multiple className="hidden" accept="image/*,application/pdf" onChange={e => { handleFileSelect(e.target.files); e.target.value = ''; }} />
            </div>

            {/* Attachments grid */}
            {(attachments.length > 0 || pendingFiles.length > 0) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {attachments.map(att => (
                  <div key={att.id} className="rounded-xl p-3 relative group" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {att.type.startsWith('image/') ? (
                      <div className="w-full h-16 rounded-lg overflow-hidden mb-1.5 bg-[rgba(0,0,0,0.3)]">
                        <img src={att.public_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-16 rounded-lg mb-1.5 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        {fileIcon(att.type)}
                      </div>
                    )}
                    <p className="text-[10px] text-white truncate">{att.name}</p>
                    <button onClick={() => handleRemoveAttachment(att)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {pendingFiles.map((file, idx) => (
                  <div key={`pending-${idx}`} className="rounded-xl p-3 relative" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="w-full h-16 rounded-lg mb-1.5 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      {fileIcon(file.type)}
                    </div>
                    <p className="text-[10px] text-white truncate">{file.name}</p>
                    <button onClick={() => handleRemovePendingFile(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(255,255,255,0.05)]">
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-sm font-medium" style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
          <button onClick={() => saveMutation.mutate('Draft')} disabled={uploading}
            className="h-10 px-5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
            {uploading ? 'Saving...' : 'Save as Draft'}
          </button>
          <button onClick={() => saveMutation.mutate('Completed')} disabled={uploading}
            className="h-10 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #45D6FF, #53C7F0)', color: '#050B14' }}>
            {uploading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
