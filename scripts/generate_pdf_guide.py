"""
Générateur de Guide PDF Haute Qualité pour La Palma & Tenerife.
Extrait les données de data/tripadvisor_canaries_archive.json,
construit une mise en page éditoriale soignée pour lecture mobile/hors-ligne,
et génère le fichier PDF via Chrome Headless.
"""
import os
import json
import subprocess
from pathlib import Path

# Chemins des fichiers
ROOT_DIR = Path(__file__).resolve().parents[1]
ARCHIVE_PATH = ROOT_DIR / "data" / "tripadvisor_canaries_archive.json"
HTML_OUTPUT_PATH = ROOT_DIR / "scripts" / "guide_print_template.html"
PDF_OUTPUT_PATH = ROOT_DIR / "Guide_Canaries_Avis_TripAdvisor.pdf"


def get_browser_executable() -> str:
    """Trouve Chrome ou Edge pour l'export PDF headless."""
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    raise RuntimeError("Aucun navigateur compatible (Chrome ou Edge) trouvé pour générer le PDF.")


def build_html(data: dict) -> str:
    """Construit le code HTML complet avec styling CSS optimisé pour l'impression A4 et lecture mobile."""
    destinations = data.get("destinations", [])
    
    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Guide & Synthèse des Avis TripAdvisor — La Palma & Tenerife</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
    
    @page {{
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
      @bottom-right {{
        content: counter(page);
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 8pt;
        color: #8E8F92;
      }}
    }}

    * {{
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}

    body {{
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #17181A;
      background-color: #FFFFFF;
      margin: 0;
      padding: 0;
      line-height: 1.45;
      font-size: 9.5pt;
    }}

    /* COUVERTURE */
    .cover-page {{
      page-break-after: always;
      height: 95vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 30px 20px 20px 20px;
      background: linear-gradient(145deg, #17181A 0%, #254A33 60%, #17181A 100%);
      color: #FFFFFF;
      border-radius: 20px;
    }}

    .cover-header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
    }}

    .cover-badge {{
      background-color: #D6F84C;
      color: #17181A;
      font-weight: 800;
      font-size: 10pt;
      padding: 6px 14px;
      border-radius: 10px;
      display: inline-block;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}

    .cover-title-box {{
      margin-top: 40px;
    }}

    .cover-subtitle {{
      color: #00E5B0;
      font-size: 13pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 12px;
    }}

    .cover-title {{
      font-size: 32pt;
      font-weight: 800;
      line-height: 1.15;
      margin: 0 0 15px 0;
      color: #FFFFFF;
    }}

    .cover-desc {{
      font-size: 11pt;
      color: #E3E1DC;
      line-height: 1.6;
      max-width: 600px;
      font-weight: 400;
    }}

    .cover-stats-grid {{
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin: 30px 0;
    }}

    .cover-stat-card {{
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 14px;
      padding: 14px 18px;
    }}

    .cover-stat-val {{
      font-size: 18pt;
      font-weight: 800;
      color: #D6F84C;
    }}

    .cover-stat-lbl {{
      font-size: 8.5pt;
      color: #C8C6C0;
      margin-top: 4px;
    }}

    .cover-footer {{
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9pt;
      color: #A0A2A5;
    }}

    /* SOMMAIRE */
    .toc-page {{
      page-break-after: always;
      padding-top: 10px;
    }}

    .section-title {{
      font-size: 18pt;
      font-weight: 800;
      color: #17181A;
      border-bottom: 2.5px solid #17181A;
      padding-bottom: 8px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }}

    .toc-island-header {{
      background-color: #FAF8F5;
      border: 1.5px solid #E3E1DC;
      border-radius: 12px;
      padding: 12px 16px;
      margin-top: 20px;
      margin-bottom: 12px;
      font-size: 12pt;
      font-weight: 800;
      color: #17181A;
      display: flex;
      justify-content: space-between;
    }}

    .toc-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }}

    .toc-item {{
      background: #FFFFFF;
      border: 1px solid #E3E1DC;
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }}

    .toc-item-title {{
      font-weight: 700;
      font-size: 9pt;
      color: #17181A;
    }}

    .toc-item-badge {{
      font-size: 7.5pt;
      font-weight: 700;
      background: #E8F2EC;
      color: #254A33;
      padding: 3px 8px;
      border-radius: 6px;
    }}

    /* FICHE ACTIVITÉ */
    .activity-card {{
      page-break-after: always;
      break-inside: avoid;
      padding: 5px 0;
    }}

    .act-header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1.5px solid #E3E1DC;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }}

    .act-num-badge {{
      background: #17181A;
      color: #FFFFFF;
      font-size: 8pt;
      font-weight: 800;
      padding: 3px 9px;
      border-radius: 6px;
      display: inline-block;
      margin-bottom: 6px;
    }}

    .act-title {{
      font-size: 15pt;
      font-weight: 800;
      color: #17181A;
      margin: 0;
      line-height: 1.2;
    }}

    .act-meta-tags {{
      display: flex;
      gap: 8px;
      margin-top: 6px;
      align-items: center;
      flex-wrap: wrap;
    }}

    .act-meta-tag {{
      font-size: 7.5pt;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 5px;
      background: #FAF8F5;
      border: 1px solid #E3E1DC;
      color: #55565A;
    }}

    .act-score-box {{
      text-align: right;
      background: #FAF8F5;
      border: 1.5px solid #E3E1DC;
      border-radius: 10px;
      padding: 8px 12px;
      min-width: 130px;
    }}

    .act-score {{
      font-size: 13pt;
      font-weight: 800;
      color: #00AF87;
    }}

    .act-reviews-count {{
      font-size: 7.5pt;
      color: #55565A;
      font-weight: 600;
    }}

    /* BANDEAU LOGISTIQUE */
    .logistics-bar {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #FAF8F5;
      border: 1px solid #E3E1DC;
      border-radius: 10px;
      padding: 8px 12px;
      margin-bottom: 12px;
      font-size: 8pt;
    }}

    .log-item-label {{
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #8E8F92;
      margin-bottom: 2px;
    }}

    .log-item-val {{
      font-weight: 700;
      color: #17181A;
    }}

    .presentation-box {{
      background: #FFFFFF;
      border-left: 3px solid #3F7A55;
      padding: 8px 12px;
      margin-bottom: 14px;
      font-size: 8.5pt;
      color: #2D2E30;
      line-height: 1.5;
    }}

    /* RAPPORT AVIS TRIPADVISOR */
    .review-report-box {{
      border: 1.5px solid #00AF87;
      background: #F8FCFA;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 12px;
    }}

    .report-title {{
      font-size: 10.5pt;
      font-weight: 800;
      color: #007A5E;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(0, 175, 135, 0.2);
      padding-bottom: 6px;
    }}

    .report-points-list {{
      display: flex;
      flex-direction: column;
      gap: 8px;
    }}

    .report-point-card {{
      background: #FFFFFF;
      border: 1px solid #D8EFE7;
      border-radius: 8px;
      padding: 8px 11px;
    }}

    .point-card-head {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }}

    .point-card-title {{
      font-weight: 800;
      font-size: 8.5pt;
      color: #17181A;
    }}

    .point-card-badge {{
      font-size: 6.5pt;
      font-weight: 800;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
      background: #E8F2EC;
      color: #254A33;
    }}

    .point-card-body {{
      font-size: 8pt;
      color: #404246;
      line-height: 1.45;
    }}

    .act-footer-link {{
      font-size: 7.5pt;
      color: #00AF87;
      font-weight: 700;
      text-decoration: none;
      word-break: break-all;
    }}

    /* MÉMO LOGISTIQUE DE FIN */
    .memo-page {{
      page-break-after: avoid;
    }}

    .memo-table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 18px;
    }}

    .memo-table th {{
      background: #17181A;
      color: #FFFFFF;
      text-align: left;
      padding: 8px 10px;
      font-weight: 800;
      font-size: 7.5pt;
      text-transform: uppercase;
    }}

    .memo-table td {{
      padding: 8px 10px;
      border-bottom: 1px solid #E3E1DC;
      color: #17181A;
    }}

    .memo-table tr:nth-child(even) {{
      background-color: #FAF8F5;
    }}

    .checklist-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 14px;
    }}

    .checklist-card {{
      background: #FAF8F5;
      border: 1px solid #E3E1DC;
      border-radius: 10px;
      padding: 10px 14px;
    }}

    .checklist-title {{
      font-weight: 800;
      font-size: 8.5pt;
      color: #17181A;
      margin-bottom: 6px;
      border-bottom: 1px solid #E3E1DC;
      padding-bottom: 4px;
    }}

    .checklist-item {{
      font-size: 7.5pt;
      color: #404246;
      margin-bottom: 4px;
      display: flex;
      gap: 6px;
    }}
  </style>
</head>
<body>

  <!-- ================= PAGE 1 : COUVERTURE ================= -->
  <div class="cover-page">
    <div class="cover-header">
      <div class="cover-badge">ODOS Travel Planner — Édition Spéciale</div>
      <div style="font-size: 9pt; font-weight: 700; color: #D6F84C;">DOCUMENT HORS-LIGNE</div>
    </div>

    <div class="cover-title-box">
      <div class="cover-subtitle">Guide & Synthèse d'Expertise Terrain</div>
      <h1 class="cover-title">Les Canaries<br>La Palma & Tenerife</h1>
      <p class="cover-desc">
        Rapport détaillé des avis et retours d'expérience vérifiés sur TripAdvisor.
        Conseils de route, créneaux idéaux, équipement adapté à l'altitude, règles nocturnes pour le ciel étoilé et réservations indispensables.
      </p>

      <div class="cover-stats-grid">
        <div class="cover-stat-card">
          <div class="cover-stat-val">17</div>
          <div class="cover-stat-lbl">Attractions phares analysées</div>
        </div>
        <div class="cover-stat-card">
          <div class="cover-stat-val">4.8 / 5</div>
          <div class="cover-stat-lbl">Note moyenne de satisfaction</div>
        </div>
        <div class="cover-stat-card">
          <div class="cover-stat-val">+46 000</div>
          <div class="cover-stat-lbl">Avis voyageurs synthétisés</div>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <div>Créé pour consultation autonome sur smartphone & tablette</div>
      <div>Format A4 / PDF Haute Lisibilité</div>
    </div>
  </div>

  <!-- ================= PAGE 2 : SOMMAIRE & INDEX ================= -->
  <div class="toc-page">
    <div class="section-title">
      <span>Sommaire des Attractions</span>
      <span style="font-size: 9pt; font-weight: 600; color: #8E8F92;">17 fiches détaillées</span>
    </div>
