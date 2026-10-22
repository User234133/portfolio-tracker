# 📈 Portfolio Tracker

Application web de suivi de portefeuille boursier. Stack : Next.js + Turso (SQLite cloud) + Vercel.

## Déploiement en 4 étapes

### 1. Mettre le code sur GitHub
- Créer un repo GitHub (ex: `portfolio-tracker`)
- Copier tous ces fichiers dedans
- Push sur la branche `main`

### 2. Importer la base Turso (dans WSL)
```bash
turso auth login
turso db create portfolio
turso db push portfolio ~/Portfolio.db   # adapter le chemin
turso db show portfolio                  # copier l'URL
turso db tokens create portfolio         # copier le token
```

### 3. Déployer sur Vercel
- Aller sur vercel.com → New Project → importer le repo GitHub
- Dans **Environment Variables**, ajouter :
  ```
  TURSO_DATABASE_URL = libsql://portfolio-xxxx.turso.io
  TURSO_AUTH_TOKEN   = eyJhb...
  APP_PASSWORD       = MonMotDePasse123
  ```
- Cliquer **Deploy**

### 4. Accéder à l'app
- URL : `https://portfolio-tracker-xxx.vercel.app`
- Mot de passe : celui défini dans `APP_PASSWORD`

## Développement local
```bash
npm install
cp .env.local.example .env.local   # remplir les valeurs
npm run dev                         # http://localhost:3000
```
