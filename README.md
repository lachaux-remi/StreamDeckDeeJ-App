# StreamDeck DeeJ

Application Electron pour Linux qui pilote les boutons d’un Stream Deck et les curseurs audio DeeJ reliés à un Arduino.

## Fonctionnalités

- configuration d’une grille Stream Deck et d’actions appui/appui long ;
- contrôle du volume principal et des sessions PipeWire/PulseAudio ;
- animations RGB et couleurs conditionnelles ;
- intégrations Home Assistant et Discord RPC ;
- connexion série à l’Arduino avec reconnexion automatique ;
- démarrage automatique et réduction dans la zone de notification.

## Prérequis

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

L’utilisateur doit aussi avoir accès au port série. Il faut généralement l’ajouter au groupe `dialout` (Debian/Ubuntu) ou `uucp` (Arch), puis fermer et rouvrir sa session.

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

## Configuration

La configuration se fait depuis l’interface : port série, grille, boutons, sessions audio, LEDs et intégrations. Les identifiants Home Assistant et Discord sont enregistrés dans le fichier de configuration local de l’application avec des permissions limitées à l’utilisateur. Ils ne doivent jamais être ajoutés au dépôt ni copiés dans un rapport de bug.

L’intégration audio attend une pile PipeWire/PulseAudio fonctionnelle. Si aucun port série n’apparaît, vérifier les permissions du groupe et la présence de l’Arduino dans `/dev/ttyACM*` ou `/dev/ttyUSB*`.

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