"""

    # Génération du sommaire
    for dest in destinations:
        dest_nom = dest.get("nom", "")
        dest_sub = dest.get("sous_titre", "")
        activites = dest.get("activites", [])
        
        html += f"""
    <div class="toc-island-header">
      <span>ÎLE DE {dest_nom.upper()}</span>
      <span style="font-size: 9pt; font-weight: 600; color: #55565A;">{len(activites)} activités</span>
    </div>
    <div class="toc-grid">
"""
        for idx, act in enumerate(activites, 1):
            titre = act.get("titre", "")
            cat = act.get("categorie_libelle", "Activité")
            note = act.get("note_globale", 4.8)
            html += f"""
      <div class="toc-item">
        <div class="toc-item-title">#{idx}. {titre}</div>
        <div class="toc-item-badge">★ {note} · {cat}</div>
      </div>
"""
        html += """    </div>"""

    html += """
    <div style="background: #FAF8F5; border: 1.5px solid #E3E1DC; border-radius: 12px; padding: 14px; margin-top: 25px;">
      <div style="font-weight: 800; font-size: 9pt; color: #17181A; margin-bottom: 6px;">💡 Comment utiliser ce guide sur votre téléphone :</div>
      <div style="font-size: 8pt; color: #55565A; line-height: 1.5;">
        Ce document PDF fonctionne entièrement <strong>sans connexion internet</strong>. 
        Chaque fiche d'activité est structurée de manière uniforme : vérifiez en premier lieu le bloc 
        <strong>"Rapport & Synthèse des Avis"</strong> avant de vous mettre en route pour anticiper l'état de la chaussée, 
        l'affluence et les permis obligatoires.
      </div>
    </div>
  </div>
