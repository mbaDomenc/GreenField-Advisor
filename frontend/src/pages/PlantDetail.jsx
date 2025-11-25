import React, { useState, useEffect, useRef } from 'react';
import {
  Edit,
  Calendar,
  Droplets,
  Sun,
  Leaf,
  MapPin,
  Clock,
  Camera,
  Trash2,
  Pencil,
  FlaskConical 
} from 'lucide-react';
import { api } from '../api/axiosInstance';
import PlantFormModal from '../components/PlantFormModal';

const PlantDetail = ({ plantId, onBack, onDeleted }) => {
  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [recentInterventions, setRecentInterventions] = useState([]);
  const fileRef = useRef(null);

  // Modali Interventi
  const [showIrrigModal, setShowIrrigModal] = useState(false);
  const [showFertModal, setShowFertModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);


  function getLocalDatetimePlus2H() {
  const now = new Date();
  now.setHours(now.getHours() + 2);
  const iso = now.toISOString();
  return iso.slice(0, 16); // 'YYYY-MM-DDTHH:mm'
}

  // Form stati
  const [irrigForm, setIrrigForm] = useState({
    liters: '',
    executedAt: getLocalDatetimePlus2H(), // datetime-local
    notes: '',
  });

  const [fertForm, setFertForm] = useState({
    status: 'done', // 'done' | 'planned'
    fertilizerType: '',
    dose: '',
    executedAt: getLocalDatetimePlus2H(),
    plannedAt: new Date().toISOString().slice(0, 16),
    notes: '',
  });

  const [planForm, setPlanForm] = useState({
    type: 'irrigazione', // irrigazione | concimazione | potatura | altro
    plannedAt: getLocalDatetimePlus2H(),
    notes: '',
  });

  //Helpers

  const asISO = (val) => {
    if (!val) return null;
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    } catch {
      return null;
    }
  };

  // Normalizza un intervento (accetta camelCase/snake_case e fallback "date")
  const normalizeIntervention = (raw) => ({
    id: raw?.id ?? raw?._id ?? null,
    type: raw?.type ?? null,
    status: raw?.status ?? null,
    notes: raw?.notes ?? null,
    liters: raw?.liters ?? null,
    fertilizerType: raw?.fertilizerType ?? raw?.fertilizer_type ?? null,
    dose: raw?.dose ?? null,
    executedAt: asISO(raw?.executedAt ?? raw?.executed_at ?? raw?.date ?? null),
    plannedAt: asISO(raw?.plannedAt ?? raw?.planned_at ?? null),
    createdAt: asISO(raw?.createdAt ?? raw?.created_at ?? raw?.date ?? null),
  });

  // Data da mostrare: eseguito -> pianificato -> creato
  const getInterventionDate = (i) =>
    i?.executedAt || i?.plannedAt || i?.createdAt || null;

  const toISO = (dtLocal) => {
    try {
      return new Date(dtLocal).toISOString();
    } catch {
      return new Date().toISOString();
    }
  };

  const formatDate = (dateString) =>
    dateString
      ? new Date(dateString).toLocaleDateString('it-IT', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'Non disponibile';

  const formatDateTime = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const offset = new Date(date.getTime() + 2 * 60 * 60 * 1000); // Aggiunge 2 ore manualmente
  return offset.toLocaleString('it-IT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

  const getInterventionIcon = (type) => {
    switch (type) {
      case 'irrigazione':
        return <Droplets className="h-4 w-4 text-blue-600" />;
      case 'concimazione':
        return <FlaskConical className="h-4 w-4 text-amber-600" />;
      case 'potatura':
        return <Edit className="h-4 w-4 text-orange-600" />;
      default:
        return <Calendar className="h-4 w-4 text-gray-600" />;
    }
  };

  const statusChip = (status) => {
    const map = {
      done: 'bg-green-100 text-green-800',
      planned: 'bg-amber-100 text-amber-800',
      pending: 'bg-gray-100 text-gray-800',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          map[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {status || 'n/d'}
      </span>
    );
  };

  // Upload Immagine
  const onClickChangePhoto = () => fileRef.current?.click();

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Seleziona un file immagine');
    if (file.size > 8 * 1024 * 1024) return alert('Max 8MB');

    const form = new FormData();
    form.append('file', file);

    try {
      setUploadingImg(true);
      const { data } = await api.post(`/api/piante/${plantId}/image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPlant((p) => ({
        ...p,
        imageUrl: data.imageUrl,
        imageThumbUrl: data.imageThumbUrl,
      }));
    } catch (err) {
      console.error('Upload image error', err);
      alert('Errore nel caricamento immagine');
    } finally {
      setUploadingImg(false);
      e.target.value = ''; // reset input
    }
  };

  const onRemovePhoto = async () => {
    if (!window.confirm('Rimuovere l’immagine?')) return;
    try {
      setUploadingImg(true);
      const { data } = await api.delete(`/api/piante/${plantId}/image`);
      setPlant((p) => ({
        ...p,
        imageUrl: data.imageUrl ?? null,
        imageThumbUrl: data.imageThumbUrl ?? null,
      }));
    } catch (err) {
      console.error('Delete image error', err);
      alert('Errore nella rimozione dell’immagine');
    } finally {
      setUploadingImg(false);
    }
  };

  // Loaders
  const fetchPlant = async () => {
    const { data } = await api.get(`/api/piante/${plantId}`);
    setPlant(data);
  };

  const fetchInterventions = async () => {
    try {
      const { data } = await api.get(`/api/piante/${plantId}/interventi`, {
        params: { limit: 3 }, // 👈 richiede già max 3
      });

      // Normalizza e ordina (executedAt -> plannedAt -> createdAt)
      const normalized = (Array.isArray(data) ? data : []).map(normalizeIntervention);
      const ordered = normalized.sort((a, b) => {
        const da = new Date(getInterventionDate(a) || 0).getTime();
        const db = new Date(getInterventionDate(b) || 0).getTime();
        return db - da;
      });

      setRecentInterventions(ordered);
    } catch (e) {
      console.error('Errore fetch interventi:', e);
      setRecentInterventions([]);
    }
  };

  const loadPlantDetail = async () => {
    try {
      setLoading(true);
      await fetchPlant();
      setError(null);
      await fetchInterventions();
    } catch (err) {
      console.error('Errore nel caricamento dettagli:', err);
      setError('Errore nel caricamento dei dettagli della pianta');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (plantId) loadPlantDetail();
  }, [plantId]);

  // Modifica / Elimina Pianta
  const handleFormSubmit = async (formData) => {
    try {
      const { data: updated } = await api.patch(`/api/piante/${plantId}`, formData);
      setPlant(updated);
    } catch (error) {
      console.error("Errore nell'aggiornamento:", error);
      throw error;
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Sei sicuro di voler eliminare "${plant?.name}"?`)) {
      try {
        await api.delete(`/api/piante/${plantId}`);
        onDeleted?.();
      } catch (error) {
        console.error('Errore nell’eliminazione:', error);
        alert('Errore nell’eliminazione della pianta');
      }
    }
  };

  // HANDLERS Interventi

  const handleAddIrrigation = async () => {
    const litersNum = Number(irrigForm.liters);
    if (!litersNum || litersNum <= 0) return alert('Inserisci litri validi (> 0)');

    const payload = {
      type: 'irrigazione',
      status: 'done',
      liters: litersNum,
      executedAt: toISO(irrigForm.executedAt),
      notes: irrigForm.notes || undefined,
    };

    try {
      await api.post(`/api/piante/${plantId}/interventi`, payload);
      setShowIrrigModal(false);
      await Promise.all([fetchPlant(), fetchInterventions()]);
    } catch (e) {
      console.error('Errore irrigazione:', e);
      alert('Errore nel salvataggio irrigazione');
    }
  };

  const handleAddFertilization = async () => {
    const isPlanned = fertForm.status === 'planned';
    const doseVal = fertForm.dose?.toString().trim();
    const fertTypeVal = fertForm.fertilizerType?.trim();

    if (!fertTypeVal) return alert('Specifica il tipo di concime');
    if (!doseVal) return alert('Specifica la dose');

    const payload = {
      type: 'concimazione',
      status: fertForm.status,
      fertilizerType: fertTypeVal,
      dose: doseVal,
      notes: fertForm.notes || undefined,
      executedAt: isPlanned ? undefined : toISO(fertForm.executedAt),
      plannedAt: isPlanned ? toISO(fertForm.plannedAt) : undefined,
    };

    try {
      await api.post(`/api/piante/${plantId}/interventi`, payload);
      setShowFertModal(false);
      await Promise.all([fetchPlant(), fetchInterventions()]);
    } catch (e) {
      console.error('Errore concimazione:', e);
      alert('Errore nel salvataggio concimazione');
    }
  };

  const handlePlanIntervention = async () => {
    const type = planForm.type || 'altro';
    const payload = {
      type,
      status: 'planned',
      plannedAt: toISO(planForm.plannedAt),
      notes: planForm.notes || undefined,
    };

    try {
      await api.post(`/api/piante/${plantId}/interventi`, payload);
      setShowPlanModal(false);
      await Promise.all([fetchPlant(), fetchInterventions()]);
    } catch (e) {
      console.error('Errore pianificazione:', e);
      alert('Errore nella pianificazione intervento');
    }
  };

  // Views
  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !plant) {
    return (
      <div className="min-h-screen bg-green-50 pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">{error || 'Pianta non trovata'}</p>
            <button
              onClick={onBack}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Torna alla lista
            </button>
          </div>
        </div>
      </div>
    );
  }

  const btnDisabledClass = uploadingImg ? 'opacity-60 cursor-not-allowed' : '';

  return (
    <div className="min-h-screen bg-green-50 pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* HERO IMMAGINE (3:2, overlay info, bottoni) */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="relative w-full pt-[66.66%] bg-neutral-100">
            {plant.imageUrl || plant.imageThumbUrl ? (
              <img
                src={plant.imageUrl || plant.imageThumbUrl}
                alt={plant.name}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: '50% 40%' }}
                loading="lazy"
                onError={(e) => {
                  if (plant.imageThumbUrl && e.currentTarget.src !== plant.imageThumbUrl) {
                    e.currentTarget.src = plant.imageThumbUrl;
                  }
                }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-green-700/70">
                <div className="flex flex-col items-center">
                  <Leaf className="h-20 w-20" />
                  <p className="mt-2 text-sm">Nessuna immagine</p>
                </div>
              </div>
            )}

            {/* Box info */}
            <div className="absolute left-4 bottom-4 right-4 sm:left-6 sm:right-auto sm.max-w-[520px]">
              <div className="bg-white/95 rounded-xl shadow-md px-4 py-3">
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  <h1 className="text-2xl font-bold text-gray-900 truncate">
                    {plant.name || 'Senza nome'}
                  </h1>
                  {/* ❌ RIMOSSO: Badge fase accanto al nome */}
                  {/* <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStageColor(
                      plant.stage
                    )}`}
                  >
                    {plant.stage || 'Non specificato'}
                  </span> */}
                </div>
                <p className="text-green-800/80 italic mt-0.5 truncate">
                  {plant.species || 'Specie non indicata'}
                </p>
                {plant.location && (
                  <div className="mt-1 flex items-center gap-2 text-gray-700 min-w-0">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate">{plant.location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Spinner upload */}
            {uploadingImg && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
                <div className="rounded-full h-12 w-12 border-2 border-white border-t-transparent animate-spin" />
              </div>
            )}
          </div>

          {/* Toolbar sotto immagine */}
          <div className="px-4 sm:px-6 py-2 border-t border-gray-100 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileSelected}
              />

              <button
                onClick={onClickChangePhoto}
                disabled={uploadingImg}
                className={`inline-flex items-center gap-1.5 text-xs text-gray-700
                            px-2 py-1 rounded-md border border-gray-200
                            hover:bg-gray-50 transition-colors ${btnDisabledClass}`}
                title="Cambia foto"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>{uploadingImg ? 'Caricamento…' : 'Cambia'}</span>
              </button>

              {plant.imageUrl && (
                <button
                  onClick={onRemovePhoto}
                  disabled={uploadingImg}
                  className={`inline-flex items-center gap-1.5 text-xs text-red-600
                              px-2 py-1 rounded-md border border-red-200
                              hover:bg-red-50 transition-colors ${btnDisabledClass}`}
                  title="Rimuovi foto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Rimuovi</span>
                </button>
              )}

              <button
                onClick={() => setModalOpen(true)}
                className="ml-auto inline-flex items-center gap-1.5 text-xs text-gray-700
                           px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-50"
                title="Modifica dettagli"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Modifica</span>
              </button>
            </div>
          </div>
        </div>

        {/*CONTENUTO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonna principale */}
          <div className="lg:col-span-2 space-y-8">
            {/* Stato e parametri */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Stato e Parametri</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Droplets className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Intervallo irrigazione</p>
                      <p className="font-semibold">{plant.wateringIntervalDays} giorni</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="text-sm text-gray-600">Ultima irrigazione</p>
                      <p className="font-semibold">{formatDate(plant.lastWateredAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Sun className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="text-sm text-gray-600">Esposizione</p>
                      <p className="font-semibold capitalize">{plant.sunlight}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Leaf className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Terreno</p>
                      <p className="font-semibold">{plant.soil || 'Non specificato'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interventi recenti */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Interventi Recenti</h2>

              {recentInterventions.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nessun intervento registrato</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentInterventions.map((it, index) => (
                    <div
                      key={it.id || it._id || index}
                      className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="flex-shrink-0">{getInterventionIcon(it.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2 min-w-0">
                            <h4 className="font-medium text-gray-900 capitalize truncate">
                              {it.type}
                            </h4>
                            {statusChip(it.status)}
                          </div>
                          <span className="text-sm text-gray-500 whitespace-nowrap">
                            {formatDateTime(getInterventionDate(it))}
                          </span>
                        </div>

                        {/* Dettagli rapidi */}
                        <div className="mt-1 text-xs text-gray-600 space-x-3">
                          {it.liters ? (
                            <span>
                              Litri: <b>{it.liters}</b>
                            </span>
                          ) : null}
                          {it.fertilizerType ? (
                            <span>
                              Concime: <b>{it.fertilizerType}</b>
                            </span>
                          ) : null}
                          {it.dose ? (
                            <span>
                              Dose: <b>{it.dose}</b>
                            </span>
                          ) : null}
                        </div>

                        {it.notes && (
                          <p className="text-sm text-gray-700 mt-1">{it.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Info generali */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Informazioni</h3>

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Data creazione</p>
                  <p className="font-semibold">{formatDate(plant.createdAt)}</p>
                </div>
                {/* ❌ RIMOSSO: Blocco 'Fase' */}
                {/* <div>
                  <p className="text-sm text-gray-600">Fase attuale</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStageColor(
                      plant.stage
                    )}`}
                  >
                    {plant.stage || 'Non specificato'}
                  </span>
                </div> */}
              </div>
            </div>

            {/* Azioni rapide */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Azioni Rapide</h3>

              <div className="space-y-3">
                <button
                  onClick={() => setShowIrrigModal(true)}
                  className="w-full flex items-center space-x-3 p-3 border border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <Droplets className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">
                    Registra Irrigazione
                  </span>
                </button>

                <button
                  onClick={() => setShowFertModal(true)}
                  className="w-full flex items-center space-x-3 p-3 border border-green-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors"
                >
                  <FlaskConical className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-medium text-gray-700">
                    Registra Concimazione
                  </span>
                </button>

                <button
                  onClick={() => setShowPlanModal(true)}
                  className="w-full flex items-center space-x-3 p-3 border border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors"
                >
                  <Calendar className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">
                    Pianifica Intervento
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Modifica Pianta */}
        <PlantFormModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          initialData={plant}
          onSubmit={handleFormSubmit}
        />

        {/* MODAL: Irrigazione  */}
        {showIrrigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="p-4 border-b">
                <h3 className="text-lg font-bold">Registra Irrigazione</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm mb-1">Litri</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={irrigForm.liters}
                    onChange={(e) =>
                      setIrrigForm({ ...irrigForm, liters: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Es. 1.5"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Data/ora (eseguito)</label>
                  <input
                    type="datetime-local"
                    value={irrigForm.executedAt}
                    onChange={(e) =>
                      setIrrigForm({ ...irrigForm, executedAt: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Note (opzionale)</label>
                  <textarea
                    rows={2}
                    value={irrigForm.notes}
                    onChange={(e) =>
                      setIrrigForm({ ...irrigForm, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
                    placeholder="Note sull'irrigazione..."
                  />
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-3">
                <button
                  onClick={() => setShowIrrigModal(false)}
                  className="px-4 py-2 border rounded-lg"
                >
                  Annulla
                </button>
                <button
                  onClick={handleAddIrrigation}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Salva
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Concimazione */}
        {showFertModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="p-4 border-b">
                <h3 className="text-lg font-bold">Concimazione</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Stato</label>
                    <select
                      value={fertForm.status}
                      onChange={(e) =>
                        setFertForm({ ...fertForm, status: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="done">Eseguita</option>
                      <option value="planned">Pianificata</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Tipo concime</label>
                    <input
                      type="text"
                      value={fertForm.fertilizerType}
                      onChange={(e) =>
                        setFertForm({
                          ...fertForm,
                          fertilizerType: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Es. NPK 20-20-20"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Dose</label>
                    <input
                      type="text"
                      value={fertForm.dose}
                      onChange={(e) =>
                        setFertForm({ ...fertForm, dose: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Es. 5ml/L"
                    />
                  </div>
                  {fertForm.status === 'done' ? (
                    <div>
                      <label className="block text-sm mb-1">Eseguita alle</label>
                      <input
                        type="datetime-local"
                        value={fertForm.executedAt}
                        onChange={(e) =>
                          setFertForm({ ...fertForm, executedAt: e.target.value })
                        }
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm mb-1">Pianificata per</label>
                      <input
                        type="datetime-local"
                        value={fertForm.plannedAt}
                        onChange={(e) =>
                          setFertForm({ ...fertForm, plannedAt: e.target.value })
                        }
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm mb-1">Note (opzionale)</label>
                  <textarea
                    rows={2}
                    value={fertForm.notes}
                    onChange={(e) =>
                      setFertForm({ ...fertForm, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
                    placeholder="Note sulla concimazione..."
                  />
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-3">
                <button
                  onClick={() => setShowFertModal(false)}
                  className="px-4 py-2 border rounded-lg"
                >
                  Annulla
                </button>
                <button
                  onClick={handleAddFertilization}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Salva
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Pianifica Intervento  */}
        {showPlanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="p-4 border-b">
                <h3 className="text-lg font-bold">Pianifica Intervento</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Tipo</label>
                    <select
                      value={planForm.type}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, type: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="irrigazione">Irrigazione</option>
                      <option value="concimazione">Concimazione</option>
                      <option value="potatura">Potatura</option>
                      <option value="altro">Altro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Data/ora</label>
                    <input
                      type="datetime-local"
                      value={planForm.plannedAt}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, plannedAt: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1">Note (opzionale)</label>
                  <textarea
                    rows={2}
                    value={planForm.notes}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
                    placeholder="Dettagli dell'intervento..."
                  />
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-3">
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 border rounded-lg"
                >
                  Annulla
                </button>
                <button
                  onClick={handlePlanIntervention}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Pianifica
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlantDetail;