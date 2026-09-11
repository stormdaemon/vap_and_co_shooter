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
- **Armes** : Poings, Vapo-Blaster (pistolet), Fumigène 3000 (fusil à dispersion), Mitrailleuse à Gummies
  (projectiles qui rebondissent), Lance-Flamant (roquette à confettis) et **Le Flamant Rose** (mêlée lourde,
  obtenu en abattant le flamant du kiosque ou le boss).
- **Zinzins** : Client Pressé, Stagiaire Caféiné, Vapoteur Enragé (crache des nuages), Mamie CBD (tank),
  Vigile Zinzin (tire), et **Le Patron Zinzin** (boss à bazooka qui chevauche le flamant, toutes les 5 vagues).
  IA avec pathfinding A*, séparation, attaques télégraphiées, réactions aux coups, chutes ragdoll.
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
| Ramasser | F |
| Changer d'arme | 1-5 ou molette |
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

Paramètres d'URL utiles : `?q=low|med|high` force la qualité, `?auto=1` lance directement une partie.
