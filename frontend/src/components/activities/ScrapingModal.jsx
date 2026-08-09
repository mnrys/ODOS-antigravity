import React, { useState, useEffect } from 'react';
import { Globe, RefreshCw, CheckCircle2, AlertCircle, Sparkles, X, ChevronRight } from 'lucide-react';

/**
 * Modal de déclenchement du Scraping automatique externe.
 * Conforme à PRD_ecran1_creation.md (US-2), docs/PLAN.md (Phase 4) et docs/DESIGN.md.
 */
export default function ScrapingModal({ tripId = 1, isOpen, onClose, onScrapingComplete, onOpenFocusMode }) {
  const [destinations, setDestinations] = useState([]);
  const [selectedDestinationId, setSelectedDestinationId] = useState('');
  const [selectedSource, setSelectedSource] = useState('getyourguide');
  const [targetUrl, setTargetUrl] = useState('');
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Chargement des destinations du voyage
  useEffect(() => {
    if (!isOpen) return;
    setResult(null);
    setError(null);

    async function fetchDestinations() {
      try {
        const res = await fetch(`/api/trips/${tripId}/destinations`);
        if (res.ok) {
          const data = await res.json();
          setDestinations(data);
          if (data.length > 0 && !selectedDestinationId) {
            setSelectedDestinationId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Erreur chargement destinations:", err);
      }
    }
    fetchDestinations();
  }, [isOpen, tripId]);

  if (!isOpen) return null;

  const handleLaunchScraping = async (e) => {
    e.preventDefault();
    if (!selectedDestinationId) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/ai/suggest-destination', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          destination_id: parseInt(selectedDestinationId, 10),
          source: selectedSource,
          limit: parseInt(limit, 10) || 50,
          target_url: targetUrl.trim() || null
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Erreur lors du scraping");
      }

      const data = await res.json();
      setResult(data);
      if (onScrapingComplete) {
        onScrapingComplete(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#17181A]/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E3E1DC] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-[#E3E1DC] flex items-center justify-between bg-[#F8F7F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E8F2EC] flex items-center justify-center text-[#3F7A55]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#17181A]">Lancer un scraping automatique</h2>
              <p className="text-xs text-[#8E8F92]">Alimentation automatique de la pile "À valider"</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8E8F92] hover:text-[#17181A] hover:bg-[#E3E1DC]/40 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!result ? (
            <form onSubmit={handleLaunchScraping} className="space-y-4">
              {/* Choix de la source */}
              <div>
                <label className="block text-xs font-semibold text-[#5A5B5E] mb-1.5 uppercase tracking-wider">
                  Source de données (V1)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSource('getyourguide')}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition-all ${
                      selectedSource === 'getyourguide'
                        ? 'border-[#3F7A55] bg-[#E8F2EC]/40 text-[#254A33] shadow-sm ring-1 ring-[#3F7A55]'
                        : 'border-[#E3E1DC] bg-white text-[#5A5B5E] hover:border-[#8E8F92]'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-[#E65C00] shrink-0" />
                    <div className="text-left">
                      <span className="font-semibold block">GetYourGuide</span>
                      <span className="text-[10px] text-[#8E8F92] block">Visites & Excursions</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSource('tripadvisor')}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition-all ${
                      selectedSource === 'tripadvisor'
                        ? 'border-[#3F7A55] bg-[#E8F2EC]/40 text-[#254A33] shadow-sm ring-1 ring-[#3F7A55]'
                        : 'border-[#E3E1DC] bg-white text-[#5A5B5E] hover:border-[#8E8F92]'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-[#00AF87] shrink-0" />
                    <div className="text-left">
                      <span className="font-semibold block">Site Web / TripAdvisor</span>
                      <span className="text-[10px] text-[#8E8F92] block">Avis, Blogs & Officiels</span>
                    </div>
                  </button>
                </div>

              </div>

              {/* Optionnel : URL spécifique */}
              <div>
                <label className="block text-xs font-semibold text-[#5A5B5E] mb-1.5 uppercase tracking-wider">
                  URL Spécifique (Optionnel)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={targetUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTargetUrl(val);
                    if (val.trim() !== '') {
                      if (val.toLowerCase().includes('getyourguide.')) {
                        setSelectedSource('getyourguide');
                      } else {
                        setSelectedSource('tripadvisor');
                      }
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E3E1DC] rounded-xl text-sm text-[#17181A] focus:outline-none focus:ring-2 focus:ring-[#3F7A55]"
                />
                <p className="text-[11px] text-[#8E8F92] mt-1.5">
                  Laissez vide pour une recherche automatique. Vous pouvez coller une page GetYourGuide spécifique ou un article de blog (ex: "Que faire à Tenerife").
                </p>
              </div>

              {/* Choix de la destination */}
              <div>
                <label className="block text-xs font-semibold text-[#5A5B5E] mb-1.5 uppercase tracking-wider">
                  Destination ciblée
                </label>
                <select
                  value={selectedDestinationId}
                  onChange={(e) => setSelectedDestinationId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E3E1DC] rounded-xl text-sm text-[#17181A] focus:outline-none focus:ring-2 focus:ring-[#3F7A55]"
                >
                  {destinations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nom} (Étape {d.ordre})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#8E8F92] mt-1.5">
                  Les fiches scrapées seront automatiquement rattachées à cette destination et insérées en attente de relecture.
                </p>
              </div>

              {/* Limite de fiches */}
              <div>
                <label className="block text-xs font-semibold text-[#5A5B5E] mb-1.5 uppercase tracking-wider">
                  Nombre maximum de fiches à scraper
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E3E1DC] rounded-xl text-sm text-[#17181A] focus:outline-none focus:ring-2 focus:ring-[#3F7A55]"
                />
              </div>

              {/* Règle d'or de déduplication */}
              <div className="p-3 bg-[#F1F0ED] rounded-xl text-xs text-[#5A5B5E] space-y-1">
                <p className="font-semibold text-[#17181A]">🛡️ Déduplication stricte & Plafond :</p>
                <p>• Plafonné à la limite définie (max 500) par exécution.</p>
                <p>• Les activités déjà connues ou déjà rejetées en corbeille sont automatiquement ignorées.</p>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-[#5A5B5E] hover:bg-[#F1F0ED] rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedDestinationId}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#3F7A55] hover:bg-[#254A33] disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md transition-all"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Scraping en cours...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Lancer le scraping</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-center py-2">
              {result.activities?.some(a => a.source === 'scraping_simule') && (
                <div className="p-3 mb-4 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl flex items-start gap-2 text-left">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Données de secours générées</span>
                    <span>La connexion à la source externe a échoué. Des fiches virtuelles de secours ont été ajoutées pour le test.</span>
                  </div>
                </div>
              )}

              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                result.nombre_ajoutees > 0
                  ? 'bg-[#E8F2EC] text-[#3F7A55]'
                  : result.nombre_doublons_ignores > 0
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-amber-50 text-amber-600'
              }`}>
                {result.nombre_ajoutees > 0 ? (
                  <CheckCircle2 className="w-7 h-7" />
                ) : result.nombre_doublons_ignores > 0 ? (
                  <CheckCircle2 className="w-7 h-7" />
                ) : (
                  <AlertCircle className="w-7 h-7" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-[#17181A]">
                  {result.nombre_ajoutees > 0
                    ? 'Scraping terminé avec succès'
                    : result.nombre_doublons_ignores > 0
                    ? 'Activités déjà synchronisées'
                    : 'Aucun résultat trouvé'}
                </h3>
                <p className="text-sm text-[#5A5B5E] mt-1 max-w-sm mx-auto">{result.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className={`p-3 rounded-xl border ${
                  result.nombre_ajoutees > 0
                    ? 'bg-[#E8F2EC]/60 border-[#3F7A55]/20'
                    : 'bg-[#F1F0ED] border-[#E3E1DC]'
                }`}>
                  <div className={`text-xl font-bold ${
                    result.nombre_ajoutees > 0 ? 'text-[#254A33]' : 'text-[#8E8F92]'
                  }`}>{result.nombre_ajoutees}</div>
                  <div className="text-xs text-[#5A5B5E]">Nouvelles fiches ajoutées</div>
                </div>
                <div className="p-3 bg-[#F1F0ED] border border-[#E3E1DC] rounded-xl">
                  <div className="text-xl font-bold text-[#5A5B5E]">{result.nombre_doublons_ignores}</div>
                  <div className="text-xs text-[#8E8F92]">Doublons / corbeille évités</div>
                </div>
              </div>


              <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-[#5A5B5E] hover:bg-[#F1F0ED] rounded-xl transition-colors"
                >
                  Fermer
                </button>
                {result.nombre_ajoutees > 0 && onOpenFocusMode && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenFocusMode();
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-[#D6F84C] hover:bg-[#C2E438] text-[#17181A] font-bold text-sm rounded-xl shadow-md transition-all"
                  >
                    <span>Lancer le Mode Focus ({result.nombre_ajoutees})</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
