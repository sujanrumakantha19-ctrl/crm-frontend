import { useState, type ReactNode } from 'react';
import { Upload, X, Map, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { toast } from 'sonner';
import type { Project } from '@/types';

interface EditProjectModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  onSave: (updated: Project) => void;
}



function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="text-base font-semibold text-slate-900 mb-4">{children}</h4>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function EditProjectModal({ open, onClose, project, onSave }: EditProjectModalProps) {
  const [name, setName] = useState(project.name);
  const [location, setLocation] = useState(project.location);
  const [latitude, setLatitude] = useState(project.latitude || '');
  const [longitude, setLongitude] = useState(project.longitude || '');
  const [mapOpen, setMapOpen] = useState(false);
  const [description, setDescription] = useState(project.description);
  const [status, setStatus] = useState(project.status);
  const [category, setCategory] = useState<any>(project.category || 'Open Plots');
  const [isEnabled, setIsEnabled] = useState(project.isEnabled !== false);
  const [totalLandArea, setTotalLandArea] = useState(project.totalLandArea);
  const [landAreaUnit, setLandAreaUnit] = useState(project.landAreaUnit);
  const [surveyNumber, setSurveyNumber] = useState(project.surveyNumber);
  const [village, setVillage] = useState(project.village);
  const [mandal] = useState(project.mandal);
  const [district, setDistrict] = useState(project.district);
  const [landType, setLandType] = useState(project.landType);
  const [totalPlots, setTotalPlots] = useState(project.totalPlots);
  const inputClass = 'w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all';
  const selectClass = 'w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white';
  const textareaClass = 'w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-y min-h-[80px]';

  const handleSave = () => {
    if (!name.trim()) { toast.error('Project Name is required.'); return; }
    if (!location.trim()) { toast.error('Project Location is required.'); return; }
    onSave({
      ...project,
      name,
      location,
      latitude,
      longitude,
      description,
      status,
      category,
      isEnabled,
      totalLandArea: Number(totalLandArea),
      landAreaUnit,
      surveyNumber,
      village,
      mandal,
      district,
      landType,
      totalPlots: Number(totalPlots),
    });
    onClose();
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Edit Project Details" size="md" footer={
        <>
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-brand-green text-white rounded-md text-sm font-medium hover:bg-brand-darkgreen active:scale-[0.98] transition-all">
            Save Changes
          </button>
        </>
      }>
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">


          {/* Section 3 - Basic Info */}
          <div className="pb-5 border-b border-slate-100">
            <SectionTitle>Basic Information</SectionTitle>
            <Field label="Project Name"><input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} /></Field>
            <Field label="Project Location"><input type="text" value={location} onChange={e => setLocation(e.target.value)} className={inputClass} /></Field>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Latitude</label>
                <input type="text" placeholder="e.g. 17.4483" value={latitude} onChange={e => setLatitude(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Longitude</label>
                <div className="relative">
                  <input type="text" placeholder="e.g. 78.3741" value={longitude} onChange={e => setLongitude(e.target.value)} className={`${inputClass} pr-10`} />
                  <button
                    type="button"
                    onClick={() => {
                      if (latitude && longitude) setMapOpen(true);
                    }}
                    disabled={!latitude || !longitude}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-brand-blue disabled:opacity-40 disabled:hover:text-slate-400 transition-colors"
                    title={latitude && longitude ? "View on Map" : "Enter latitude & longitude to view map"}
                  >
                    <Map size={16} />
                  </button>
                </div>
              </div>
            </div>

            <Field label="Project Description"><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={textareaClass} /></Field>
            <Field label="Project Status">
              <select value={status} onChange={e => setStatus(e.target.value as any)} className={selectClass}>
                <option>Upcoming</option>
                <option>Active</option>
                <option>Completed</option>
                <option>On Hold</option>
              </select>
            </Field>
            <Field label="Project Category">
              <select value={category} onChange={e => setCategory(e.target.value as any)} className={selectClass}>
                <option value="Open Plots">Open Plots</option>
                <option value="Villas">Villas</option>
                <option value="Apartments">Apartments</option>
                <option value="Commercial">Commercial</option>
                <option value="Farm Land">Farm Land</option>
              </select>
            </Field>
          </div>

          {/* Section 2 - Land Details */}
          <div className="pb-5 border-b border-slate-100">
            <SectionTitle>Land Details</SectionTitle>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Total Land Area">
                <div className="flex gap-2">
                  <input type="number" value={totalLandArea} onChange={e => setTotalLandArea(Number(e.target.value))} className={inputClass} />
                  <select value={landAreaUnit} onChange={e => setLandAreaUnit(e.target.value)} className={`${selectClass} w-28`}>
                    <option>Acres</option>
                    <option>Sq Yards</option>
                    <option>Sq Feet</option>
                    <option>Guntas</option>
                    <option>Cents</option>
                  </select>
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Survey Number"><input type="text" value={surveyNumber} onChange={e => setSurveyNumber(e.target.value)} className={inputClass} /></Field>
              <Field label="Village"><input type="text" value={village} onChange={e => setVillage(e.target.value)} className={inputClass} /></Field>
              <Field label="District"><input type="text" value={district} onChange={e => setDistrict(e.target.value)} className={inputClass} /></Field>
            </div>
            <Field label="Land Type">
              <select value={landType} onChange={e => setLandType(e.target.value as any)} className={selectClass}>
                <option>Agricultural</option>
                <option>Residential</option>
                <option>Commercial</option>
                <option>Mixed</option>
              </select>
            </Field>
          </div>


        </div>
      </Modal>

      {mapOpen && (
        <Modal open={mapOpen} onClose={() => setMapOpen(false)} title="Coordinates Map Location" size="md">
          <div className="space-y-4">
            <p className="text-xs text-slate-400">Showing map location for coordinates: {latitude}, {longitude}</p>
            <div className="w-full h-80 rounded-lg overflow-hidden border border-slate-200">
              <iframe
                title="Location Map"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight={0}
                marginWidth={0}
                src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=14&output=embed`}
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
