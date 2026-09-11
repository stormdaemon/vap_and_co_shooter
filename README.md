# Vap&Co — Zinzin Mayhem

Remake complet du « jeu de gestion de zinzins » de Vap&Co : un FPS arcade déjanté dans une reconstitution 3D
du magasin (comptoirs à lattes, kiosque et son flamant rose, chariot, mezzanine, vitrines, enseignes néon).

Site statique, sans build : ouvrez `index.html` via un serveur HTTP (Netlify, `python3 -m http.server`, etc.).

## Ce qui a changé par rapport à l'ancienne version

- **Rendu** : Three.js (WebGL 2) avec matériaux PBR, textures procédurales haute résolution (sol chêne gris,
  lattes de pin, parpaings, métal brossé) + photos extraites de l'ancien atlas pour les rayonnages, affiches et
  étiquettes de flacons. Ombres dynamiques, réflexions d'environnement, bloom, SMAA, grain, vignette, aberration
  chromatique, et occlusion ambiante GTAO en qualité « Photoréaliste ».
- **Fluidité** : physique joueur à pas fixe (120 Hz) avec interpolation caméra, capsule vs AABB, glissade,
  dash (double-tap), saut, accroupissement, head-bob, recul à ressort, sway de l'arme, résolution dynamique.
- **Armes** (viewmodels détaillés avec vraies mains, culasse et pompe animées) : Poings, Vapo-Blaster, Fumigène 3000,
  Mitrailleuse à Gummies (projectiles qui rebondissent), Lance-Flamant (roquette à confettis), **Rayon Botanique**
  (faisceau continu qui surchauffe), **Canon à Bulles** (piège les zinzins dans une bulle, dégâts ×1,6),
  **Gummy-Bombes** (grenades, touche G) et **Le Flamant Rose** (mêlée lourde, obtenu en abattant le flamant du kiosque ou le boss).
- **Zinzins** (un seul draw call par ennemi : rig skinné + atlas de texture) : Client Pressé, Stagiaire Caféiné,
  Vapoteur Enragé, Mamie CBD, Vigile Zinzin, **Livreur Turbo** (charges), **Influenceur** (soigne et accélère les autres),
  **Vapoteur Explosif** (kamikaze) et **Le Patron Zinzin** (boss à bazooka sur flamant, toutes les 5 vagues, deux à partir de la 10).
  IA avec pathfinding A* (y compris escalier et mezzanine), séparation, attaques télégraphiées, réactions aux coups, chutes ragdoll.
- **Progression** : modificateurs de vague aléatoires (Turbo, Panne de courant + lampe torche, Happy Hour, Fiesta,
  Pluie de power-ups, Zinzins costauds, Soirée explosive), **ultime « Tempête de Vapeur »** (X) chargé par les éliminations,
  **Boutique du Patron** à la caisse entre les vagues (vitalité, rechargement, dash, dégâts, seconde chance…).
- **Folie** : vagues infinies, combos et multiplicateurs, annonces (« DOUBLE ZINZIN », « CARNAGE AU COMPTOIR »…),
  power-ups (Menthe Glaciale = ralenti, Booster Nicotine, Bouclier Vitrine, Disco CBD, Méga-Gummies, Tisane CBD),
  bouteilles destructibles (centaines de flacons instanciés), tabourets et bocaux physiques qui assomment les
  zinzins, confettis, taunts, musique synthwave et effets sonores 100 % procéduraux (WebAudio).

## Commandes

| Action | Touche |
|---|---|
| Se déplacer | ZQSD / WASD / flèches |
| Courir / glisser | Maj / Maj + C en courant |
| Sauter / s'accroupir | Espace / C |
| Dash | double-tap d'une direction |
| Tirer / viser / recharger | clic gauche / clic droit / R |
| Coup de poing | E (même avec une arme) |
| Ramasser / boutique | F |
| Grenade / ultime / lampe | G / X / L |
| Changer d'arme | 1-7 ou molette |
| Pause | Échap |

## Structure

```
index.html            page + HUD
src/main.js           démarrage, boucle
src/engine/           renderer + post-process, génération de textures
src/world/            magasin (géométrie, matériaux, lumières), bouteilles, navigation
src/game/             joueur, armes, zinzins, vagues, effets, audio, props, HUD
vendor/three/         Three.js 0.186 (vendorisé, aucun CDN)
assets/               photos de référence et crops extraits de l'atlas d'origine
legacy/               ancienne version (fichiers HTML autonomes)
```

## Performances (PC modestes)

- Rendu interne plafonné à 1× (Éco 0,9×, Photoréaliste 1,5×) avec résolution dynamique 0,5–1× qui vise ~55 fps.
- Chaîne de post-traitement réduite : tone mapping et sRGB fusionnés dans la passe de grade, FXAA en une passe (SMAA
  seulement en Photoréaliste), cibles 8 bits en Éco.
- Nombre de lumières constant (aucune recompilation de shader en jeu) ; tous les shaders sont compilés au chargement
  via une routine de chauffe (zinzins de référence cachés, projectiles, effets, bonus).
- Ombres : soleil uniquement en Éco/Équilibrée (1024/1536 px), mises à jour un frame sur deux ou trois ; spots
  ombrés seulement en Photoréaliste ; les flacons ne projettent d'ombre qu'en Photoréaliste.
- Un seul draw call par zinzin (SkinnedMesh + atlas), viewmodels fusionnés par matériau, verre en MeshStandard.
- Textures procédurales mises en cache dans IndexedDB : le premier chargement les génère, les suivants sont instantanés.
- HUD sans `backdrop-filter` (le flou CSS au-dessus d'un canvas WebGL coûte cher sur GPU intégré).

Paramètres d'URL utiles : `?q=low|med|high` force la qualité, `?auto=1` lance directement une partie.