"""

    # ================= FICHES DÉTAILLÉES =================
    total_idx = 1
    for dest in destinations:
        dest_nom = dest.get("nom", "")
        activites = dest.get("activites", [])

        for act in activites:
            titre = act.get("titre", "")
            cat_libelle = act.get("categorie_libelle", "Activité")
            note = act.get("note_globale", 4.8)
            nb_avis = act.get("nb_avis_total", 0)
            cout = "Gratuit" if act.get("est_gratuit") else f"{act.get('cout_par_personne', 0)} €"
            duree = act.get("duree_conseillee_texte", "2h")
            adresse = act.get("adresse", "Non renseignée")
            zone_geo = act.get("zone_geo", dest_nom)
            horaires = act.get("horaires_ouverture", "Accès libre")
            desc = act.get("presentation_courte", "")
            url = act.get("url_tripadvisor", "#")
            tags = act.get("tags", [])
            synthese = act.get("synthese_avis_detaillee", {})
            chiffres = synthese.get("chiffres_cles", f"Synthèse basée sur {nb_avis} avis vérifiés.")
            points = synthese.get("points_structurants", [])

            html += f"""
  <!-- ================= FICHE ACTIVITÉ #{total_idx} ================= -->
  <div class="activity-card">
    <div class="act-header">
      <div>
        <div class="act-num-badge">#{total_idx} · ÎLE DE {dest_nom.upper()}</div>
        <h2 class="act-title">{titre}</h2>
        <div class="act-meta-tags">
          <span class="act-meta-tag" style="background: #D6F84C; color: #17181A; font-weight: 800;">{cat_libelle}</span>
          <span class="act-meta-tag" style="background: #E8F2EC; color: #254A33; font-weight: 800;">{cout}</span>
          <span class="act-meta-tag">⏱️ {duree}</span>
          <span class="act-meta-tag">📍 {zone_geo}</span>
        </div>
      </div>
      <div class="act-score-box">
        <div class="act-score">★ {note} / 5</div>
        <div class="act-reviews-count">{nb_avis:,} avis vérifiés</div>
      </div>
    </div>

    <!-- Bandeau Logistique Rapide -->
    <div class="logistics-bar">
      <div>
        <div class="log-item-label">Adresse & Accès</div>
        <div class="log-item-val" style="font-size: 7.5pt;">{adresse}</div>
      </div>
      <div>
        <div class="log-item-label">Horaires recommandés</div>
        <div class="log-item-val" style="font-size: 7.5pt;">{horaires}</div>
      </div>
      <div>
        <div class="log-item-label">Durée sur place</div>
        <div class="log-item-val">{duree}</div>
      </div>
      <div>
        <div class="log-item-label">Tarif d'accès</div>
        <div class="log-item-val" style="color: {'#3F7A55' if cout == 'Gratuit' else '#17181A'};">{cout}</div>
      </div>
    </div>

    <!-- Présentation Courte -->
    <div class="presentation-box">
      <strong>En résumé :</strong> {desc}
    </div>

    <!-- RAPPORT APPROFONDI DES AVIS VOYAGEURS -->
    <div class="review-report-box">
      <div class="report-title">
        <span>📋 Synthèse & Conseils de Terrain des Voyageurs</span>
        <span style="font-size: 7.5pt; font-weight: 600; color: #007A5E;">{chiffres}</span>
      </div>

      <div class="report-points-list">
