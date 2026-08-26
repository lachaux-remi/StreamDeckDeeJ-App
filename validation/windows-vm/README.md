# Validation Windows 11 x64 en VM

Ce répertoire contient le protocole manuel et les collecteurs non destructifs pour valider
StreamDeckDeeJ-App sous Windows 11 x64 avec QEMU/KVM, libvirt et virt-manager.

Il cible `main` à partir de `1c9c5bbb4d7de9c6105e666fb797e6dd80de0fe5`. Il complète, sans les
répéter, les contrôles de `.github/workflows/ci-windows.yml` : installation des dépendances,
compilation et chargement du module Core Audio, formatage, typecheck, tests Windows, lint, build,
packaging NSIS, validation des métadonnées updater, présence des modules natifs et smoke de
l'exécutable dépaqueté restent la responsabilité de la CI.

## Lancer l'assistant

Depuis un terminal Linux à la racine du dépôt :

```bash
./validation/windows-vm/wizard.sh
```

L'assistant ne crée pas et ne démarre pas la VM. Il explique chaque action humaine et conserve les
valeurs non secrètes dans `validation/windows-vm/validation.env`. Aucun secret GitHub ni clé Windows
n'est demandé.

## Contrat de la VM

- Windows 11 x64 à jour ; compte local de validation dédié ;
- machine Q35, firmware UEFI avec Secure Boot et vTPM 2.0 émulé ;
- CPU `host-passthrough`, 4 vCPU, 8 Gio de RAM, disque qcow2 de 80 Gio ;
- contrôleur USB 3 (xHCI), réseau NAT libvirt et périphérique audio virtuel fonctionnel ;
- périphérique USB physique complet `5239:0001` attaché à l'invité ;
- Visual Studio 2022 Desktop C++, Windows SDK, Node.js majeur 24 et pnpm `11.22.0`.

Le backend Core Audio Windows produit utilise le périphérique de rendu multimédia par défaut et les
sessions des applications réellement actives dans la VM. La présence du module natif dans le paquet
est déjà vérifiée en CI ; cette procédure vérifie son effet audible avec de vraies applications.

Le passthrough porte sur le périphérique USB parent. Ne pas attacher séparément le COM et le HID :
les interfaces CDC/COM et HID doivent appartenir au même périphérique composite dans Windows.

## Snapshots

Un snapshot disque seul ne constitue pas un point de restauration Windows 11 fiable. VM arrêtée,
conserver ensemble le disque qcow2, le XML libvirt, le fichier NVRAM UEFI et l'état swtpm. Si la
version locale de libvirt refuse un snapshot avec vTPM, utiliser un clone VM arrêté plutôt que de
désactiver TPM ou Secure Boot.

Points de restauration recommandés :

1. `win11-clean` : Windows et pilotes virtio installés ;
2. `win11-toolchain` : Visual Studio, SDK, Node et pnpm vérifiés ;
3. `streamdeck-n-minus-one` : N−1 installé et configuré, avant téléchargement de N.

## Bootstrap invité

Copier `guest/` dans la VM puis ouvrir PowerShell **en administrateur** uniquement pour le bootstrap :

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Bootstrap-WindowsValidation.ps1 -VisualStudioEdition Community
```

Le script utilise `winget`, installe le workload C++ avec ses composants recommandés, puis refuse de
continuer si Node n'est pas en version majeure 24 ou si pnpm n'est pas exactement `11.22.0`.

Après l'installation, les validations applicatives doivent être réalisées dans un PowerShell normal,
avec le même utilisateur que celui qui installe l'application.

## Frontière automatisation / validation humaine

| Contrôle                                                  | PowerShell / shell                | Humain                                                                    |
| --------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| KVM, libvirt, UEFI/vTPM déclaré, présence USB hôte        | `host/preflight.sh`               | corriger les paquets et permissions propres à la distribution             |
| Windows x64, TPM, Secure Boot, états de veille            | `Collect-WindowsEvidence.ps1`     | installer Windows et confirmer que la VM reprend réellement               |
| Visual Studio, SDK, Node 24, pnpm                         | `Bootstrap-WindowsValidation.ps1` | accepter l'élévation uniquement pour ce bootstrap                         |
| Artefacts N−1/N, SHA-512, manifeste Ed25519               | `Collect-WindowsEvidence.ps1`     | choisir deux releases consécutives légitimes                              |
| PnP composite, COM, processus, autostart, désinstallation | `Collect-WindowsEvidence.ps1`     | confirmer tray, focus, absence d'UAC et comportement après login/reboot   |
| Trames série bornées et formes JSON                       | `Test-SerialProtocol.ps1`         | déplacer sliders et presser/maintenir/relâcher les boutons                |
| Core Audio, HID/LED, câble et veille                      | collecte d'inventaire uniquement  | écouter les sessions, observer les LEDs, débrancher et remettre en veille |

Les observations humaines sont normatives lorsque Windows ne fournit pas d'API fiable pour le tray,
le focus, l'affichage UAC, le son entendu ou la lumière physique.

## Matrice N−1 → N

Les fonctionnalités Windows ont été introduites sans N−1 Windows publié. Le test reste donc impossible
tant que deux releases Windows stables consécutives ne sont pas disponibles sur le canal GitHub
officiel. N doit être strictement supérieur à N−1 selon SemVer. Ne pas utiliser une prerelease, un
cross-build Linux, un artefact Actions éphémère ou deux fichiers renommés pour fabriquer cette paire.

Pour N, télécharger ensemble depuis la même GitHub Release :

- `latest.yml` ;
- `streamdeck-deej-<N>-windows-x64.exe` ;
- `streamdeck-deej-<N>-windows-x64.exe.blockmap` ;
- `update-manifest-v1.json` ;
- `update-manifest-v1.sig`.

Le setup NSIS est volontairement sans Authenticode (`signExecutable=false` et
`verifyUpdateCodeSignature=false`). Authenticode est définitivement hors roadmap : `NotSigned` est
donc le résultat attendu, pas une anomalie. L'authenticité de l'update repose sur le manifeste
Ed25519, puis sur le nom exact, la taille et le SHA-512 du setup, vérifiés après téléchargement et
juste avant installation. Ces contrôles internes sont testés en CI ; la VM valide leur parcours réel.

Avant toute installation :

```powershell
.\Collect-WindowsEvidence.ps1 `
  -Phase before-install `
  -NMinusOneInstaller C:\Validation\streamdeck-deej-N-1-windows-x64.exe `
  -NInstaller C:\Validation\streamdeck-deej-N-windows-x64.exe `
  -NReleaseAssetsDirectory C:\Validation\release-N
