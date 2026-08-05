import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  Layers, RotateCcw, Trash2, MapPin, Sparkles, Plus,
  Maximize2, ZoomIn, ZoomOut, CheckCircle2, AlertCircle,
  Bookmark, ChevronDown, Check, Compass, DollarSign, Star,
  X, ExternalLink, Focus, Tag, Eye
} from 'lucide-react';

import ActivityCardNode from '../components/workshop/ActivityCardNode';
import PileHeaderNode from '../components/workshop/PileHeaderNode';
import WorkshopTrashDrawer from '../components/workshop/WorkshopTrashDrawer';
import ActivityFormModal from '../components/activities/ActivityFormModal';
import ActivityDetailDrawer from '../components/activities/ActivityDetailDrawer';
import PlanningSidebarDrawer from '../components/workshop/PlanningSidebarDrawer';

const nodeTypes = {
  activityCard: ActivityCardNode,
  pileHeader: PileHeaderNode
};

/**
 * Écran 2 : Atelier — Canvas interactif libre, piles par catégorie/zone/prix/note/tags et persistance des dispositions nommées.
 * Conforme à PRD_ecran2_atelier.md (US-1, US-2, US-7, US-8, US-9, US-10, US-11),
 * docs/PLAN.md (Phase 5) et docs/DESIGN.md.
 */
