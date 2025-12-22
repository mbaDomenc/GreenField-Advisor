import React, { useEffect, useRef, useState } from 'react';
import { X, MapPin, Camera, Trash2, Sprout, CheckCircle, AlertTriangle, Loader2, ScanLine } from 'lucide-react';
import { api } from '../api/axiosInstance';
import { diagnosePlantHealth } from '../api/imagesApi'; 
import PlaceAutocomplete from './PlaceAutocomplete';

const SUPPORTED_SPECIES = [
    { id: 'tomato', label: 'Pomodoro (Tomato)' },
    { id: 'potato', label: 'Patata (Potato)' },
    { id: 'pepper', label: 'Peperone (Pepper)' },
    { id: 'peach', label: 'Pesca (Peach)' },   
    { id: 'grape', label: 'Uva (Grape)' },     
    { id: 'generic', label: 'Altra Specie (Generica)' }
];

const SUPPORTED_SOILS = [
    { id: 'franco', label: 'Lavorabile (Medio impasto)' },
    { id: 'universale', label: 'Universale (Standard)' },
    { id: 'argilloso', label: 'Argilloso (Pesante)' },
    { id: 'sabbioso', label: 'Sabbioso (Drenante)' },
    { id: 'acido', label: 'Acido (es. Mirtilli)' },
    { id: 'torboso', label: 'Torboso' }
];