"""
            for pt in points:
                pt_titre = pt.get("titre", "")
                pt_contenu = pt.get("contenu", "")
                
                # Détermination du badge contextuel
                badge_type = "Conseil Clé"
                if "route" in pt_titre.lower() or "accès" in pt_titre.lower():
                    badge_type = "Route & Accès"
                elif "permis" in pt_titre.lower() or "réserv" in pt_titre.lower() or "obligatoire" in pt_titre.lower():
                    badge_type = "⚠️ Réservation Obligatoire"
                elif "matin" in pt_titre.lower() or "horaire" in pt_titre.lower() or "tôt" in pt_titre.lower():
                    badge_type = "Horaires & Timing"
                elif "chaud" in pt_titre.lower() or "vêtement" in pt_titre.lower() or "équipement" in pt_titre.lower():
                    badge_type = "Équipement & Météo"
                elif "nuit" in pt_titre.lower() or "lampe" in pt_titre.lower() or "étoile" in pt_titre.lower():
                    badge_type = "Observation Nocturne"

                html += f"""
        <div class="report-point-card">
          <div class="point-card-head">
            <span class="point-card-title">• {pt_titre}</span>
            <span class="point-card-badge">{badge_type}</span>
          </div>
          <div class="point-card-body">{pt_contenu}</div>
        </div>
"""

            html += f"""
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px;">
      <span style="font-size: 7.5pt; color: #8E8F92;">Tags : {', '.join(tags)}</span>
      <a href="{url}" class="act-footer-link">Lien officiel TripAdvisor : {url[:60]}...</a>
    </div>
  </div>
