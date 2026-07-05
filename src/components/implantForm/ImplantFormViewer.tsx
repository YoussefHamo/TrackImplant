import type { Patient, ImplantForm } from '../../types';
import { X, Printer, Download, Edit3, Trash2, Image, FileText, File } from 'lucide-react';
import Portal from '../ui/Portal';

const labelStyle: React.CSSProperties = { color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' };
const valueStyle: React.CSSProperties = { color: '#fff', fontSize: '14px', fontWeight: 500 };

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
  form: ImplantForm;
  patient: Patient;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canDelete: boolean;
}

export default function ImplantFormViewer({ open, form, patient, onClose, onEdit, onDelete, canEdit, canDelete }: Props) {
  const handlePrint = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    const doctorNames = form.doctors?.map(d => d.name).join(', ') || '—';
    const attachmentRows = form.attachments?.map(a =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px">${a.name}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-size:12px">${(a.file_size / 1024).toFixed(0)} KB</td></tr>`
    ).join('') || '';

    printWin.document.write(`
      <html>
        <head>
          <title>Implant Form - ${patient.full_name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', sans-serif; background: #fff; color: #111; padding: 40px; font-size: 13px; }
            .header { text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid #111; }
            .header h1 { font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
            .header p { color: #666; font-size: 12px; margin-top: 4px; }
            .section { margin-bottom: 20px; }
            .section h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #333; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 2px solid #333; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 24px; }
            .info-grid .field { margin-bottom: 4px; }
            .info-grid .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
            .info-grid .value { font-size: 14px; font-weight: 500; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th { background: #f5f5f5; padding: 8px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; border-bottom: 1px solid #ddd; }
            td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
            .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #888; }
            .badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 10px; font-weight: 600; background: #e8f4fd; color: #0056b3; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>TrackImplant</h1>
            <p>Implant Form — ${form.status}</p>
          </div>
          <div class="section">
            <h2>Patient Information</h2>
            <div class="info-grid">
              <div class="field"><div class="label">Name</div><div class="value">${patient.full_name}</div></div>
              <div class="field"><div class="label">Patient ID</div><div class="value">#${patient.id.slice(0, 8).toUpperCase()}</div></div>
              <div class="field"><div class="label">Age</div><div class="value">${patient.date_of_birth ? computeAge(patient.date_of_birth) + ' yrs' : '—'}</div></div>
              <div class="field"><div class="label">Gender</div><div class="value">${patient.gender || '—'}</div></div>
              <div class="field"><div class="label">Phone</div><div class="value">${patient.phone || '—'}</div></div>
              <div class="field"><div class="label">Date</div><div class="value">${form.created_at ? new Date(form.created_at).toLocaleDateString() : new Date().toLocaleDateString()}</div></div>
            </div>
          </div>
          <div class="section">
            <h2>Implant Information</h2>
            <div class="info-grid">
              <div class="field"><div class="label">Implant Type</div><div class="value">${form.implant_type}</div></div>
              <div class="field"><div class="label">Manufacturer</div><div class="value">${form.manufacturer}</div></div>
              <div class="field"><div class="label">Diameter</div><div class="value">${form.diameter}</div></div>
              <div class="field"><div class="label">Length</div><div class="value">${form.length || '—'}</div></div>
              <div class="field"><div class="label">Quantity</div><div class="value">${form.quantity}</div></div>
              <div class="field"><div class="label">Tooth Number</div><div class="value">${form.tooth_number}</div></div>
              <div class="field"><div class="label">Batch / Lot #</div><div class="value">${form.batch_number || '—'}</div></div>
              <div class="field"><div class="label">Serial #</div><div class="value">${form.serial_number || '—'}</div></div>
              <div class="field"><div class="label">Warranty #</div><div class="value">${form.warranty_number || '—'}</div></div>
              <div class="field"><div class="label">Doctors</div><div class="value">${doctorNames}</div></div>
            </div>
          </div>
          ${form.notes ? `<div class="section"><h2>Notes</h2><p style="font-size:13px;line-height:1.6">${form.notes}</p></div>` : ''}
          ${form.attachments?.length ? `
          <div class="section">
            <h2>Attachments (${form.attachments.length})</h2>
            <table>
              <tr><th>File Name</th><th>Size</th></tr>
              ${attachmentRows}
            </table>
          </div>` : ''}
          <div class="footer">
            <p>TrackImplant Dental ERP · Generated ${new Date().toLocaleString()}</p>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const handleDownload = () => {
    const doctorNames = form.doctors?.map(d => d.name).join(', ') || '—';
    const content = [
      '=== IMPLANT FORM ===',
      '',
      `Status: ${form.status}`,
      `Date: ${form.created_at ? new Date(form.created_at).toLocaleDateString() : '—'}`,
      '',
      '--- PATIENT INFORMATION ---',
      `Name: ${patient.full_name}`,
      `Patient ID: #${patient.id.slice(0, 8).toUpperCase()}`,
      `Age: ${patient.date_of_birth ? computeAge(patient.date_of_birth) + ' yrs' : '—'}`,
      `Gender: ${patient.gender || '—'}`,
      `Phone: ${patient.phone || '—'}`,
      '',
      '--- IMPLANT INFORMATION ---',
      `Type: ${form.implant_type}`,
      `Manufacturer: ${form.manufacturer}`,
      `Diameter: ${form.diameter}`,
      `Length: ${form.length || '—'}`,
      `Quantity: ${form.quantity}`,
      `Tooth #: ${form.tooth_number}`,
      `Batch #: ${form.batch_number || '—'}`,
      `Serial #: ${form.serial_number || '—'}`,
      `Warranty #: ${form.warranty_number || '—'}`,
      `Doctors: ${doctorNames}`,
      '',
      form.notes ? `--- NOTES ---\n${form.notes}\n` : '',
      form.attachments?.length ? `--- ATTACHMENTS (${form.attachments.length}) ---\n${form.attachments.map(a => `- ${a.name} (${(a.file_size / 1024).toFixed(0)} KB)`).join('\n')}\n` : '',
      '--- END ---',
      `Generated: ${new Date().toLocaleString()}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ImplantForm_${patient.full_name.replace(/\s+/g, '_')}_${form.tooth_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  const doctorNames = form.doctors?.map(d => d.name).join(', ') || '—';

  return (
    <Portal>
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 'var(--z-dialog)', background: 'rgba(5,11,20,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[24px]" style={{ background: 'rgba(13,24,40,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.05)] sticky top-0" style={{ background: 'rgba(13,24,40,0.98)' }}>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">Implant Form</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{
                background: form.status === 'Completed' ? 'rgba(0,229,168,0.12)' : 'rgba(255,193,7,0.12)',
                color: form.status === 'Completed' ? '#00E5A8' : '#FFC107',
              }}>
              {form.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }} title="Print">
              <Printer className="w-4 h-4" />
            </button>
            <button onClick={handleDownload} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }} title="Download">
              <Download className="w-4 h-4" />
            </button>
            {canEdit && (
              <button onClick={onEdit} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: '#4FD1FF' }} title="Edit">
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button onClick={onDelete} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: '#FF6B6B' }} title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Patient Information */}
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
                <div><div style={labelStyle}>Name</div><div style={valueStyle}>{patient.full_name}</div></div>
                <div><div style={labelStyle}>Patient ID</div><div style={valueStyle} className="font-mono">#{patient.id.slice(0, 8).toUpperCase()}</div></div>
                <div><div style={labelStyle}>Age</div><div style={valueStyle}>{patient.date_of_birth ? computeAge(patient.date_of_birth) + ' yrs' : '—'}</div></div>
                <div><div style={labelStyle}>Gender</div><div style={valueStyle}>{patient.gender || '—'}</div></div>
                <div><div style={labelStyle}>Phone</div><div style={valueStyle}>{patient.phone || '—'}</div></div>
                <div><div style={labelStyle}>Date</div><div style={valueStyle}>{form.created_at ? new Date(form.created_at).toLocaleDateString() : new Date().toLocaleDateString()}</div></div>
              </div>
            </div>
          </div>

          {/* Implant Information */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Implant Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={labelStyle}>Implant Type</div>
                <div style={valueStyle}>{form.implant_type}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={labelStyle}>Manufacturer</div>
                <div style={valueStyle}>{form.manufacturer}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={labelStyle}>Diameter</div>
                <div style={valueStyle}>{form.diameter}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={labelStyle}>Length</div>
                <div style={valueStyle}>{form.length || '—'}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={labelStyle}>Quantity</div>
                <div style={valueStyle}>{form.quantity}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={labelStyle}>Tooth Number</div>
                <div style={valueStyle}>{form.tooth_number}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={labelStyle}>Batch / Lot #</div>
                <div style={valueStyle}>{form.batch_number || '—'}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={labelStyle}>Serial #</div>
                <div style={valueStyle}>{form.serial_number || '—'}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={labelStyle}>Warranty #</div>
                <div style={valueStyle}>{form.warranty_number || '—'}</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={labelStyle}>Doctors</div>
                <div style={valueStyle}>{doctorNames}</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {form.notes && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Notes</h3>
              <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)' }}>
                {form.notes}
              </div>
            </div>
          )}

          {/* Attachments */}
          {form.attachments && form.attachments.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Attachments ({form.attachments.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {form.attachments.map(att => (
                  <a key={att.id} href={att.public_url} target="_blank" rel="noopener noreferrer"
                    className="rounded-xl p-3 flex items-center gap-2 transition-all hover:bg-[rgba(255,255,255,0.04)]"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {fileIcon(att.type)}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-white truncate">{att.name}</p>
                      <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{(att.file_size / 1024).toFixed(0)} KB</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Created: {form.created_at ? new Date(form.created_at).toLocaleString() : '—'} ·
            {form.updated_at && form.updated_at !== form.created_at ? ` Last modified: ${new Date(form.updated_at).toLocaleString()}` : ''}
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
}
