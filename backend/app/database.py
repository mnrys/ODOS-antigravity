"""
Module de connexion à la base de données SQLite avec SQLAlchemy.
Projet ODOS Travel Planner — cf. SCHEMA_BASE_DE_DONNEES.md
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Définition de l'URL de connexion
# En local : on utilise SQLite par défaut
# En production (Render/Supabase) : l'hébergeur fournira la variable d'environnement DATABASE_URL
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "odos.db")

DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DB_PATH}")

# Correction automatique pour Supabase/Heroku qui fournissent postgres:// au lieu de postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Options spécifiques pour SQLite (le multithread FastAPI)
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

# Création du moteur SQLAlchemy
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args
)

# Session factory pour interagir avec la base de données
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Classe de base pour l'ensemble des modèles SQLAlchemy
Base = declarative_base()


def get_db():
    """
    Générateur de session de base de données (Dependency Injection FastAPI).
    Ouvre une session au début de la requête HTTP et la ferme proprement à la fin.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