function AtelierCanvas({ tripId = 1, initialDestinationId = null, onNavigateTab }) {
  const [destinations, setDestinations] = useState([]);
  const [activeDestinationId, setActiveDestinationId] = useState(initialDestinationId);
  const [categories, setCategories] = useState([]);
  const [rawActivities, setRawActivities] = useState([]);
  const [tripInfo, setTripInfo] = useState({ nb_personnes: 4 });
  const [layoutNom, setLayoutNom] = useState("Disposition initiale");
  const [savedLayouts, setSavedLayouts] = useState([]);
  const [activeActivityId, setActiveActivityId] = useState(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isPlanningDrawerOpen, setIsPlanningDrawerOpen] = useState(false);
  const [trashCount, setTrashCount] = useState(0);
  const [selectedActivityToEdit, setSelectedActivityToEdit] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [detailActivity, setDetailActivity] = useState(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Menus déroulants
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const [isOrganizeMenuOpen, setIsOrganizeMenuOpen] = useState(false);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState(null);
  const [isSaveLayoutModalOpen, setIsSaveLayoutModalOpen] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState("");

  const saveTimerRef = useRef(null);
  const { setCenter } = useReactFlow();

  // Liste de tous les tags existants sur les fiches de la destination
  const availableTags = useMemo(() => {
    const tagMap = new Map();
    (rawActivities || []).forEach((act) => {
      (act.tags || []).forEach((t) => {
        if (t && t.nom && !tagMap.has(t.nom)) {
          tagMap.set(t.nom, t);
        }
      });
    });
    return Array.from(tagMap.values());
  }, [rawActivities]);

  // Activité active trouvée dans les données brutes
  const activeActivity = useMemo(
    () => rawActivities.find((a) => a.id === activeActivityId),
    [rawActivities, activeActivityId]
  );

  // Synchronisation de l'état actif dans les nœuds du canvas
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type === 'activityCard') {
          const actId = parseInt(n.id.replace('activity-', ''), 10);
          const isNowActive = actId === activeActivityId;
          if (n.data.isActive !== isNowActive) {
            return {
              ...n,
              data: {
                ...n.data,
                isActive: isNowActive
              }
            };
          }
        }
        return n;
      })
    );
  }, [activeActivityId, setNodes]);

  const handleSelectActivity = useCallback((activityId) => {
    setActiveActivityId(activityId);
  }, []);

  // 1. Chargement des destinations du voyage
  useEffect(() => {
    async function fetchTripDestinations() {
      try {
        const [destRes, dashRes] = await Promise.all([
          fetch(`/api/trips/${tripId}/destinations`),
          fetch(`/api/trips/${tripId}/dashboard`)
        ]);

        if (destRes.ok) {
          const dests = await destRes.json();
          setDestinations(dests);
          if (!activeDestinationId && dests.length > 0) {
            setActiveDestinationId(dests[0].id);
          }
        }
        if (dashRes.ok) {
          const dash = await dashRes.json();
          setTripInfo({ nb_personnes: dash.nb_personnes || 4 });
        }
      } catch (err) {
        console.error("Erreur chargement destinations:", err);
      }
    }
    fetchTripDestinations();
  }, [tripId, activeDestinationId]);

  // 2. Gestion de l'édition et de la prévisualisation de carte (US-9 & consultation)
  const handleOpenEdit = useCallback((activityData) => {
    setActiveActivityId(activityData.id);
    setSelectedActivityToEdit(activityData);
    setIsEditModalOpen(true);
  }, []);

  const handlePreviewActivity = useCallback((activityData) => {
    setActiveActivityId(activityData.id);
    setDetailActivity(activityData);
    setIsDetailDrawerOpen(true);
  }, []);

  // Centrer la caméra sur la carte active
  const handleCenterOnActive = useCallback(() => {
    if (!activeActivityId) return;
    const node = nodes.find((n) => n.id === `activity-${activeActivityId}`);
    if (node) {
      setCenter(node.position.x + 145, node.position.y + 100, { zoom: 1, duration: 600 });
    }
  }, [activeActivityId, nodes, setCenter]);

  // 3. Gestion de la mise en corbeille d'atelier (US-8)
  const handleMoveToTrash = useCallback(async (activityId) => {
    try {
      const res = await fetch(`/api/activities/${activityId}/workshop-trash`, {
        method: 'POST'
      });
      if (res.ok) {
        // Retrait immédiat du nœud sur le canvas
        setNodes((prevNodes) => prevNodes.filter((n) => n.id !== `activity-${activityId}`));
        setRawActivities((prev) => prev.filter((a) => a.id !== activityId));
        if (activeActivityId === activityId) setActiveActivityId(null);
        if (detailActivity?.id === activityId) setIsDetailDrawerOpen(false);
        setTrashCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error("Erreur mise en corbeille atelier:", err);
    }
  }, [setNodes, activeActivityId, detailActivity]);

  // 4. Chargement des dispositions enregistrées
  const fetchLayouts = useCallback(async () => {
    if (!activeDestinationId) return;
    try {
      const res = await fetch(`/api/destinations/${activeDestinationId}/layouts`);
      if (res.ok) {
        const layouts = await res.json();
        setSavedLayouts(layouts);
      }
    } catch (err) {
      console.error("Erreur chargement dispositions:", err);
    }
  }, [activeDestinationId]);

  // 5. Chargement des données de l'atelier pour la destination active
  const loadWorkshopData = useCallback(async () => {
    if (!activeDestinationId) return;

    try {
      const [wRes, tRes] = await Promise.all([
        fetch(`/api/destinations/${activeDestinationId}/workshop`),
        fetch(`/api/destinations/${activeDestinationId}/workshop-trash`)
      ]);

      if (!wRes.ok) return;

      const wData = await wRes.json();
      setCategories(wData.categories || []);
      setRawActivities(wData.activities || []);
      setLayoutNom(wData.disposition_nom || "Disposition initiale");

      if (tRes.ok) {
        const tData = await tRes.json();
        setTrashCount(tData.length);
      }

      fetchLayouts();

      // Construction des nœuds React Flow
      const flowNodes = [];

      // A. Nœuds d'en-tête de piles par catégorie (US-2)
      const catCountMap = {};
      wData.activities.forEach((act) => {
        const catId = act.categorie_id || 'uncat';
        catCountMap[catId] = (catCountMap[catId] || 0) + 1;
      });

      const colHeaderPositions = {};
      wData.activities.forEach((act) => {
        const catId = act.categorie_id || 'uncat';
        if (!colHeaderPositions[catId] || act.x < colHeaderPositions[catId].x) {
          colHeaderPositions[catId] = {
            x: act.x,
            y: Math.max(20, act.y - 65)
          };
        }
      });

      // En-têtes pour les catégories ayant des fiches
      (wData.categories || []).forEach((cat) => {
        const count = catCountMap[cat.id] || 0;
        if (count > 0 && colHeaderPositions[cat.id]) {
          flowNodes.push({
            id: `header-cat-${cat.id}`,
            type: 'pileHeader',
            position: { x: colHeaderPositions[cat.id].x, y: 20 },
            draggable: false,
            selectable: false,
            data: {
              label: cat.nom,
              count: count,
              color: cat.couleur,
              isAiSuggestions: false
            }
          });
        }
      });

      // En-tête "Suggestions IA" (visible et vide en V1, Décisions PRD)
      const lastX = Math.max(...wData.activities.map(a => a.x), 80);
      flowNodes.push({
        id: 'header-ai-suggestions',
        type: 'pileHeader',
        position: { x: lastX + 340, y: 20 },
        draggable: false,
        selectable: false,
        data: {
          label: 'Suggestions IA (Phase 2)',
          count: 0,
          color: '#D6F84C',
          isAiSuggestions: true
        }
      });

      // B. Nœuds de fiches d'activités
      wData.activities.forEach((act) => {
        flowNodes.push({
          id: `activity-${act.id}`,
          type: 'activityCard',
          position: { x: act.x, y: act.y },
          zIndex: act.z_index || 1,
          data: {
            ...act,
            isActive: act.id === activeActivityId,
            onSelect: handleSelectActivity,
            onPreview: handlePreviewActivity,
            onEdit: handleOpenEdit,
            onTrash: handleMoveToTrash
          }
        });
      });

      setNodes(flowNodes);
    } catch (err) {
      console.error("Erreur chargement données atelier:", err);
    }
  }, [activeDestinationId, activeActivityId, handleSelectActivity, handlePreviewActivity, handleOpenEdit, handleMoveToTrash, setNodes, fetchLayouts]);

  useEffect(() => {
    loadWorkshopData();
  }, [loadWorkshopData]);

  // 6. Sauvegarde automatique throttlée/debouncée des positions (US-1, US-6)
  const triggerAutoSave = useCallback((currentNodes) => {
    if (!activeDestinationId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      const disposition = {};

      currentNodes.forEach((node) => {
        if (node.type === 'activityCard') {
          const actId = node.id.replace('activity-', '');
          disposition[actId] = {
            x: node.position.x,
            y: node.position.y,
            z_index: node.zIndex || 1
          };
        }
      });

      try {
        await fetch(`/api/destinations/${activeDestinationId}/layout`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nom: layoutNom || "En cours",
            disposition: disposition
          })
        });
      } catch (err) {
        console.error("Erreur sauvegarde disposition:", err);
      } finally {
        setIsSaving(false);
      }
    }, 600);
  }, [activeDestinationId, layoutNom]);

  // 7. Placement direct d'une activité sur un créneau précis
  const handlePlaceActivityOnSlot = useCallback(async (activityObj, targetDay, startHourMinutes) => {
    if (!activityObj || !tripId) return;
    const actId = activityObj.id || activityObj.activity_id;
    const duration = activityObj.duree_min || 60;
    const roundedDuration = Math.ceil(duration / 15) * 15;

    try {
      const res = await fetch(`/api/trips/${tripId}/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_id: actId,
          jour: targetDay,
          heure_debut: startHourMinutes,
          heure_fin: startHourMinutes + roundedDuration
        })
      });

      if (res.ok) {
        loadWorkshopData();
        setActiveActivityId(null);
      }
    } catch (err) {
      console.error("Erreur placement activité dans le planning:", err);
    }
  }, [tripId, loadWorkshopData]);

  // Détection du glissement d'une carte vers la bordure droite pour ouvrir automatiquement le planning (US-15)
  const handleNodeDrag = useCallback((event, node) => {
    if (event && event.clientX && event.clientX >= window.innerWidth - 380) {
      setIsPlanningDrawerOpen((prev) => {
        if (!prev) return true;
        return prev;
      });
    }
  }, []);

  // Callback quand un nœud est relâché après déplacement
  const handleNodeDragStop = useCallback((event, node) => {
    if (node.type === 'activityCard' && event) {
      const clientX = event.clientX;
      const clientY = event.clientY;

      if (clientX && clientY) {
        const dropTarget = document.elementFromPoint(clientX, clientY)?.closest('[data-slot-droptarget="true"]');
        if (dropTarget) {
          const targetDay = parseInt(dropTarget.dataset.day, 10);
          const targetHour = parseInt(dropTarget.dataset.hour, 10);
          const actId = parseInt(node.id.replace('activity-', ''), 10);
          const actObj = rawActivities.find((a) => a.id === actId);

          if (actObj && !isNaN(targetDay) && !isNaN(targetHour)) {
            handlePlaceActivityOnSlot(actObj, targetDay, targetHour);
            return;
          }
        }
      }
    }

    setNodes((nds) => {
      triggerAutoSave(nds);
      return nds;
    });
  }, [rawActivities, handlePlaceActivityOnSlot, triggerAutoSave, setNodes]);

  // 8. Application du groupement et positionnement en colonnes fluides
  const applyGroupingLayout = useCallback((groups, groupMeta) => {
    const colWidth = 340;
    const rowHeight = 160;
    const startX = 80;
    const startY = 100;

    let colIndex = 0;
    const newFlowNodes = [];

    Object.keys(groups).forEach((key) => {
      const acts = groups[key];
      if (!acts || acts.length === 0) return;

      const colX = startX + (colIndex * colWidth);

      // En-tête de colonne
      newFlowNodes.push({
        id: `header-group-${key}`,
        type: 'pileHeader',
        position: { x: colX, y: 20 },
        draggable: false,
        selectable: false,
        data: {
          label: groupMeta[key]?.label || key,
          count: acts.length,
          color: groupMeta[key]?.color || '#8E8F92',
          isAiSuggestions: false
        }
      });

      // Cartes dans la colonne
      acts.forEach((act, rowIdx) => {
        newFlowNodes.push({
          id: `activity-${act.id}`,
          type: 'activityCard',
          position: { x: colX, y: startY + (rowIdx * rowHeight) },
          zIndex: rowIdx + 1,
          data: {
            ...act,
            isActive: act.id === activeActivityId,
            onSelect: handleSelectActivity,
            onPreview: handlePreviewActivity,
            onEdit: handleOpenEdit,
            onTrash: handleMoveToTrash
          }
        });
      });

      colIndex++;
    });

    setNodes(newFlowNodes);
    triggerAutoSave(newFlowNodes);
  }, [activeActivityId, handleSelectActivity, handlePreviewActivity, handleOpenEdit, handleMoveToTrash, setNodes, triggerAutoSave]);

  const organizeCardsBy = useCallback((criteria) => {
    if (!rawActivities || rawActivities.length === 0) return;

    setIsOrganizeMenuOpen(false);
    setIsTagMenuOpen(false);
    setSelectedTagFilter(null);

    const groups = {};
    const groupMeta = {};

    if (criteria === 'category') {
      categories.forEach(c => {
        groups[c.id] = [];
        groupMeta[c.id] = { label: c.nom, color: c.couleur };
      });
      groups['uncat'] = [];
      groupMeta['uncat'] = { label: "Sans catégorie", color: "#8E8F92" };

      rawActivities.forEach(act => {
        const k = act.categorie_id || 'uncat';
        if (groups[k]) groups[k].push(act);
        else groups['uncat'].push(act);
      });
    } else if (criteria === 'zone') {
      const zones = ['nord', 'sud', 'est', 'ouest', 'non_definie'];
      const zoneLabels = { nord: 'Nord 🧭', sud: 'Sud 🧭', est: 'Est 🧭', ouest: 'Ouest 🧭', non_definie: 'Zone non précisée' };
      const zoneColors = { nord: '#395E8C', sud: '#B4472F', est: '#3F7A55', ouest: '#B9862F', non_definie: '#8E8F92' };

      zones.forEach(z => {
        groups[z] = [];
        groupMeta[z] = { label: zoneLabels[z], color: zoneColors[z] };
      });

      rawActivities.forEach(act => {
        const z = (act.zone_geo || 'non_definie').toLowerCase();
        if (groups[z]) groups[z].push(act);
        else groups['non_definie'].push(act);
      });
    } else if (criteria === 'price') {
      const tiers = ['free', 'tier1', 'tier2', 'tier3'];
      const tierLabels = { free: 'Gratuit (0 €)', tier1: 'Économique (< 20 €)', tier2: 'Intermédiaire (20 - 50 €)', tier3: 'Supérieur (> 50 €)' };
      const tierColors = { free: '#3F7A55', tier1: '#395E8C', tier2: '#B9862F', tier3: '#B4472F' };

      tiers.forEach(t => {
        groups[t] = [];
        groupMeta[t] = { label: tierLabels[t], color: tierColors[t] };
      });

      rawActivities.forEach(act => {
        const cost = act.cout_par_personne || 0;
        if (cost === 0) groups['free'].push(act);
        else if (cost < 20) groups['tier1'].push(act);
        else if (cost <= 50) groups['tier2'].push(act);
        else groups['tier3'].push(act);
      });
    } else if (criteria === 'rating') {
      const ratings = [5, 4, 3, 0];
      const ratingLabels = { 5: '★★★★★ Coup de cœur', 4: '★★★★ Très intéressant', 3: '★★★ À voir', 0: 'Non noté / Autres' };
      const ratingColors = { 5: '#D6F84C', 4: '#3F7A55', 3: '#395E8C', 0: '#8E8F92' };

      ratings.forEach(r => {
        groups[r] = [];
        groupMeta[r] = { label: ratingLabels[r], color: ratingColors[r] };
      });

      rawActivities.forEach(act => {
        const r = act.note_interet || 0;
        if (groups[r]) groups[r].push(act);
        else groups[0].push(act);
      });
    } else if (criteria === 'tag') {
      const tagColors = ['#3F7A55', '#395E8C', '#B9862F', '#B4472F', '#7E57C2', '#00897B', '#D81B60'];
      let colorIdx = 0;

      rawActivities.forEach(act => {
        if (act.tags && act.tags.length > 0) {
          act.tags.forEach(t => {
            const tagKey = `tag-${t.id || t.nom}`;
            if (!groups[tagKey]) {
              groups[tagKey] = [];
              groupMeta[tagKey] = {
                label: `#${t.nom}`,
                color: tagColors[colorIdx % tagColors.length]
              };
              colorIdx++;
            }
          });
        }
      });

      groups['no_tag'] = [];
      groupMeta['no_tag'] = { label: "Sans tag associé", color: "#8E8F92" };

      rawActivities.forEach(act => {
        if (act.tags && act.tags.length > 0) {
          const mainTag = act.tags[0];
          const tagKey = `tag-${mainTag.id || mainTag.nom}`;
          if (groups[tagKey]) {
            groups[tagKey].push(act);
          }
        } else {
          groups['no_tag'].push(act);
        }
      });
    }

    applyGroupingLayout(groups, groupMeta);
  }, [rawActivities, categories, applyGroupingLayout]);

  // Filtrage / Regroupement par tag spécifique sélectionné dans la liste déroulante
  const filterBySpecificTag = useCallback((tagName) => {
    setIsTagMenuOpen(false);
    setIsOrganizeMenuOpen(false);
    setSelectedTagFilter(tagName);

    if (!tagName) {
      organizeCardsBy('category');
      return;
    }

    const matching = [];
    const others = [];

    rawActivities.forEach((act) => {
      const hasTag = (act.tags || []).some((t) => (t.nom || '').toLowerCase() === tagName.toLowerCase());
      if (hasTag) matching.push(act);
      else others.push(act);
    });

    const groups = {
      tag_match: matching,
      tag_others: others
    };
    const groupMeta = {
      tag_match: { label: `#${tagName} (${matching.length})`, color: '#7E57C2' },
      tag_others: { label: `Autres fiches (${others.length})`, color: '#8E8F92' }
    };

    applyGroupingLayout(groups, groupMeta);
  }, [rawActivities, organizeCardsBy, applyGroupingLayout]);

  // 9. Création d'une nouvelle disposition nommée
  const handleSaveNamedLayout = async () => {
    if (!newLayoutName.trim() || !activeDestinationId) return;

    const disposition = {};
    nodes.forEach((node) => {
      if (node.type === 'activityCard') {
        const actId = node.id.replace('activity-', '');
        disposition[actId] = {
          x: node.position.x,
          y: node.position.y,
          z_index: node.zIndex || 1
        };
      }
    });

    try {
      const res = await fetch(`/api/destinations/${activeDestinationId}/layouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: newLayoutName.trim(),
          disposition: disposition
        })
      });

      if (res.ok) {
        const saved = await res.json();
        setLayoutNom(saved.nom);
        setIsSaveLayoutModalOpen(false);
        setNewLayoutName("");
        fetchLayouts();
      }
    } catch (err) {
      console.error("Erreur enregistrement disposition nommée:", err);
    }
  };

  // 10. Activation d'une disposition existante
  const handleActivateLayout = async (layout) => {
    setIsLayoutMenuOpen(false);
    try {
      const res = await fetch(`/api/destinations/${activeDestinationId}/layouts/${layout.id}/activate`, {
        method: 'POST'
      });
      if (res.ok) {
        loadWorkshopData();
      }
    } catch (err) {
      console.error("Erreur activation disposition:", err);
    }
  };

  // 11. Suppression d'une disposition nommée
  const handleDeleteLayout = async (layoutId, e) => {
    e.stopPropagation();
    if (!window.confirm("Supprimer cette disposition enregistrée ?")) return;

    try {
      const res = await fetch(`/api/destinations/${activeDestinationId}/layouts/${layoutId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchLayouts();
      }
    } catch (err) {
      console.error("Erreur suppression disposition:", err);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] md:h-screen p-3 md:p-6 space-y-4">
      {/* 1. Barre d'outils supérieure de l'Atelier */}
      <div className="bg-white p-4 rounded-2xl border border-[#E3E1DC] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        {/* Onglets de destinations (US-11) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#8E8F92] mr-2">
            <MapPin size={14} className="text-[#3F7A55]" />
            <span>Destination :</span>
          </div>
          {destinations.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setActiveDestinationId(d.id);
                setActiveActivityId(null);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                activeDestinationId === d.id
                  ? 'bg-[#17181A] text-[#D6F84C] shadow-sm'
                  : 'bg-[#F8F7F5] text-[#5A5B5E] hover:bg-[#E3E1DC]/50'
              }`}
            >
              {d.nom} (Étape {d.ordre})
            </button>
          ))}
        </div>

        {/* Actions & Menus & Carte active */}
        <div className="flex items-center gap-2.5 flex-wrap md:flex-nowrap">
          {/* Badge Carte Active & Actions directes */}
          {activeActivity && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs shadow-xs animate-in fade-in">
              <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse shrink-0" />
              <span className="text-[#5A5B5E] hidden sm:inline">Active :</span>
              <span className="font-bold text-[#17181A] max-w-[130px] truncate" title={activeActivity.titre}>
                {activeActivity.titre}
              </span>
              <button
                type="button"
                onClick={() => handleOpenEdit(activeActivity)}
                className="px-2 py-0.5 bg-[#2563EB] hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] transition-colors"
                title="Ouvrir la fiche complète de l'activité"
              >
                Fiche
              </button>
              <button
                type="button"
                onClick={handleCenterOnActive}
                className="p-1 text-[#2563EB] hover:bg-blue-100 rounded-md transition-colors"
                title="Centrer l'affichage sur cette carte"
              >
                <Focus size={13} />
              </button>
              <button
                type="button"
                onClick={() => setActiveActivityId(null)}
                className="p-0.5 text-[#8E8F92] hover:text-[#17181A] rounded"
                title="Désélectionner"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Menu Dispositions Nommées */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsLayoutMenuOpen(!isLayoutMenuOpen);
                setIsOrganizeMenuOpen(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F8F7F5] hover:bg-[#EDEBE6] text-[#17181A] border border-[#E3E1DC] rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Bookmark size={13} className="text-[#3F7A55]" />
              <span className="max-w-[130px] truncate">{layoutNom}</span>
              <ChevronDown size={13} className="text-[#8E8F92]" />
            </button>

            {isLayoutMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-[#E3E1DC] shadow-xl z-50 py-2 overflow-hidden animate-in fade-in">
                <div className="px-3 py-1.5 text-[11px] font-bold text-[#8E8F92] uppercase tracking-wider border-b border-[#F0EFEB]">
                  Dispositions enregistrées
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {savedLayouts.map((lay) => (
                    <div
                      key={lay.id}
                      onClick={() => handleActivateLayout(lay)}
                      className="px-3 py-2 text-xs flex items-center justify-between hover:bg-[#F8F7F5] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {lay.est_courante === 1 ? (
                          <Check size={13} className="text-[#3F7A55] shrink-0" />
                        ) : (
                          <span className="w-3.5" />
                        )}
                        <span className={`truncate ${lay.est_courante === 1 ? 'font-bold text-[#17181A]' : 'text-[#5A5B5E]'}`}>
                          {lay.nom}
                        </span>
                      </div>
                      {!lay.est_initiale && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteLayout(lay.id, e)}
                          className="p-1 text-[#8E8F92] hover:text-[#B4472F] rounded-md transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="p-2 border-t border-[#F0EFEB]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLayoutMenuOpen(false);
                      setIsSaveLayoutModalOpen(true);
                    }}
                    className="w-full py-1.5 px-3 bg-[#D6F84C]/20 hover:bg-[#D6F84C]/40 text-[#17181A] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus size={13} />
                    <span>Enregistrer la disposition sous...</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Menu "Organiser par..." */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsOrganizeMenuOpen(!isOrganizeMenuOpen);
                setIsLayoutMenuOpen(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F8F7F5] text-[#5A5B5E] hover:text-[#17181A] border border-[#E3E1DC] rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Layers size={13} />
              <span>Organiser par</span>
              <ChevronDown size={13} className="text-[#8E8F92]" />
            </button>

            {isOrganizeMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-[#E3E1DC] shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in">
                <button
                  type="button"
                  onClick={() => organizeCardsBy('category')}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-[#17181A] hover:bg-[#F8F7F5] flex items-center gap-2"
                >
                  <Layers size={14} className="text-[#3F7A55]" />
                  <span>Par Catégorie (Piles standard)</span>
                </button>
                <button
                  type="button"
                  onClick={() => organizeCardsBy('tag')}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-[#17181A] hover:bg-[#F8F7F5] flex items-center gap-2"
                >
                  <Tag size={14} className="text-[#7E57C2]" />
                  <span>Par Tags thématiques</span>
                </button>
                <button
                  type="button"
                  onClick={() => organizeCardsBy('zone')}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-[#17181A] hover:bg-[#F8F7F5] flex items-center gap-2"
                >
                  <Compass size={14} className="text-[#395E8C]" />
                  <span>Par Zone géographique</span>
                </button>
                <button
                  type="button"
                  onClick={() => organizeCardsBy('price')}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-[#17181A] hover:bg-[#F8F7F5] flex items-center gap-2"
                >
                  <DollarSign size={14} className="text-[#B9862F]" />
                  <span>Par Fourchette de prix</span>
                </button>
                <button
                  type="button"
                  onClick={() => organizeCardsBy('rating')}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-[#17181A] hover:bg-[#F8F7F5] flex items-center gap-2"
                >
                  <Star size={14} className="text-[#17181A]" />
                  <span>Par Note d'intérêt</span>
                </button>
              </div>
            )}
          </div>

          {/* Menu déroulant des Tags existants */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsTagMenuOpen(!isTagMenuOpen);
                setIsOrganizeMenuOpen(false);
                setIsLayoutMenuOpen(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-colors border ${
                selectedTagFilter
                  ? 'bg-[#7E57C2]/15 text-[#7E57C2] border-[#7E57C2]/40'
                  : 'bg-white hover:bg-[#F8F7F5] text-[#5A5B5E] hover:text-[#17181A] border-[#E3E1DC]'
              }`}
            >
              <Tag size={13} className={selectedTagFilter ? 'text-[#7E57C2]' : 'text-[#8E8F92]'} />
              <span className="max-w-[120px] truncate">
                {selectedTagFilter ? `#${selectedTagFilter}` : `Tags (${availableTags.length})`}
              </span>
              <ChevronDown size={13} className="text-[#8E8F92]" />
            </button>

            {isTagMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-[#E3E1DC] shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in">
                <div className="px-3 py-1.5 text-[11px] font-bold text-[#8E8F92] uppercase tracking-wider border-b border-[#F0EFEB] flex items-center justify-between">
                  <span>Tags existants</span>
                  {selectedTagFilter && (
                    <button
                      type="button"
                      onClick={() => filterBySpecificTag(null)}
                      className="text-[10px] text-[#2563EB] hover:underline normal-case"
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto py-1">
                  <button
                    type="button"
                    onClick={() => organizeCardsBy('tag')}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-[#17181A] hover:bg-[#F8F7F5] flex items-center gap-2 border-b border-[#F0EFEB]"
                  >
                    <Layers size={13} className="text-[#7E57C2]" />
                    <span>Organiser par tous les tags</span>
                  </button>

                  {availableTags.length === 0 ? (
                    <div className="px-3 py-3 text-center text-xs text-[#8E8F92]">
                      Aucun tag sur les fiches de cette étape.
                    </div>
                  ) : (
                    availableTags.map((tag) => {
                      const count = rawActivities.filter((a) =>
                        (a.tags || []).some((t) => (t.nom || '').toLowerCase() === (tag.nom || '').toLowerCase())
                      ).length;

                      const isSelected = selectedTagFilter?.toLowerCase() === tag.nom.toLowerCase();

                      return (
                        <button
                          key={tag.id || tag.nom}
                          type="button"
                          onClick={() => filterBySpecificTag(tag.nom)}
                          className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-[#F8F7F5] transition-colors ${
                            isSelected ? 'bg-[#7E57C2]/10 font-bold text-[#7E57C2]' : 'text-[#17181A]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Tag size={12} className={isSelected ? 'text-[#7E57C2]' : 'text-[#8E8F92]'} />
                            <span className="truncate">#{tag.nom}</span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded-md bg-[#F0EFEB] text-[10px] font-semibold text-[#5A5B5E]">
                            {count}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bouton Corbeille Atelier (US-8) */}
          <button
            type="button"
            onClick={() => setIsTrashOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F8F7F5] text-[#5A5B5E] hover:text-[#17181A] border border-[#E3E1DC] rounded-xl text-xs font-bold shadow-xs transition-colors"
            title="Ouvrir la corbeille de l'Atelier"
          >
            <Trash2 size={14} className="text-[#8E8F92]" />
            <span>Corbeille</span>
            {trashCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#B4472F]/10 text-[#B4472F] text-[10px] font-extrabold">
                {trashCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Canvas libre interactif (React Flow) */}
      <div className="flex-1 w-full bg-white rounded-3xl border border-[#E3E1DC] overflow-hidden relative shadow-sm">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(event, node) => {
            if (node.type === 'activityCard') {
              const actId = parseInt(node.id.replace('activity-', ''), 10);
              setActiveActivityId(actId);
            }
          }}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={() => {
            setIsDetailDrawerOpen(false);
            setActiveActivityId(null);
          }}
          minZoom={0.2}
          maxZoom={1.5}
          defaultViewport={{ x: 20, y: 20, zoom: 0.85 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#E3E1DC" gap={24} size={1.2} />
          <Controls position="bottom-right" className="bg-white border border-[#E3E1DC] shadow-md rounded-xl overflow-hidden" />
          <MiniMap
            position="bottom-left"
            className="bg-white/90 border border-[#E3E1DC] rounded-2xl shadow-md overflow-hidden hidden sm:block"
            nodeColor={() => '#3F7A55'}
            maskColor="rgba(241, 240, 237, 0.6)"
          />
        </ReactFlow>
      </div>

      {/* 3. Modal pour sauvegarder la disposition sous un nom personnalisé */}
      {isSaveLayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17181A]/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-[#E3E1DC] space-y-4">
            <h3 className="text-base font-bold text-[#17181A] flex items-center gap-2">
              <Bookmark size={18} className="text-[#3F7A55]" />
              Nommer cette disposition
            </h3>
            <p className="text-xs text-[#5A5B5E]">
              Donnez un nom mémorable (ex: "Réflexion initiale", "Option avec musée", "Itinéraire test").
            </p>
            <input
              type="text"
              value={newLayoutName}
              onChange={(e) => setNewLayoutName(e.target.value)}
              placeholder="Ex: Réflexion initiale"
              className="w-full px-3.5 py-2.5 bg-[#F8F7F5] rounded-xl border border-[#E3E1DC] text-sm text-[#17181A] outline-none focus:border-[#17181A]"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSaveLayoutModalOpen(false);
                  setNewLayoutName("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#5A5B5E] hover:bg-[#F8F7F5]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveNamedLayout}
                disabled={!newLayoutName.trim()}
                className="px-4 py-2 rounded-xl bg-[#D6F84C] hover:bg-[#cbf13b] text-[#17181A] text-xs font-bold shadow-sm disabled:opacity-50"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Tiroir de corbeille d'atelier */}
      <WorkshopTrashDrawer
        isOpen={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        destinationId={activeDestinationId}
        onRestored={loadWorkshopData}
      />

      {/* 5. Panneau latéral de consultation détaillée (Double-clic ou bouton Détails) */}
      <ActivityDetailDrawer
        isOpen={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        activityId={detailActivity?.id}
        activityData={detailActivity}
        onEdit={() => {
          setIsDetailDrawerOpen(false);
          if (detailActivity) handleOpenEdit(detailActivity);
        }}
        onDelete={handleMoveToTrash}
        nbPersonnes={tripInfo.nb_personnes}
      />

      {/* 6. Panneau complet d'édition par le bouton Modifier (US-9) */}
      <ActivityFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        tripId={tripId}
        nbPersonnes={tripInfo.nb_personnes}
        activityToEdit={selectedActivityToEdit}
        destinations={destinations}
        categories={categories}
        onSaved={loadWorkshopData}
      />

      {/* 7. Volet latéral Planning (Phase 8 - US-14) */}
      <PlanningSidebarDrawer
        isOpen={isPlanningDrawerOpen}
        onToggleOpen={() => setIsPlanningDrawerOpen(!isPlanningDrawerOpen)}
        tripId={tripId}
        activeActivity={activeActivity}
        onSlotCreated={() => {
          loadWorkshopData();
          setActiveActivityId(null);
        }}
        onOpenFullScreenPlanning={() => onNavigateTab && onNavigateTab('planning')}
      />
    </div>
  );
}

export default function AtelierPage({ selectedDestinationId, onNavigateTab }) {
  return (
    <ReactFlowProvider>
      <AtelierCanvas initialDestinationId={selectedDestinationId} onNavigateTab={onNavigateTab} />
    </ReactFlowProvider>
  );
}
