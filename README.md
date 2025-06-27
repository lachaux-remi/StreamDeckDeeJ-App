# <img alt="Logo" height="25" src="src/assets/logo.png" width="25"/> StreamDeck-DeeJ – Application Desktop

Plateforme desktop performante pour [StreamDeckDeeJ](https://github.com/lachaux-remi/StreamDeckDeeJ) offrant un contrôle avancé et une latence minimale lors de l’envoi de commandes vers [StreamDeckDeeJ-Arduino](https://github.com/lachaux-remi/StreamDeckDeeJ-Arduino). 

---

## ⚙️ Pré-requis

- **Node.js v22.14.0+** géré avec pnpm
- **Python 3.x+**, pour les scripts auxiliaires
- **Visual Studio (Windows)** avec le composant « Développement Desktop C++ »

---

## 🚀 Installation et exécution

1. **Clonage du dépôt**
   ```bash
   git clone https://github.com/lachaux-remi/StreamDeckDeeJ-App.git
   ```
2. **Installation des dépendances**
   ```bash
   cd StreamDeckDeeJ-App
   pnpm install
   ```
3. **Lancement en mode développement**
   ```bash
   pnpm run dev
   ```
    - Hot Reload et outils de debug Electron activés
4. **Compilation pour production**
   ```bash
   pnpm run build
   ```
    - Génère des binaires optimisés pour Windows, macOS et Linux
    - **Note :** sous Windows, exécuter la commande avec des droits administrateur pour éviter les erreurs de permission


---

## 🛠️ Stack technique

- **React** : UI déclarative
- **Redux Toolkit** : gestion d’état et middlewares WebSocket
- **MUI** : composants et design system
- **ElectronJS** : déploiement multiplateforme
- **ViteJS** : bundling et HMR optimisés
- **TypeScript** : typage strict et sécurité
- **ESLint & Prettier** : linting et formatage

---

## 🤝 Contribution

1. Fork le projet
2. Crée une branche (`git checkout -b feat/ma-fonction`)
3. Commit tes changements (`git commit -m "Ajoute une fonction"`)
4. Push sur ta branche (`git push origin feat/ma-fonction`)
5. Ouvre une Pull Request pour revue

---

## 📝 Licence

Distribué sous licence MIT. Voir [LICENSE](LICENSE) pour les détails.

---

## 👤 Auteur

**Rémi Lachaux** – mainteneur principal ([lachaux-remi](https://github.com/lachaux-remi))

