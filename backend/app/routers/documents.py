"""
Routeur FastAPI pour la gestion des pièces jointes et de la galerie (Photos et PDF).
cf. PRD_ecran1_creation.md (US-12) et SCHEMA_BASE_DE_DONNEES.md, section 4.
"""
import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Activity, Document
from app.schemas import DocumentBase
from app.services.storage import upload_file_to_supabase, delete_file_from_supabase

router = APIRouter(tags=["Documents"])


@router.post("/api/activities/{activity_id}/documents", response_model=DocumentBase, status_code=status.HTTP_201_CREATED)
async def upload_activity_document(
    activity_id: int,
    file: UploadFile = File(...),
    libelle: Optional[str] = Form(None),
    type_source: Optional[str] = Form("upload_manuel"),
    est_principale: Optional[bool] = Form(False),
    db: Session = Depends(get_db)
):
    """
    Enregistre un document (Photo ou PDF) associé à une fiche activité.
    Stocke le fichier physiquement sur le disque et son chemin relatif en base.
    """
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activité {activity_id} introuvable"
        )

    # Détection du type de fichier (photo ou pdf/document)
    filename = file.filename or "fichier"
    extension = os.path.splitext(filename)[1].lower()
    content_type = (file.content_type or "").lower()
    
    image_extensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg", ".bmp", ".heic", ".heif", ".tiff"]
    if extension in image_extensions or content_type.startswith("image/"):
        type_fichier = "photo"
    elif extension == ".pdf" or content_type == "application/pdf":
        type_fichier = "pdf"
    else:
        # Fichier générique accepté comme pdf/document
        type_fichier = "pdf"

    # Upload vers Supabase Storage
    try:
        public_url = await upload_file_to_supabase(activity_id, file)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'envoi de l'image: {str(e)}"
        )
    
    # Chemin stocké en base (URL absolue)
    relative_path = public_url

    # Vérification si c'est la première photo de l'activité (devient automatiquement principale)
    nb_photos = db.query(Document).filter(
        Document.activity_id == activity_id,
        Document.type_fichier == "photo"
    ).count()

    is_main = 1 if (type_fichier == "photo" and (est_principale or nb_photos == 0)) else 0

    if is_main == 1:
        # Réinitialise toute autre photo principale existante pour cette activité
        db.query(Document).filter(
            Document.activity_id == activity_id,
            Document.type_fichier == "photo"
        ).update({"est_principale": 0})

    doc = Document(
        activity_id=activity_id,
        type_fichier=type_fichier,
        chemin_fichier=relative_path,
        type_source=type_source,
        libelle=libelle or filename,
        est_principale=is_main
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


from pydantic import BaseModel

class AddImageUrlPayload(BaseModel):
    url: str
    libelle: Optional[str] = None
    est_principale: Optional[bool] = False


@router.post("/api/activities/{activity_id}/documents/from-url", response_model=DocumentBase, status_code=status.HTTP_201_CREATED)
def add_document_from_url(
    activity_id: int,
    payload: AddImageUrlPayload,
    db: Session = Depends(get_db)
):
    """
    Associe directement une URL d'image web (ex: GetYourGuide, Unsplash) comme photo à l'activité.
    """
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activité {activity_id} introuvable"
        )

    nb_photos = db.query(Document).filter(
        Document.activity_id == activity_id,
        Document.type_fichier == "photo"
    ).count()

    is_main = 1 if (payload.est_principale or nb_photos == 0) else 0

    if is_main == 1:
        db.query(Document).filter(
            Document.activity_id == activity_id,
            Document.type_fichier == "photo"
        ).update({"est_principale": 0})

    doc = Document(
        activity_id=activity_id,
        type_fichier="photo",
        chemin_fichier=payload.url.strip(),
        type_source="scraping_auto",
        libelle=payload.libelle or "Photo web",
        est_principale=is_main
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc



@router.delete("/api/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: int, db: Session = Depends(get_db)):
    """
    Supprime un document en base et retire le fichier de Supabase Storage.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} introuvable"
        )

    # Suppression du fichier sur Supabase Storage
    try:
        await delete_file_from_supabase(doc.chemin_fichier)
    except Exception:
        pass  # Ne bloque pas la suppression en base si l'image est introuvable

    activity_id = doc.activity_id
    was_main = doc.est_principale

    db.delete(doc)
    db.commit()

    # Si c'était la photo principale, on promeut la prochaine photo disponible
    if was_main == 1:
        next_photo = db.query(Document).filter(
            Document.activity_id == activity_id,
            Document.type_fichier == "photo"
        ).first()
        if next_photo:
            next_photo.est_principale = 1
            db.commit()

    return None


@router.patch("/api/documents/{document_id}/main", response_model=DocumentBase)
def set_main_photo(document_id: int, db: Session = Depends(get_db)):
    """
    Définit une photo comme photo principale (affichée en couverture sur les cartes).
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} introuvable"
        )

    if doc.type_fichier != "photo":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seule une photo peut être définie comme photo principale"
        )

    # Retire le statut principal aux autres photos
    db.query(Document).filter(
        Document.activity_id == doc.activity_id,
        Document.type_fichier == "photo"
    ).update({"est_principale": 0})

    doc.est_principale = 1
    db.commit()
    db.refresh(doc)
    return doc
