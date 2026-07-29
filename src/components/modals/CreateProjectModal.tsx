import { useState, useEffect, type ReactNode } from 'react';
import { Upload, X, Map, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { getFileUrl } from '@/lib/api';
import { toast } from 'sonner';

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: (project: any) => void;
}

interface SellerEntry {
  name: string;
  phone: string;
  email: string;
  address: string;
  docs: string[];
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="text-base font-semibold text-slate-900 mb-4">{children}</h4>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export function CreateProjectModal({ open, onClose, onSave }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Upcoming');
  const [totalLandArea, setTotalLandArea] = useState('');
  const [landAreaUnit, setLandAreaUnit] = useState('Acres');
  const [totalPlots, setTotalPlots] = useState('');
  const [surveyNumber, setSurveyNumber] = useState('');
  const [landType, setLandType] = useState('Residential');
  
  const [images, setImages] = useState<string[]>([]);
  const [plotImages, setPlotImages] = useState<string[]>([]);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [category, setCategory] = useState('Open Plots');
  const [sellers, setSellers] = useState<SellerEntry[]>([
    { name: '', phone: '', email: '', address: '', docs: [] },
  ]);
  const [uploading, setUploading] = useState(false);

  const inputClass = 'w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all';
  const selectClass = 'w-full h-10 px-3 border border-slate-200 rounded-md text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white';
  const textareaClass = 'w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:border-brand-green focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-y min-h-[80px]';


  const addSeller = () => {
    setSellers(prev => [...prev, { name: '', phone: '', email: '', address: '', docs: [] }]);
  };

  const removeSeller = (index: number) => {
    setSellers(prev => prev.filter((_, i) => i !== index));
  };

  const updateSeller = (index: number, field: keyof Omit<SellerEntry, 'docs'>, value: string) => {
    if (field === 'phone') value = value.replace(/\D/g, '').slice(0, 10);
    setSellers(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const addSellerDoc = async (index: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { uploadService } = await import('@/services/uploads');
      const res = await uploadService.upload('kyc', Array.from(files));
      const paths = (res.data || []).map((f: any) => f.path || f.filename);
      setSellers(prev => prev.map((s, i) => i === index ? { ...s, docs: [...s.docs, ...paths] } : s));
    } catch { toast.error('Failed to upload KYC document. Please try again.'); }
    finally { setUploading(false); }
  };

  const removeSellerDoc = (sellerIndex: number, docIndex: number) => {
    setSellers(prev => prev.map((s, i) => i === sellerIndex ? { ...s, docs: s.docs.filter((_, j) => j !== docIndex) } : s));
  };


  const [village, setVillage] = useState('');
  const [mandal, setMandal] = useState('');
  const [district, setDistrict] = useState('');

  // Reverse geocoding when latitude and longitude change
  useEffect(() => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
      const fetchLocation = async () => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
          const data = await res.json();
          if (data && data.address) {
            const a = data.address;
            const newVillage = a.village || a.suburb || a.town || a.neighbourhood || '';
            const newMandal = a.county || a.state_district || '';
            const newDistrict = a.state_district || a.city || '';
            
            if (newVillage) setVillage(newVillage);
            if (newMandal) setMandal(newMandal.replace(' District', '').replace(' Mandal', ''));
            if (newDistrict) setDistrict(newDistrict.replace(' District', ''));
            
            const newLocation = newVillage ? `${newVillage}, ${newDistrict || newMandal}`.replace(' District', '') : '';
            if (newLocation && !location) setLocation(newLocation);
          }
        } catch (err) {
          console.error('Reverse geocoding failed', err);
        }
      };
      
      const timeout = setTimeout(fetchLocation, 1000); // debounce 1s
      return () => clearTimeout(timeout);
    }
  }, [latitude, longitude]);

  const handleSave = () => {
    if (!name.trim()) { toast.error('Project Name is required.'); return; }
    if (!latitude.trim()) { toast.error('Latitude is required.'); return; }
    if (!longitude.trim()) { toast.error('Longitude is required.'); return; }
    if (!location.trim()) { toast.error('Project Location is required.'); return; }
    if (!totalLandArea.trim() || Number(totalLandArea) <= 0) { toast.error('Total Land Area is required and must be greater than 0.'); return; }
    if (!totalPlots.trim() || Number(totalPlots) <= 0) { toast.error('Total Number of Plots is required and must be greater than 0.'); return; }
    if (!surveyNumber.trim()) { toast.error('Survey Number is required.'); return; }
    if (uploading) { toast.error('Please wait for uploads to complete.'); return; }

    const validSellers = sellers.filter(s => s.name.trim() || s.phone.trim() || s.email.trim() || s.address.trim() || s.docs.length > 0);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (let i = 0; i < validSellers.length; i++) {
      const s = validSellers[i];
      if (s.phone && s.phone.length !== 10) {
        toast.error(`Seller ${i + 1} phone number must be exactly 10 digits.`);
        return;
      }
      if (s.email && !emailRegex.test(s.email)) {
        toast.error(`Seller ${i + 1} email is invalid.`);
        return;
      }
    }

    const primarySeller = validSellers[0];
    const newProj = {
      id: `p-${Date.now()}`,
      name,
      location,
      description,
      status,
      category,
      totalLandArea: Number(totalLandArea) || 0,
      landAreaUnit,
      surveyNumber,
      village: village || 'Gachibowli',
      mandal: mandal || 'Serilingampally',
      district: district || 'Ranga Reddy',
      landType,
      totalPlots: Number(totalPlots) || 0,
      plotSize: 200,
      plotSizeUnit: 'Sq Feet',
      roadFacingPlots: 0,
      cornerPlots: 0,
      images: images,
      plotImages: plotImages,
      createdAt: new Date().toISOString().split('T')[0],
      latitude,
      longitude,
      isEnabled: true,
      owner: primarySeller ? {
        name: primarySeller.name,
        phone: primarySeller.phone,
        email: primarySeller.email || undefined,
        address: primarySeller.address || undefined,
        kycDocuments: primarySeller.docs.map((d, i) => ({
          id: `doc-${Date.now()}-${i}`,
          name: d,
          type: 'PDF' as const,
          uploadedAt: new Date().toISOString().split('T')[0],
        })),
      } : undefined,
      sellers: validSellers.map((s, idx) => ({
        name: s.name,
        phone: s.phone,
        email: s.email || undefined,
        address: s.address || undefined,
        kycDocuments: s.docs.map((d, i) => ({
          id: `doc-${Date.now()}-${idx}-${i}`,
          name: d,
          type: 'PDF' as const,
          uploadedAt: new Date().toISOString().split('T')[0],
        })),
      })),
    };
    if (onSave) onSave(newProj);
    onClose();
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Create New Project" size="md" footer={
        <>
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={uploading} className="px-4 py-2 bg-brand-green text-white rounded-md text-sm font-medium hover:bg-brand-darkgreen active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {uploading ? 'Uploading...' : 'Save Project'}
          </button>
        </>
      }>
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
          {/* Section 1 - Basic Info */}
          <div className="pb-5 border-b border-slate-100">
            <SectionTitle>Basic Information</SectionTitle>
            <Field label="Project Name" required>
              <input type="text" placeholder="Enter project name" value={name} onChange={e => setName(e.target.value)} className={inputClass} />
            </Field>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Latitude<span className="text-red-500 ml-0.5">*</span></label>
                <input type="text" placeholder="e.g. 17.4483" value={latitude} onChange={e => setLatitude(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Longitude<span className="text-red-500 ml-0.5">*</span></label>
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

            <Field label="Project Location" required>
              <input type="text" placeholder="e.g., Hyderabad" value={location} onChange={e => setLocation(e.target.value)} className={inputClass} />
            </Field>

            <Field label="Project Description">
              <textarea placeholder="Describe the project..." rows={3} value={description} onChange={e => setDescription(e.target.value)} className={textareaClass} />
            </Field>
            <Field label="Project Status">
              <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass}>
                <option>Upcoming</option>
                <option>Active</option>
                <option>Completed</option>
                <option>On Hold</option>
              </select>
            </Field>
            <Field label="Project Category">
              <select value={category} onChange={e => setCategory(e.target.value)} className={selectClass}>
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total Land Area" required>
                <div className="flex gap-2">
                  <input type="number" placeholder="0" value={totalLandArea} onChange={e => setTotalLandArea(e.target.value)} className={inputClass} />
                  <select value={landAreaUnit} onChange={e => setLandAreaUnit(e.target.value)} className={`${selectClass} w-28`}>
                    <option>Acres</option>
                    <option>Sq Yards</option>
                    <option>Sq Feet</option>
                    <option>Guntas</option>
                    <option>Cents</option>
                  </select>
                </div>
              </Field>
              <Field label="Total Number of Plots" required>
                <input type="number" placeholder="e.g. 50" value={totalPlots} onChange={e => setTotalPlots(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Field label="Survey Number" required>
                <input type="text" placeholder="Enter survey number" value={surveyNumber} onChange={e => setSurveyNumber(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Village">
                <input type="text" placeholder="Enter village" value={village} onChange={e => setVillage(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Field label="Mandal">
                <input type="text" placeholder="Enter mandal" value={mandal} onChange={e => setMandal(e.target.value)} className={inputClass} />
              </Field>
              <Field label="District">
                <input type="text" placeholder="Enter district" value={district} onChange={e => setDistrict(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field label="Land Type">
              <select value={landType} onChange={e => setLandType(e.target.value)} className={selectClass}>
                <option>Agricultural</option>
                <option>Residential</option>
                <option>Commercial</option>
                <option>Mixed</option>
              </select>
            </Field>
          </div>

        {/* Section 3 - Seller Details */}
        <div className="pb-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Seller Details</SectionTitle>
            <button
              type="button"
              onClick={addSeller}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-blue-300 rounded-md text-xs font-semibold text-brand-blue hover:bg-blue-50 transition-colors"
            >
              <Plus size={14} /> Add Seller
            </button>
          </div>

          {sellers.map((seller, idx) => (
            <div key={idx} className={`rounded-lg border ${sellers.length > 1 ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100'} p-4 mb-4 last:mb-0`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-slate-800">Seller {idx + 1}</span>
                {sellers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSeller(idx)}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Seller Name`}>
                  <input type="text" placeholder="Enter seller name" value={seller.name} onChange={e => updateSeller(idx, 'name', e.target.value)} className={inputClass} />
                </Field>
                <Field label={`Seller Phone Number`}>
                  <input type="tel" placeholder="Enter seller phone number" value={seller.phone} onChange={e => updateSeller(idx, 'phone', e.target.value)} className={inputClass} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Seller Email`}>
                  <input type="email" placeholder="Enter seller email" value={seller.email} onChange={e => updateSeller(idx, 'email', e.target.value)} className={inputClass} />
                </Field>
                <Field label={`Seller Address`}>
                  <input type="text" placeholder="Enter seller address" value={seller.address} onChange={e => updateSeller(idx, 'address', e.target.value)} className={inputClass} />
                </Field>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Seller KYC / Account Details</label>
                <label
                  className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer block"
                >
                  <input type="file" accept=".pdf" multiple className="hidden" onChange={(e) => addSellerDoc(idx, e.target.files)} />
                  <Upload size={20} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-sm text-slate-500">Upload PDF only (KYC, bank details, sale deed, EC)</p>
                </label>
                {seller.docs.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {seller.docs.map((doc, di) => {
                      const cleanName = doc.split('/').pop()?.split('\\').pop()?.replace(/^\d+[-_]/, '') || doc;
                      return (
                        <div key={di} className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                          <span className="text-xs font-medium text-slate-600 truncate">{cleanName}</span>
                          <button onClick={() => removeSellerDoc(idx, di)} className="text-slate-400 hover:text-slate-700">
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Section 4 - Plot Images */}
        <div className="pb-5 border-b border-slate-100">
          <SectionTitle>Plot Sketch Images</SectionTitle>
          <label
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all block ${plotImages.length >= 2 ? 'border-slate-100 bg-slate-50 cursor-not-allowed' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer'}`}
          >
            <input type="file" accept="image/*,.pdf" multiple className="hidden" disabled={plotImages.length >= 2} onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              if (!files.length) return;
              setUploading(true);
              try { const { uploadService } = await import('@/services/uploads'); const res = await uploadService.upload('plots', files.slice(0, 2 - plotImages.length)); setPlotImages(prev => [...prev, ...(res.data || []).map((f: any) => f.path)]); } catch { toast.error('Failed to upload plot images. Please try again.'); }
              finally { setUploading(false); }
              e.target.value = '';
            }} />
            <Upload size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-500">Upload plot layout or boundary image</p>
            <p className="text-xs text-slate-400 mt-1">Maximum 2 images</p>
          </label>
          {plotImages.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3">
              {plotImages.map((img, i) => (
                <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-200 shadow-sm flex-shrink-0 bg-slate-50">
                  <img src={getFileUrl(img)} alt={`Plot ${i + 1}`} className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); setPlotImages(prev => prev.filter((_, j) => j !== i)); }}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                    title="Remove Image"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 5 - Project Images */}
        <div>
          <SectionTitle>Project Images</SectionTitle>
          <label
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all block ${images.length >= 10 ? 'border-slate-100 bg-slate-50 cursor-not-allowed' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer'}`}
          >
            <input type="file" accept="image/*,.pdf" multiple className="hidden" disabled={images.length >= 10} onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              if (!files.length) return;
              setUploading(true);
              try { const { uploadService } = await import('@/services/uploads'); const res = await uploadService.upload('projects', files.slice(0, 10 - images.length)); setImages(prev => [...prev, ...(res.data || []).map((f: any) => f.path)]); } catch { toast.error('Failed to upload project images. Please try again.'); }
              finally { setUploading(false); }
              e.target.value = '';
            }} />
            <Upload size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-500">Click to upload or drag &amp; drop</p>
            <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 10MB (Maximum 10 images)</p>
          </label>
          {images.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3">
              {images.map((img, i) => (
                <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-slate-200 shadow-sm flex-shrink-0 bg-slate-50">
                  <img src={getFileUrl(img)} alt={`Project ${i + 1}`} className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); setImages(prev => prev.filter((_, j) => j !== i)); }}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                    title="Remove Image"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
