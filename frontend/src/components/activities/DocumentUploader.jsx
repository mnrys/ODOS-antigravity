/**
 * Composant de gestion et d'upload des documents (Photos et PDF).
 * Conforme à SCHEMA_BASE_DE_DONNEES.md (section 4) et docs/DESIGN.md.
 */
import React, { useState } from 'react';
import { Upload, FileText, Image as ImageIcon, Star, Trash2, ExternalLink, Check } from 'lucide-react';
import { formatApiError } from '../../api/client';
import { getPhotoUrl } from '../../utils/imageUtils';

export default function DocumentUploader({
  activityId,
  documents = [],
  onDocumentsChange,
  pendingFiles = [],
  onPendingFilesChange
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploadError(null);

    // Si l'activité existe déjà en base, on envoie directement au serveur
    if (activityId) {
      setIsUploading(true);
      try {
        let currentDocs = [...documents];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const formData = new FormData();
          formData.append('file', file);
          formData.append('libelle', file.name);
          formData.append('type_source', 'upload_manuel');

          const res = await fetch(`/api/activities/${activityId}/documents`, {
            method: 'POST',
            body: formData,
          });

          if (res.ok) {
            const newDoc = await res.json();
            currentDocs = [...currentDocs, newDoc];
            if (onDocumentsChange) onDocumentsChange(currentDocs);
          } else {
            const errData = await res.json();
            setUploadError(formatApiError(errData, "Erreur lors de l'envoi du document"));
          }
        }
      } catch (err) {
        setUploadError("Impossible de joindre le serveur pour l'envoi");
      } finally {
        setIsUploading(false);
      }
    } else {
      // En mode création préalable (avant sauvegarde), on empile les fichiers en mémoire
      const hasExistingMainPhoto = pendingFiles.some(f => f.type === 'photo' && f.isMain);
      let firstPhotoFound = hasExistingMainPhoto;

      const newPending = Array.from(files).map((f) => {
        const isPhoto = f.type.startsWith('image/');
        let isMain = false;
        if (isPhoto && !firstPhotoFound) {
          isMain = true;
          firstPhotoFound = true;
        }
        return {
          file: f,
          name: f.name,
          type: isPhoto ? 'photo' : 'pdf',
          previewUrl: isPhoto ? URL.createObjectURL(f) : null,
          isMain: isMain,
        };
      });

      if (onPendingFilesChange) {
        onPendingFilesChange([...pendingFiles, ...newPending]);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleDeleteExisting = async (docId) => {
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (res.ok && onDocumentsChange) {
        onDocumentsChange(documents.filter((d) => d.id !== docId));
      }
    } catch (err) {
      console.error("Erreur de suppression du document:", err);
    }
  };

  const handleSetMainPhoto = async (docId) => {
    try {
      const res = await fetch(`/api/documents/${docId}/main`, { method: 'PATCH' });
      if (res.ok && onDocumentsChange) {
        onDocumentsChange(
          documents.map((d) => ({
            ...d,
            est_principale: d.id === docId ? 1 : 0,
          }))
        );
      }
    } catch (err) {
      console.error("Erreur mise à jour photo principale:", err);
    }
  };

  const handleSetPendingMain = (targetIndex) => {
    if (!onPendingFilesChange) return;
    const updated = pendingFiles.map((pf, idx) => ({
      ...pf,
      isMain: idx === targetIndex,
    }));
    onPendingFilesChange(updated);
  };

  const handleRemovePending = (index) => {
    if (!onPendingFilesChange) return;
    const removed = pendingFiles[index];
    const updated = pendingFiles.filter((_, i) => i !== index);

    // Si on a supprimé la photo principale, on désigne la première photo restante
    if (removed && removed.isMain) {
      const firstRemainingPhoto = updated.find(f => f.type === 'photo');
      if (firstRemainingPhoto) {
        firstRemainingPhoto.isMain = true;
      }
    }
    onPendingFilesChange(updated);
  };

  const photos = documents.filter((d) => d.type_fichier === 'photo');
  const pdfs = documents.filter((d) => d.type_fichier === 'pdf');

  const pendingPhotos = pendingFiles.filter((f) => f.type === 'photo');
  const pendingPdfs = pendingFiles.filter((f) => f.type === 'pdf');

  return (
    <div className="space-y-4">
      {/* Zone de glisser-déposer / sélection de fichier */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center p-5 rounded-[16px] border-2 border-dashed transition-all text-center cursor-pointer ${
          dragOver
            ? 'border-[#17181A] bg-[#D6F84C]/10'
            : 'border-[#E6E4DF] bg-[#F7F6F3] hover:bg-[#EDEBE6]/50'
        }`}
      >
        <input
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={(e) => handleFileUpload(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm mb-2 text-[#17181A]">
          <Upload size={18} />
        </div>
        <p className="text-[13px] font-medium text-[#17181A]">
          {isUploading ? "Envoi des fichiers en cours..." : "Glissez vos photos ou PDF ici, ou cliquez pour parcourir"}
        </p>
        <p className="text-[11px] text-[#8E8F92] mt-0.5">
          Photos (JPG, PNG, WEBP) · Billets & Vouchers (PDF)
        </p>
      </div>

      {uploadError && (
        <p className="text-[12px] text-[#B4472F] bg-[#B4472F]/10 p-2.5 rounded-[10px] font-medium">
          {uploadError}
        </p>
      )}

      {/* Galerie des photos existantes */}
      {photos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[#55565A] flex items-center gap-1.5">
              <ImageIcon size={14} />
              Galerie photos ({photos.length})
            </span>
            <span className="text-[11px] text-[#8E8F92]">L'étoile désigne la photo de couverture</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className={`group relative aspect-video rounded-[12px] overflow-hidden bg-[#EDEBE6] border ${
                  photo.est_principale ? 'border-[#17181A] ring-2 ring-[#D6F84C]' : 'border-[#E6E4DF]'
                }`}
              >
                <img
                  src={getPhotoUrl(photo.chemin_fichier)}
                  alt={photo.libelle || "Photo activité"}
                  className="w-full h-full object-cover"
                />

                {/* Badge photo principale */}
                {photo.est_principale === 1 && (
                  <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-[#17181A]/90 text-[#D6F84C] text-[10px] font-bold rounded-full flex items-center gap-1 shadow-sm">
                    <Star size={10} fill="#D6F84C" />
                    Couverture
                  </div>
                )}

                {/* Actions au survol */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!photo.est_principale && (
                    <button
                      type="button"
                      onClick={() => handleSetMainPhoto(photo.id)}
                      className="p-1.5 bg-white/90 hover:bg-white text-[#17181A] rounded-full transition-transform hover:scale-110"
                      title="Définir comme photo principale"
                    >
                      <Star size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteExisting(photo.id)}
                    className="p-1.5 bg-white/90 hover:bg-white text-[#B4472F] rounded-full transition-transform hover:scale-110"
                    title="Supprimer cette photo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photos en attente d'enregistrement (avec choix visuel de la miniature) */}
      {pendingPhotos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[#55565A] flex items-center gap-1.5">
              <ImageIcon size={14} />
              Photos à enregistrer ({pendingPhotos.length})
            </span>
            <span className="text-[11px] text-[#8E8F92]">Cliquez sur l'étoile pour choisir la miniature</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {pendingFiles.map((pf, idx) => {
              if (pf.type !== 'photo') return null;
              return (
                <div
                  key={idx}
                  className={`group relative aspect-video rounded-[12px] overflow-hidden bg-[#EDEBE6] border ${
                    pf.isMain ? 'border-[#17181A] ring-2 ring-[#D6F84C]' : 'border-[#E6E4DF]'
                  }`}
                >
                  <img
                    src={pf.previewUrl}
                    alt={pf.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Badge Miniature */}
                  {pf.isMain ? (
                    <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-[#17181A]/90 text-[#D6F84C] text-[10px] font-bold rounded-full flex items-center gap-1 shadow-sm">
                      <Star size={10} fill="#D6F84C" />
                      Miniature
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetPendingMain(idx)}
                      className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-white/90 hover:bg-white text-[#17181A] text-[10px] font-medium rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-sm"
                    >
                      <Star size={10} />
                      Définir miniature
                    </button>
                  )}

                  {/* Bouton Supprimer */}
                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleRemovePending(idx)}
                      className="p-1 bg-white/90 hover:bg-white text-[#B4472F] rounded-full shadow-sm"
                      title="Retirer cette photo"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Documents PDF existants */}
      {pdfs.length > 0 && (
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[#55565A] flex items-center gap-1.5 mb-2">
            <FileText size={14} />
            Documents PDF & Billets ({pdfs.length})
          </div>
          <div className="space-y-1.5">
            {pdfs.map((pdf) => (
              <div
                key={pdf.id}
                className="flex items-center justify-between p-2.5 bg-[#F7F6F3] rounded-[10px] border border-[#E6E4DF] hover:bg-[#EDEBE6] transition-colors"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-[8px] bg-[#395E8C]/15 text-[#395E8C] flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <span className="text-[13px] font-medium text-[#17181A] truncate">
                    {pdf.libelle || "Document joint"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={`/${pdf.chemin_fichier}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-[#55565A] hover:text-[#17181A] rounded-[6px] hover:bg-white transition-colors"
                    title="Ouvrir le PDF"
                  >
                    <ExternalLink size={15} />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDeleteExisting(pdf.id)}
                    className="p-1.5 text-[#8E8F92] hover:text-[#B4472F] rounded-[6px] hover:bg-white transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF en attente */}
      {pendingPdfs.length > 0 && (
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[#55565A] mb-2 flex items-center gap-1.5">
            <FileText size={14} />
            Documents PDF prêts à enregistrer ({pendingPdfs.length})
          </div>
          <div className="space-y-1.5">
            {pendingFiles.map((pf, idx) => {
              if (pf.type !== 'pdf') return null;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-[#D6F84C]/10 rounded-[10px] border border-[#D6F84C]/40 text-[13px]"
                >
                  <span className="flex items-center gap-2 text-[#17181A] font-medium truncate">
                    <FileText size={15} className="text-[#395E8C]" />
                    {pf.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemovePending(idx)}
                    className="p-1 text-[#8E8F92] hover:text-[#B4472F]"
                    title="Retirer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