export default function PlantFormModal({ open, onClose, initialData = null, onSubmit, mode = 'create' }) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(initialData?.name || '');
  const [selectedSpecies, setSelectedSpecies] = useState(initialData?.species || '');
  const [placeText, setPlaceText] = useState(initialData?.location || '');
  const [geo, setGeo] = useState(null);
  const [description, setDescription] = useState(initialData?.description || '');
  const [soil, setSoil] = useState(initialData?.soil || '');
  const [healthStatus, setHealthStatus] = useState(initialData?.healthStatus || '');
  const [healthAdvice, setHealthAdvice] = useState(initialData?.healthAdvice || '');
  const [analyzing, setAnalyzing] = useState(false);
  const [errors, setErrors] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(initialData?.imageUrl || initialData?.imageThumbUrl || null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
        setErrors({}); setSelectedFile(null); setPreview(null); setAnalyzing(false);
        if (!isEdit) {
            setName(''); setSelectedSpecies(''); setPlaceText(''); setGeo(null);
            setDescription(''); setSoil(''); setHealthStatus(''); setHealthAdvice('');
        }
    }
  }, [open, isEdit]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file); setPreview(URL.createObjectURL(file)); setErrors(p => ({...p, image:null}));
      setHealthStatus(''); setHealthAdvice(''); setAnalyzing(true);
      try {
          const res = await diagnosePlantHealth(file, selectedSpecies);
          const data = res.analysis;
          if (data) {
              setHealthStatus(data.label); setHealthAdvice(data.advice);
              if (!description) setDescription(data.advice);
          }
      } catch (error) { console.error(error); } finally { setAnalyzing(false); }
    }
  };

  const handleUploadClick = () => {
    if (preview) return;
    if (!selectedSpecies) {
        setErrors(prev => ({ ...prev, species: "Seleziona prima la specie!", image: "Seleziona prima la specie!" }));
        return;
    }
    fileInputRef.current.click();
  };

  const removeImage = () => { setSelectedFile(null); setPreview(null); setHealthStatus(''); setHealthAdvice(''); if(fileInputRef.current) fileInputRef.current.value=''; };

  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = 'Nome obbligatorio';
    if (!selectedSpecies) next.species = 'Specie obbligatoria';
    if (!placeText) next.location = 'Posizione obbligatoria';
    if (!soil) next.soil = 'Seleziona il tipo di terreno';
    if (!selectedFile && !preview) next.image = 'Foto obbligatoria';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      name: name.trim(), species: selectedSpecies, location: placeText, description,
      soil, healthStatus, healthAdvice
    };
    if (geo) { payload.geoLat = geo.lat; payload.geoLng = geo.lng; payload.placeId = geo.placeId; }
    try { await onSubmit(payload, selectedFile); onClose?.(); } catch (err) { alert('Errore salvataggio'); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 bg-green-600 text-white flex-shrink-0">
          <h3 className="text-lg font-bold">{isEdit ? 'Modifica Pianta' : 'Aggiungi Pianta'}</h3>
          <button onClick={onClose} className="p-2 rounded hover:bg-white/10 text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto p-6">
          <form onSubmit={handleSubmit} id="plantForm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Foto */}
              <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center mb-2">
                <div onClick={handleUploadClick} className={`relative group w-32 h-32 rounded-full border-2 flex items-center justify-center overflow-hidden transition-all ${errors.image ? 'border-red-500 bg-red-50' : 'border-dashed border-green-300 bg-green-50'} ${!selectedSpecies && !preview ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-green-100'} ${preview ? 'border-solid border-green-600 opacity-100' : ''}`}>
                    {preview ? <img src={preview} alt="Preview" className="w-full h-full object-cover" /> : <div className="text-center p-2"><Camera className={`h-8 w-8 mx-auto mb-1 ${errors.image?'text-red-400':'text-green-500'}`}/><span className={`text-xs font-medium ${errors.image?'text-red-600':'text-green-700'}`}>{selectedSpecies?"Aggiungi Foto":"Scegli Specie"}</span></div>}
                    {preview && <button type="button" onClick={(e) => { e.stopPropagation(); removeImage(); }} className="absolute top-0 right-0 bg-red-500 text-white p-1.5 rounded-full shadow hover:bg-red-600 transform translate-x-1/4 -translate-y-1/4"><Trash2 className="h-4 w-4" /></button>}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                {errors.image && <p className="text-xs text-red-600 mt-2 font-bold">{errors.image}</p>}
                
                {/* --- Box Informativo Foto Foglia --- */}
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-3 w-full max-w-md">
                    <div className="p-2 bg-white rounded-full border border-blue-100 shadow-sm shrink-0">
                        <ScanLine className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-blue-900 mb-0.5">
                            Suggerimento per l'AI
                        </h4>
                        <p className="text-xs text-blue-700 leading-snug">
                            Per un riconoscimento preciso, carica una foto nitida di una <strong>singola foglia</strong> ben illuminata, piuttosto che dell'intera pianta.
                        </p>
                    </div>
                </div>

                {/* Risultato IA */}
                <div className="mt-4 w-full max-w-md">
                    {analyzing && <div className="flex items-center justify-center gap-2 text-indigo-600 bg-indigo-50 p-2 rounded-lg border border-indigo-100"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm font-medium">Analisi salute in corso...</span></div>}
                    {!analyzing && healthStatus && (<div className={`p-3 rounded-lg border flex items-start gap-3 ${healthStatus.toLowerCase().includes('healthy') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>{healthStatus.toLowerCase().includes('healthy') ? <CheckCircle className="h-5 w-5 mt-0.5" /> : <AlertTriangle className="h-5 w-5 mt-0.5" />}<div className="text-left"><p className="text-sm font-bold uppercase tracking-wide">{healthStatus}</p><p className="text-xs mt-1 opacity-90">{healthAdvice}</p></div></div>)}
                </div>
              </div>

              <div className="col-span-1"><label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-600">*</span></label><input type="text" value={name} onChange={e => { setName(e.target.value); if(errors.name) setErrors(p=>({...p,name:null})); }} className={`w-full px-3 py-2 border rounded-lg ${errors.name?'border-red-500':'border-gray-300'}`} required />{errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}</div>
              
              <div className="col-span-1"><label className="block text-sm font-medium text-gray-700 mb-1">Specie <span className="text-red-600">*</span></label><div className="relative"><select value={selectedSpecies} onChange={e => { setSelectedSpecies(e.target.value); if(errors.species) setErrors(p => ({...p, species:null})); setErrors(p => ({...p, image:null})); }} className={`w-full px-3 py-2 border rounded-lg appearance-none bg-white ${errors.species?'border-red-500':'border-gray-300'}`}><option value="">Seleziona...</option>{SUPPORTED_SPECIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select><Sprout className="h-4 w-4 text-gray-400 absolute right-3 top-3 pointer-events-none"/></div>{errors.species && <p className="text-xs text-red-600 mt-1">{errors.species}</p>}</div>

              <div className="col-span-1"><label className="block text-sm font-medium text-gray-700 mb-1">Posizione <span className="text-red-600">*</span></label><div className="relative"><PlaceAutocomplete value={placeText} onChangeText={(txt) => { setPlaceText(txt); if(errors.location) setErrors(p=>({...p,location:null})); }} onSelectPlace={(p) => { setPlaceText(p.formattedAddress); setGeo(p); if(errors.location) setErrors(p=>({...p,location:null})); }} className={`w-full px-3 py-2 pl-9 border rounded-lg ${errors.location?'border-red-500':'border-gray-300'}`} /><MapPin className="h-4 w-4 text-gray-400 absolute left-3 top-3 pointer-events-none"/></div>{errors.location && <p className="text-xs text-red-600 mt-1">{errors.location}</p>}</div>

              {/*TERRENO OBBLIGATORIO */}
              <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipologia Terreno <span className="text-red-600">*</span></label>
                  <div className="relative">
                      <select value={soil} onChange={(e) => { setSoil(e.target.value); if(errors.soil) setErrors(p=>({...p,soil:null})); }} className={`w-full px-3 py-2 border rounded-lg appearance-none bg-white ${errors.soil?'border-red-500':'border-gray-300'}`}>
                          <option value="">Seleziona terreno...</option>
                          {SUPPORTED_SOILS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                      <div className="absolute right-3 top-2.5 pointer-events-none text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg></div>
                  </div>
                  {errors.soil && <p className="text-xs text-red-600 mt-1">{errors.soil}</p>}
              </div>  

              <div className="col-span-1 md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none" /></div>
            </div>
          </form>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium">Annulla</button>
          <button type="submit" form="plantForm" className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm font-medium">{isEdit ? 'Salva Modifiche' : 'Crea Pianta'}</button>
        </div>
      </div>
    </div>
  );
}