# StreamDeck DeeJ

Application Electron pour Linux et Windows x64 qui pilote les boutons d’un Stream Deck et les
curseurs DeeJ reliés à un Arduino. Le socle Windows couvre actuellement le matériel et le lifecycle ;
le contrôle audio Windows reste volontairement désactivé jusqu’à l’intégration du backend natif.

## Fonctionnalités

- configuration d’une grille Stream Deck et d’actions appui/appui long ;
- contrôle du volume principal et des sessions PipeWire/PulseAudio sous Linux ;
- animations RGB et couleurs conditionnelles ;
- intégrations Home Assistant et Discord RPC ;
- connexion série à l’Arduino avec reconnexion automatique ;
- démarrage automatique et réduction dans la zone de notification.

## Prérequis Linux

- Linux avec PipeWire ou PulseAudio ;
- Node.js 24 et pnpm 11 (voir `.nvmrc` et `packageManager` dans `package.json`) ;
- Python 3, un compilateur C/C++, `pkg-config`, les en-têtes `libusb` et `libudev` pour les modules natifs ;
- `pactl`, `wpctl`, `pw-dump` et `dbus-send` pour toutes les fonctions audio.

Sur Debian/Ubuntu, les dépendances de compilation s’installent avec :

```bash
sudo apt install build-essential python3 pkg-config libusb-1.0-0-dev libudev-dev
```

Sur Arch Linux :

```bash
sudo pacman -S --needed base-devel python pkgconf libusb
```