```

Le rapport enregistre versions, tailles, SHA-512, statut Authenticode attendu et inventaire des cinq
assets. Si deux releases Windows n'existent pas encore, marquer le scénario updater
`BLOCKED_NO_WINDOWS_N_MINUS_ONE`.

## Protocole reproductible

Chaque étape produit un sous-répertoire dans `evidence/`. Conserver captures d'écran manuelles et
observations dans le fichier `notes.txt` créé par le collecteur.

### 1. Installation NSIS N−1

1. Revenir à `streamdeck-n-minus-one` ou, pour la première exécution, à `win11-toolchain`.
2. Lancer l'installateur depuis l'Explorateur, sans terminal élevé.
3. Si SmartScreen affiche **Windows a protégé votre ordinateur**, vérifier d'abord l'URL GitHub
   officielle et le SHA-512 collecté, puis choisir **Informations complémentaires → Exécuter quand
   même**. Cette acceptation est attendue pour le setup volontairement non signé.
4. Confirmer humainement : assistant NSIS visible, installation par utilisateur, aucun prompt UAC,
   choix du répertoire permis.
5. Lancer l'application depuis le menu Démarrer.
6. Collecter `after-install-n-minus-one`.

Attendu : une seule installation sous le profil utilisateur, version N−1 visible et données dans le
profil utilisateur. L'installation ne doit pas exiger de droits administrateur.

### 2. Tray, fermeture et seconde instance

1. Avec `closeToTray=true`, fermer la fenêtre : le processus et l'icône tray restent présents.
2. Cliquer l'icône tray : la fenêtre revient et prend le focus.
3. Réduire la fenêtre, puis lancer le raccourci une seconde fois.
4. Confirmer qu'aucun second processus applicatif durable n'apparaît et que la fenêtre existante est
   restaurée, affichée et focalisée.
5. Activer `runInBackground`, quitter via le menu tray, relancer : aucune fenêtre initiale, mais le
   tray est présent. Restaurer depuis le tray.

Le collecteur inventorie les processus ; la visibilité, le focus et le tray restent des preuves
humaines.

### 3. Autostart, déconnexion et reboot

1. Activer `runOnStartup`, collecter `autostart-enabled`, puis se déconnecter/reconnecter.
2. Vérifier qu'une seule instance démarre avec le comportement `runInBackground` configuré.
3. Redémarrer Windows et refaire le contrôle.
4. Désactiver `runOnStartup`, collecter `autostart-disabled`, redémarrer et confirmer l'absence de
   lancement automatique.

Le collecteur capture les clés `HKCU` usuelles et les StartupTasks visibles ; Electron peut déléguer
le stockage exact à Windows, donc l'observation après login/reboot est normative.

### 4. Updater N−1 → N

1. Revenir au snapshot `streamdeck-n-minus-one` et confirmer la version N−1.
2. Déclencher **Rechercher**. Confirmer successivement les états recherche, disponible et la version N.
   La recherche ne doit ni télécharger ni installer automatiquement.
3. Déclencher **Télécharger**. Observer une progression bornée entre 0 et 100 %, puis l'état téléchargé.
4. Déclencher **Installer**. Confirmer l'arrêt ordonné, le lancement NSIS, la relance et la version N.
   Accepter SmartScreen comme pour l'installation initiale si Windows le présente de nouveau.
5. Refaire avec la fenêtre fermée vers le tray et avec `runInBackground=true`.
6. Refaire un téléchargement, puis redémarrer **avant** de demander l'installation. Après reprise,
   relancer une recherche et vérifier que le parcours reste récupérable sans downgrade.
7. Confirmer qu'une version égale, inférieure ou prerelease n'est jamais proposée par le canal stable.
8. Ne pas forcer arrêt/logoff pendant l'écriture NSIS. `electron-updater` 6.x ne garantit pas une
   installation atomique dans cette fenêtre.
9. Collecter `after-update-n`, avec le setup toujours `NotSigned` et la version installée égale à N.

Le succès avec les cinq assets officiels démontre le chemin Ed25519 réel. Ne pas republier ou altérer
des assets pour refaire en VM les tests négatifs de manifeste, métadonnées ou setup déjà exécutés en
CI.

### 5. Core Audio

Le backend Core Audio est produit sur Windows à partir de `main` `1c9c5bb`. Les sessions sont nommées
d'après le nom du processus en minuscules ; une session sans nom apparaît comme `pid: <id>`. Toutes
les instances portant le même nom sont contrôlées ensemble. Le polling normal est d'une seconde et
réapplique les valeurs courantes lorsqu'une session apparaît ou disparaît.

1. Lire simultanément un média dans deux applications aux exécutables distincts (par défaut Edge et
   Lecteur multimédia Windows) sur le périphérique de rendu multimédia par défaut de la VM.
2. Vérifier que `master` et les deux noms de processus en minuscules sont proposés par l'application.
3. Affecter `master` et une session par slider, puis déplacer chaque slider à 0 %, 50 %, puis 100 %.
4. Vérifier auditivement et dans `sndvol.exe` que seule la bonne cible change.
5. Ouvrir une seconde instance du même lecteur : les deux processus de même nom doivent suivre le
   même slider.
6. Fermer puis relancer un lecteur en laissant son slider à 30 %. Sa session doit réapparaître et
   recevoir environ 30 % dans les cinq secondes, sans nouveau mouvement du slider.
7. Changer le périphérique de rendu multimédia par défaut, relancer les applications, puis répéter
   `master` et une session applicative.
8. Débrancher/rebrancher le périphérique audio virtuel si virt-manager le permet. Une erreur native
   doit être journalisée sans arrêter l'application ; le contrôle doit reprendre lorsque l'endpoint
   redevient disponible.

La capture/microphone Windows reste indisponible et ne fait pas partie de cette tranche.

### 6. Série et protocole

Fermer StreamDeckDeeJ-App avant le harness exclusif :

```powershell
.\Test-SerialProtocol.ps1 -Port COM7 -DurationSeconds 30
```

Le harness ouvre 115200, 8 bits, sans parité, 1 stop, envoie `app:ready\r\n`, borne la taille des
lignes à 512 octets et valide les formes `deej` et `deck`. Il ne doit pas tourner en même temps que
l'application.

Ensuite lancer l'application, sélectionner le même COM et vérifier : statut connecté, sliders mis à
jour, événements pressed/hold/released. Débrancher physiquement, attendre le statut déconnecté,
rebrancher et attendre la reconnexion sans relance.

### 7. HID et LEDs

1. Confirmer dans le diagnostic de l'application HID et série « Détecté (accès non testé) » avant
   leur première ouverture réussie.
2. Vérifier l'interface HID `interface=2`, `usage=1` du périphérique `5239:0001`.
3. Tester statique, rainbow, luminosité 0/50/100 et au moins une couleur conditionnelle.
4. Observer les 16 LEDs ; aucune autre interface HID ne doit être utilisée.
5. Quitter via le tray : les LEDs doivent devenir noires.
6. Relancer, débrancher, attendre au moins 5 secondes, rebrancher et vérifier la reprise de
   l'animation.

### 8. Veille et débranchement

1. Avec l'application connectée, mettre Windows en veille depuis le menu Alimentation si disponible.
2. Reprendre et vérifier COM, HID, sliders et LEDs.
3. Refaire en retirant le périphérique pendant la veille, puis le rebrancher après reprise.
4. Si la VM n'expose pas S3, consigner `GUEST_SLEEP_UNAVAILABLE`, puis utiliser suspend/resume de la
   VM comme scénario distinct ; ne pas présenter ce fallback comme une validation de veille Windows.

### 9. Désinstallation

1. Quitter via le tray, désactiver autostart et lancer la désinstallation depuis Paramètres.
2. Confirmer l'absence de prompt UAC, la disparition des exécutables/raccourcis et l'absence de
   processus résiduel.
3. Confirmer que les données utilisateur sont conservées (`deleteAppDataOnUninstall=false`).
4. Redémarrer : aucune instance ne doit démarrer.
5. Réinstaller N et vérifier que la configuration conservée est relue.
6. Collecter `after-uninstall` puis `after-reinstall`.

## Verdict

Un scénario est `PASS`, `FAIL`, `BLOCKED` ou `NOT_APPLICABLE`, jamais implicitement réussi. Le verdict
global est `PASS` uniquement si tous les scénarios applicables passent et si aucun scénario n'est
bloqué. Archiver le dossier `evidence/` avec les SHA-512 des artefacts testés.
