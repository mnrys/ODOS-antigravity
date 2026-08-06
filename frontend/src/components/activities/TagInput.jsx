/**
 * Composant de saisie de tags multiples avec autocomplétion et pastilles amovibles.
 * Conforme à SCHEMA_BASE_DE_DONNEES.md (section 5) et docs/DESIGN.md.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Tag, X, Plus } from 'lucide-react';

export default function TagInput({ tripId, selectedTags = [], onChange }) {
  const [inputValue, setInputValue] = useState('');
  const [allTripTags, setAllTripTags] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Normalisation des tags sélectionnés pour toujours manipuler des objets { id, nom }
  const normalizedSelectedTags = (Array.isArray(selectedTags) ? selectedTags : []).map((t, idx) => {
    if (typeof t === 'string') return { id: `tag-str-${idx}-${t}`, nom: t };
    if (t && typeof t === 'object') return { id: t.id || `tag-${idx}`, nom: t.nom || '' };
    return { id: `tag-${idx}`, nom: String(t || '') };
  }).filter((t) => Boolean(t.nom));

  // Chargement des tags existants du voyage pour l'autocomplétion
  useEffect(() => {
    if (!tripId) return;
    fetch(`/api/trips/${tripId}/tags`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAllTripTags(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Erreur de chargement des tags:", err));
  }, [tripId]);

  // Fermeture du menu si on clique en dehors
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = async (tagName) => {
    const trimmed = (tagName || '').trim();
    if (!trimmed) return;

    // Vérifie si déjà sélectionné
    if (normalizedSelectedTags.some((t) => (t.nom || '').toLowerCase() === trimmed.toLowerCase())) {
      setInputValue('');
      setIsDropdownOpen(false);
      return;
    }

    // Cherche si le tag existe déjà dans le voyage
    let tagObj = allTripTags.find((t) => (t.nom || '').toLowerCase() === trimmed.toLowerCase());

    if (!tagObj) {
      // Création du nouveau tag côté backend
      try {
        const res = await fetch(`/api/trips/${tripId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nom: trimmed }),
        });
        if (res.ok) {
          tagObj = await res.json();
          setAllTripTags((prev) => [...prev, tagObj]);
        } else {
          tagObj = { id: Date.now(), trip_id: tripId, nom: trimmed };
        }
      } catch (err) {
        tagObj = { id: Date.now(), trip_id: tripId, nom: trimmed };
      }
    }

    if (onChange) {
      onChange([...normalizedSelectedTags, tagObj]);
    }
    setInputValue('');
    setIsDropdownOpen(false);
  };

  const handleRemoveTag = (tagIdToRemove) => {
    if (onChange) {
      onChange(normalizedSelectedTags.filter((t) => t.id !== tagIdToRemove));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(inputValue);
    }
  };

  // Suggestions filtrées
  const filteredSuggestions = allTripTags.filter(
    (t) =>
      t?.nom &&
      t.nom.toLowerCase().includes(inputValue.toLowerCase()) &&
      !normalizedSelectedTags.some((st) => st.id === t.id || st.nom.toLowerCase() === t.nom.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Zone des pastilles sélectionnées + champ de saisie */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 min-h-[44px] bg-[#F7F6F3] rounded-[12px] border border-transparent focus-within:border-[#17181A] focus-within:ring-2 focus-within:ring-[#D6F84C]/60 transition-all">
        {normalizedSelectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#EDEBE6] hover:bg-[#E6E4DF] text-[#17181A] text-[13px] font-medium rounded-full transition-colors"
          >
            <Tag size={12} className="text-[#55565A]" />
            <span>{tag.nom}</span>
            <button
              type="button"
              onClick={() => handleRemoveTag(tag.id)}
              className="p-0.5 hover:text-[#B4472F] text-[#8E8F92] transition-colors rounded-full"
              title="Retirer ce tag"
            >
              <X size={12} />
            </button>
          </span>
        ))}

        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsDropdownOpen(true);
          }}
          onFocus={() => setIsDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? "Ajouter des tags (ex: Rando, Baignade, Vue mer)..." : "+ Ajouter..."}
          className="flex-1 min-w-[140px] bg-transparent border-none outline-none text-[13px] text-[#17181A] placeholder-[#8E8F92] py-1 px-1 font-sans"
        />
      </div>

      {/* Menu déroulant des suggestions autocomplétées */}
      {isDropdownOpen && (inputValue.trim() || filteredSuggestions.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1.5 max-h-48 overflow-y-auto bg-white rounded-[14px] border border-[#E6E4DF] shadow-lg z-50 p-1.5">
          {filteredSuggestions.map((sug) => (
            <button
              key={sug.id}
              type="button"
              onClick={() => handleAddTag(sug.nom)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-[13px] text-[#17181A] hover:bg-[#F7F6F3] rounded-[8px] transition-colors"
            >
              <span className="flex items-center gap-2">
                <Tag size={13} className="text-[#55565A]" />
                {sug.nom}
              </span>
              <span className="text-[11px] text-[#8E8F92]">existant</span>
            </button>
          ))}

          {inputValue.trim() && !allTripTags.some((t) => t.nom.toLowerCase() === inputValue.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => handleAddTag(inputValue)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-[#17181A] bg-[#D6F84C]/20 hover:bg-[#D6F84C]/40 rounded-[8px] transition-colors mt-1"
            >
              <Plus size={14} className="text-[#17181A]" />
              <span>Créer le tag « <strong>{inputValue.trim()}</strong> »</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
