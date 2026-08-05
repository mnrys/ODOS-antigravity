/**
 * Client d'API HTTP pour l'application ODOS.
 * Centralise les appels vers le backend FastAPI.
 */

const API_BASE_URL = '/api';

export async function fetchTrips() {
  const response = await fetch(`${API_BASE_URL}/trips`);
  if (!response.ok) {
    throw new Error("Impossible de récupérer la liste des voyages.");
  }
  return response.json();
}

export async function fetchTripDashboard(tripId = 1) {
  const response = await fetch(`${API_BASE_URL}/trips/${tripId}/dashboard`);
  if (!response.ok) {
    throw new Error(`Erreur lors du chargement du Dashboard du voyage #${tripId}`);
  }
  return response.json();
}

export async function updateTrip(tripId, data) {
  const response = await fetch(`${API_BASE_URL}/trips/${tripId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(formatApiError(err, "Erreur lors de la mise à jour du voyage"));
  }
  return response.json();
}

/**
 * Traduit et formate les erreurs API (FastAPI / Pydantic) en français clair.
 * Évite d'afficher [object Object] à l'utilisateur.
 */
export function formatApiError(errData, defaultMsg = "Une erreur est survenue") {
  if (!errData) return defaultMsg;
  if (typeof errData === 'string') return errData;
  if (typeof errData.detail === 'string') return errData.detail;
  if (Array.isArray(errData.detail)) {
    return errData.detail
      .map((item) => {
        const field = item.loc ? item.loc[item.loc.length - 1] : '';
        const msg = item.msg || '';
        return field ? `Champ '${field}' : ${msg}` : msg;
      })
      .filter(Boolean)
      .join(' · ');
  }
  if (errData.message && typeof errData.message === 'string') return errData.message;
  return defaultMsg;
}