"""
            total_idx += 1

    # ================= PAGE FINALE : MÉMO LOGISTIQUE & VALISE =================
    html += """
  <!-- ================= PAGE MÉMO VOYAGEUR ================= -->
  <div class="memo-page">
    <div class="section-title">
      <span>Fiche Mémo Voyageur — Réservations & Valise</span>
      <span style="font-size: 9pt; font-weight: 600; color: #8E8F92;">À vérifier avant le départ</span>
    </div>

    <div style="font-weight: 800; font-size: 10pt; color: #17181A; margin-bottom: 8px;">
      🚨 Tableau des Réservations Indispensables (Goulots d'étranglement)
    </div>

    <table class="memo-table">
      <thead>
        <tr>
          <th>Lieu / Activité</th>
          <th>Île</th>
          <th>Délai Recommandé</th>
          <th>Lien / Modalité Officielle</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Pico del Teide (Cratère sommital)</strong></td>
          <td>Tenerife</td>
          <td>2 à 3 mois à l'avance</td>
          <td>reservasparquesnacionales.es (Gratuit - 200 places/j)</td>
        </tr>
        <tr>
          <td><strong>Parking La Cumbrecita (Caldera)</strong></td>
          <td>La Palma</td>
          <td>3 à 7 jours à l'avance</td>
          <td>reservasparquesnacionales.es (Gratuit - QR code requis)</td>
        </tr>
        <tr>
          <td><strong>Forêt Enchantée d'El Pijaral (Anaga)</strong></td>
          <td>Tenerife</td>
          <td>15 jours à l'avance</td>
          <td>centraldereservas.tenerife.es (Gratuit - 45 pers/j)</td>
        </tr>
        <tr>
          <td><strong>Gorge de Masca (Descente rando)</strong></td>
          <td>Tenerife</td>
          <td>1 à 2 semaines</td>
          <td>caminobarrancodemasca.com (Casque fourni, chaussures crantées)</td>
        </tr>
        <tr>
          <td><strong>Volcan Tajogaite (Éruption 2021)</strong></td>
          <td>La Palma</td>
          <td>3 à 5 jours</td>
          <td>Excursion guidée officielle obligatoire (Zone protégée)</td>
        </tr>
      </tbody>
    </table>

    <div class="checklist-grid">
      <div class="checklist-card">
        <div class="checklist-title">🎒 Équipements Spécifiques Indispensables</div>
        <div class="checklist-item">
          <span>✓</span>
          <span><strong>Lampe frontale à lumière rouge</strong> : Obligatoire pour observer le ciel au Roque de los Muchachos et au Teide sans gêner les télescopes scientifiques.</span>
        </div>
        <div class="checklist-item">
          <span>✓</span>
          <span><strong>Doudoune / Veste chaude & bonnet</strong> : Chute de température de 15°C à 20°C entre la côte et les sommets (2 400 m à 3 700 m).</span>
        </div>
        <div class="checklist-item">
          <span>✓</span>
          <span><strong>Chaussures de rando montantes</strong> : Protègent les chevilles des lapilli noirs abrasifs (Tajogaite) et des galets de torrent (Caldera).</span>
        </div>
        <div class="checklist-item">
          <span>✓</span>
          <span><strong>K-way étanche & lampe puissante</strong> : Pour traverser les 13 tunnels d'eau de Marcos y Cordero (Los Tilos).</span>
        </div>
      </div>

      <div class="checklist-card">
        <div class="checklist-title">🚗 Conduite & Règle d'Or des Canaries</div>
        <div class="checklist-item">
          <span>✓</span>
          <span><strong>Sens de montée à La Palma</strong> : Privilégier le versant Ouest (LP-4 via Hoya Grande) réputé plus fluide que le versant Nord-Est.</span>
        </div>
        <div class="checklist-item">
          <span>✓</span>
          <span><strong>Arriver avant 10h</strong> : Pour les parkings étroits (Roque de los Muchachos, Los Tilos, Cruz del Carmen).</span>
        </div>
        <div class="checklist-item">
          <span>✓</span>
          <span><strong>Frein moteur en descente</strong> : Rétrograder en 2ème ou 1ère dans les lacets raides pour ménager les freins.</span>
        </div>
        <div class="checklist-item">
          <span>✓</span>
          <span><strong>Protection solaire max</strong> : Indice 50+ et lunettes catégorie 4 indispensables en altitude au-dessus des nuages.</span>
        </div>
      </div>
    </div>

    <div style="margin-top: 20px; text-align: center; font-size: 8pt; color: #8E8F92; border-top: 1px solid #E3E1DC; padding-top: 10px;">
      ODOS Travel Planner — Guide édité pour consultation hors-ligne — Bon voyage aux Canaries !
    </div>
  </div>

</body>
</html>
"""
    return html


def generate_pdf():
    """Génère le fichier HTML puis appelle Chrome Headless pour produire le PDF."""
    if not ARCHIVE_PATH.exists():
        raise FileNotFoundError(f"Fichier d'archive introuvable : {ARCHIVE_PATH}")

    with open(ARCHIVE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    html_content = build_html(data)
    with open(HTML_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(html_content)

    browser_exe = get_browser_executable()
    print(f"Génération du PDF avec {browser_exe}...")

    cmd = [
        browser_exe,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={PDF_OUTPUT_PATH}",
        str(HTML_OUTPUT_PATH.as_uri())
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Erreur de génération : {result.stderr}")
        raise RuntimeError(f"Échec Chrome : {result.stderr}")

    if PDF_OUTPUT_PATH.exists():
        size_kb = PDF_OUTPUT_PATH.stat().st_size / 1024
        print(f"Succès ! PDF généré : {PDF_OUTPUT_PATH} ({size_kb:.1f} Ko)")
        return str(PDF_OUTPUT_PATH)
    else:
        raise FileNotFoundError("Le fichier PDF n'a pas été produit.")


if __name__ == "__main__":
    generate_pdf()