Le module officiel est un périphérique USB composite Raspberry Pi Pico/Adafruit TinyUSB : son
[firmware](https://github.com/lachaux-remi/StreamDeckDeeJ-Arduino/blob/master/streamdeck_deej/streamdeck_deej.ino)
déclare le VID `5239`, le PID `0001`, une interface série CDC ACM et l’interface HID générique 2
utilisée pour les LEDs. La règle udev fournie cible uniquement cet identifiant, séparément pour le
port série et HID :

```udev
SUBSYSTEM=="hidraw", ATTRS{idVendor}=="5239", ATTRS{idProduct}=="0001", TAG+="uaccess"
SUBSYSTEM=="tty", ATTRS{idVendor}=="5239", ATTRS{idProduct}=="0001", MODE="0660", TAG+="uaccess"
```

Le paquet pacman installe et recharge automatiquement cette règle. À l’installation, sa copie par
hook remplace de façon déterministe tout fichier déjà présent au chemin fixe ci-dessus ; ce mécanisme
de copie ne dispose pas d’une base de propriété des fichiers. À la désinstallation, le hook recalcule
le hash du fichier installé : il le supprime uniquement si son contenu est encore la règle canonique,
sinon il le conserve et affiche un avertissement.

L’AppImage affiche un diagnostic dans **Paramètres › Système** et peut proposer une installation
explicite : après confirmation, `pkexec` affiche la demande d’authentification administrateur et
exécute uniquement le script immuable embarqué, qui vérifie le hash de sa règle source. Cette action
explicite remplace elle aussi tout fichier déjà présent au chemin fixe. Sans `pkexec`, aucune élévation
n’est tentée.

Pour installer la règle manuellement depuis une copie vérifiée de ce dépôt :

```bash
rule_file="$(mktemp)"
cat >"$rule_file" <<'EOF'
SUBSYSTEM=="hidraw", ATTRS{idVendor}=="5239", ATTRS{idProduct}=="0001", TAG+="uaccess"
SUBSYSTEM=="tty", ATTRS{idVendor}=="5239", ATTRS{idProduct}=="0001", MODE="0660", TAG+="uaccess"
EOF
sudo install -Dm0644 "$rule_file" /etc/udev/rules.d/70-streamdeck-deej.rules
rm -f "$rule_file"
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=hidraw
sudo udevadm trigger --subsystem-match=tty
```

Les autres contrôleurs série restent pris en charge, quels que soient leurs identifiants USB, leur
débit ou leur nombre de sliders. Ils ne sont volontairement pas couverts par cette règle ciblée :
leur utilisateur doit généralement appartenir à `dialout` (Debian/Ubuntu) ou `uucp` (Arch), puis
fermer et rouvrir sa session. L’application ne modifie jamais les groupes ou utilisateurs.

## Installation

```bash
git clone https://github.com/lachaux-remi/StreamDeckDeeJ-App.git
cd StreamDeckDeeJ-App
pnpm install --frozen-lockfile
pnpm dev
```

## Vérifications et compilation

```bash
pnpm lint       # analyse statique
pnpm typecheck  # vérification TypeScript
pnpm audit      # vulnérabilités des dépendances
pnpm build      # build Electron sans paquet installable
pnpm build:linux
```

`pnpm build:linux` produit un AppImage et un paquet Arch Linux dans `dist/`.

Sous Windows x64, `pnpm package:windows` produit un installateur NSIS par utilisateur nommé
`streamdeck-deej-<version>-windows-x64.exe`. Cette commande doit être exécutée sous Windows pour que
`node-hid` et `serialport` soient reconstruits pour Windows ; un cross-build depuis Linux ne valide
pas ces binaires natifs. L’installateur est volontairement non signé nativement : au premier lancement,
SmartScreen peut afficher **Windows a protégé votre ordinateur**. Vérifier que le fichier provient de
la release GitHub officielle avant de choisir **Informations complémentaires**, puis **Exécuter quand
même**.

### Validation Windows restante

La CI Windows construit l’installateur, vérifie les modules natifs dépaquetés et lance un smoke sans
secret ni matériel. Elle ne prouve pas le fonctionnement d’un périphérique absent. Avant diffusion,
le propriétaire doit donc vérifier sur sa VM Windows 10/11 x64 :

- installation et désinstallation NSIS par utilisateur, sans élévation ;
- tray, fermeture vers le tray, lancement en arrière-plan et restauration par seconde instance ;
- autostart après fermeture de session ou redémarrage ;
- détection puis ouverture réelle du port COM, échange du protocole série et reconnexion ;
- détection puis ouverture HID et commande des LEDs avec le module officiel `5239:0001`.

Le diagnostic Windows affiche uniquement **Détecté (accès non testé)** tant qu’aucune ouverture du
périphérique n’a confirmé son accès. Le backend audio Windows n’est pas encore pris en charge. macOS
n’est pas pris en charge.

## Releases

Les commits fusionnés dans `main` doivent suivre la convention Conventional Commits. Après validation
par la CI, Release Please ouvre ou met à jour une pull request de release. Seul le propriétaire du
dépôt relit et fusionne cette pull request. Sa fusion construit et valide le commit de merge exact,
puis attend l’approbation de l’environnement GitHub `release-signing` avant de créer le tag immuable
`vX.Y.Z` et la GitHub Release.

Le workflow utilise le secret Actions `RELEASE_PLEASE_TOKEN`, configuré avec un personal access token du propriétaire autorisé à écrire le contenu, les issues et les pull requests du dépôt. Ce token permet aux pull requests créées par Release Please de déclencher normalement la CI.

### Signature des mises à jour

Chaque release publie `update-manifest-v1.json` et `update-manifest-v1.sig`. Le manifeste canonique
JSON (UTF-8, une ligne compacte terminée par LF) lie sa version de schéma, la version applicative, le
SHA Git complet du commit de release, le key ID et, pour chaque artefact publié, son nom, sa taille et
son SHA-512 en base64. Les artefacts sont triés par nom. La signature Ed25519 porte sur les octets
exacts du manifeste. Il couvre ensemble les paquets Linux et les trois artefacts Windows (`latest.yml`,
le setup NSIS `.exe` et sa blockmap) ; l’absence de l’un d’eux interrompt la publication. Sous Windows,
l’updater vérifie obligatoirement la signature Ed25519, la version, le nom exact, la taille et le SHA-512
du setup téléchargé avant toute installation.

L’environnement GitHub `release-signing`, limité à `main` et protégé par une approbation obligatoire,
doit fournir :

- `UPDATE_SIGNING_PRIVATE_KEY` : clé privée Ed25519 au format PKCS#8 PEM **chiffré**, commençant par
  `-----BEGIN ENCRYPTED PRIVATE KEY-----` ;
- `UPDATE_SIGNING_KEY_PASSPHRASE` : passphrase de cette clé.

Le workflow transmet directement ces secrets aux primitives cryptographiques Node.js, ne les écrit
jamais sur disque et vérifie que la clé privée déchiffrée est Ed25519 et correspond à la clé publique
embarquée. Une clé non chiffrée, une passphrase incorrecte ou une clé différente interrompt la release
avant la création du tag. Le key ID actif est `ed25519-2026-f259170f`.

Pour effectuer une rotation, ajouter d’abord la nouvelle clé publique et son key ID à
`TRUSTED_UPDATE_KEYS` dans `src/main/services/signed-update.ts`, publier une version qui fait confiance
aux deux clés, puis modifier dans une seconde version `UPDATE_PUBLIC_KEY` et `UPDATE_KEY_ID` dans
`scripts/update-signing.mjs`, ainsi que les deux secrets de signature. Conserver l’ancienne clé publique
tant que des installations susceptibles de recevoir la version de transition existent. Retirer ensuite
l’ancienne entrée dans une release ultérieure. Ne jamais ajouter de clé privée ou de passphrase au
dépôt, aux logs ou aux artefacts Actions.

## Configuration

La configuration se fait depuis l’interface : port série, grille, boutons, sessions audio, LEDs et intégrations. Les identifiants Home Assistant et Discord sont enregistrés dans le fichier de configuration local de l’application avec des permissions limitées à l’utilisateur. Ils ne doivent jamais être ajoutés au dépôt ni copiés dans un rapport de bug.

L’intégration audio attend une pile PipeWire/PulseAudio fonctionnelle. Si aucun port série tiers
n’apparaît, vérifier ses permissions de groupe et sa présence dans `/dev/ttyACM*` ou `/dev/ttyUSB*`.
Le diagnostic du module officiel distingue l’absence du matériel d’un accès refusé pour HID et pour
le port série, sans rendre `5239:0001` obligatoire pour les autres contrôleurs.

## Sécurité

Consulter [SECURITY.md](SECURITY.md) pour signaler une vulnérabilité de manière privée. Les dépendances sont contrôlées par la CI et mises à jour par Dependabot.

## Contribution

1. créer une branche depuis la branche par défaut ;
2. effectuer les changements et exécuter `pnpm lint`, `pnpm typecheck`, `pnpm audit` et `pnpm build` ;
3. ouvrir une pull request sans la fusionner avant revue.

## Licence

Distribué sous licence MIT. Voir [LICENSE](LICENSE).

## Auteur

Rémi Lachaux — [lachaux-remi](https://github.com/lachaux-remi)
