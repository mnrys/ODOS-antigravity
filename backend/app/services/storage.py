import os
import uuid
import httpx
from fastapi import UploadFile, HTTPException, status
from urllib.parse import quote

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABASE_BUCKET = "activities"

async def upload_file_to_supabase(activity_id: int, file: UploadFile) -> str:
    """
    Téléverse un fichier vers Supabase Storage via l'API REST.
    Retourne l'URL publique du fichier.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Configuration Supabase manquante (SUPABASE_URL ou SUPABASE_KEY dans .env)"
        )
    
    filename = file.filename or "fichier"
    unique_filename = f"{uuid.uuid4().hex[:10]}_{filename}"
    
    # Supabase REST API s'attend à ce que le chemin soit URL encodé
    file_path = f"{activity_id}/{quote(unique_filename)}"
    
    upload_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "apikey": SUPABASE_KEY,
        "Content-Type": file.content_type or "application/octet-stream"
    }
    
    # file.read() fonctionne parce que l'objet file de FastAPI le permet
    file_content = await file.read()
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(upload_url, headers=headers, content=file_content)
        
    if response.status_code not in (200, 201):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur d'upload Supabase: {response.text}"
        )
        
    # URL publique pour affichage sur le frontend
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{file_path}"
    return public_url

async def delete_file_from_supabase(file_url: str):
    """
    Supprime un fichier de Supabase Storage à partir de son URL publique.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
        
    prefix = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/"
    if not file_url.startswith(prefix):
        return
        
    file_path = file_url[len(prefix):]
    delete_url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{file_path}"
    
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "apikey": SUPABASE_KEY
    }
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        await client.delete(delete_url, headers=headers)
