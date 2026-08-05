"""
Point d'entrée principal de l'application Backend FastAPI pour ODOS Travel Planner.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
import os
from fastapi.staticfiles import StaticFiles
from app.routers import trips, activities, documents, tags, scraping, workshop, planning
from app.seed import seed_database

# Initialisation de l'application FastAPI avec métadonnées
app = FastAPI(
    title="ODOS Travel Planner API",
    description="API Backend pour l'application de planification de voyage ODOS",
    version="1.0.0"
)

# Création du dossier uploads s'il n'existe pas encore
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Montage du dossier de fichiers statiques pour les photos et documents PDF
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Configuration CORS pour autoriser le frontend React (Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En développement local solo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusion des routeurs API
app.include_router(trips.router)
app.include_router(activities.router)
app.include_router(documents.router)
app.include_router(tags.router)
app.include_router(scraping.router)
app.include_router(workshop.router)
app.include_router(planning.router)


@app.on_event("startup")
def on_startup():
    """
    Au démarrage du serveur :
    - S'assure que les tables SQLite existent
    - Exécute le seeding si la base est vide
    """
    Base.metadata.create_all(bind=engine)
    seed_database()


@app.get("/")
def read_root():
    """
    Endpoint de santé / confirmation que le backend tourne.
    """
    return {
        "app": "ODOS Travel Planner API",
        "status": "online",
        "docs_url": "/docs"
    }
