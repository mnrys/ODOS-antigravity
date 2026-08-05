"""
Module de connexion à la base de données SQLite avec SQLAlchemy.
Projet ODOS Travel Planner — cf. SCHEMA_BASE_DE_DONNEES.md
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Définition du chemin vers la base de données SQLite locale dans le dossier backend
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "odos.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Création du moteur SQLAlchemy pour SQLite
# check_same_thread=False permet d'utiliser SQLite dans une application web multithread FastAPI
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
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
