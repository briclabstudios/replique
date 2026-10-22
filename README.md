# Réplique

PWA pour apprendre son texte de théâtre : on importe une pièce depuis Google Docs, l'app détecte les
personnages, actes et scènes, puis des voix de synthèse jouent les partenaires et attendent que vous
disiez vos répliques (reconnaissance vocale).

**Stack** : Vite + React + TypeScript, Supabase (Postgres + fonctions edge), hébergement GitHub Pages.

## Format du texte source

- Le Google Doc doit être partagé à « Tous les utilisateurs disposant du lien ».
- Le nom du personnage qui parle est en **MAJUSCULES** en début de paragraphe :
  `HARPAGON. – Texte`, `HARPAGON : Texte`, ou `HARPAGON` seul puis la réplique au paragraphe suivant.
- Le texte en *italique* (didascalies) est ignoré, entre les répliques ou au milieu.
- Les titres `ACTE I` / `ACTE PREMIER` et `SCÈNE 2` / `SCÈNE PREMIÈRE` structurent la pièce.
- Une liste `PERSONNAGES` avant le premier acte sert de distribution (descriptions, genre de la voix).

## Mise en place

### 1. Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Exécuter `supabase/migrations/20261021000000_init.sql` dans le SQL Editor (ou `supabase db push`).
3. Déployer les fonctions edge (avec la [CLI Supabase](https://supabase.com/docs/guides/cli)) :

   ```bash
   supabase link --project-ref <ref-du-projet>
   supabase functions deploy fetch-gdoc --no-verify-jwt
   supabase functions deploy tts --no-verify-jwt
   ```

4. Pour les voix OpenAI (facultatif) : `supabase secrets set OPENAI_API_KEY=sk-...`,
   puis choisir « OpenAI TTS » dans la page Administration de l'app.

### 2. En local

L'URL et la clé publishable du projet Supabase sont dans `src/lib/supabase.ts` (clé publique,
protégée par les règles RLS). Pour pointer vers un autre projet, créer un `.env.local` (voir `.env.example`).

```bash
npm install
npm run dev
```

En développement, les Google Docs sont téléchargés via le proxy Vite : la fonction `fetch-gdoc`
n'est nécessaire qu'en production.

### 3. GitHub Pages

1. *Settings › Pages* : source « GitHub Actions ».
2. Chaque push sur `main` lance les tests, le build et le déploiement.

## Données

- Texte, personnages, actes, scènes et répliques sont stockés dans Supabase : tout le monde répète
  sur la même version, et les corrections faites en mode « Éditer » sont partagées.
- **Mon rôle** et la **progression** (« En cours ») sont propres à chaque appareil (`localStorage`).
- Il n'y a pas de comptes : quiconque a l'URL de l'app peut modifier les pièces.

## Statistiques

Chaque ouverture de l'app (nouvelle session après 30 min) ajoute une ligne dans la table `visits` :
identifiant aléatoire de l'appareil, fuseau horaire, langue, type d'appareil, système, navigateur,
appli installée ou non. Aucune adresse IP n'est stockée. Le tableau de bord est à l'adresse
`…/#/dashboard`, sans lien dans l'app ; il lit des agrégats via la fonction `visit_stats`.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | serveur de développement |
| `npm test` | tests du parser et de la reconnaissance |
| `npm run build` | vérification TypeScript + build PWA dans `dist/` |
