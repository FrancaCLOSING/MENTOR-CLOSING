# MENTOR — Guide de déploiement (10 min)

## Ce que tu vas avoir

- App Next.js déployée sur Vercel (gratuit)
- Base de données Supabase (gratuit)
- Voix Whisper (OpenAI, ~0.006$/min)
- Prof IA Claude Sonnet (~5-10€/mois à usage intensif)
- Clés API sécurisées côté serveur

---

## Étape 1 — Créer les comptes (5 min)

### Anthropic (pour le prof IA)
1. Va sur https://console.anthropic.com
2. Créer un compte → API Keys → Create Key
3. Copie la clé (commence par `sk-ant-`)

### OpenAI (pour la voix Whisper)
1. Va sur https://platform.openai.com
2. API Keys → Create new secret key
3. Copie la clé (commence par `sk-`)
4. Ajoute ~5$ de crédit (suffira plusieurs mois)

### Supabase (base de données)
1. Va sur https://supabase.com → New project
2. Choisis un nom (ex: mentor-closing), un mot de passe fort, région Europe West
3. Attends ~2 min que le projet se crée
4. Va dans Settings → API → copie :
   - `Project URL` (commence par https://)
   - `anon public` key
   - `service_role` key (⚠️ garde secret)
5. Va dans SQL Editor → colle le contenu de `supabase-schema.sql` → Run

### GitHub (pour déployer)
1. Va sur https://github.com → New repository
2. Nom : `mentor-closing`, Public ou Private (peu importe)
3. Garde l'onglet ouvert

---

## Étape 2 — Pousser le code sur GitHub (2 min)

Ouvre un terminal dans le dossier de l'app et exécute :

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TON-USERNAME/mentor-closing.git
git push -u origin main
```

---

## Étape 3 — Déployer sur Vercel (3 min)

1. Va sur https://vercel.com → Sign up with GitHub
2. New Project → Import `mentor-closing`
3. Dans "Environment Variables", ajoute ces 5 variables :

| Nom | Valeur |
|-----|--------|
| `ANTHROPIC_API_KEY` | ta clé Anthropic |
| `OPENAI_API_KEY` | ta clé OpenAI |
| `NEXT_PUBLIC_SUPABASE_URL` | ton URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ta clé anon Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ta clé service_role Supabase |

4. Deploy → attends ~2 min
5. Vercel te donne une URL du type `mentor-closing-xxx.vercel.app`

**C'est en ligne.** Ouvre l'URL, c'est prêt.

---

## Utilisation quotidienne

### Entraînement normal
→ Ouvre l'app → "Continuer le cours" ou "Session du jour"

### Mode vocal
→ Dans n'importe quel chat, clique sur 🎙️ pour parler
→ Whisper transcrit en français automatiquement
→ La réponse part au prof

### Analyser un vrai call
→ "Analyser un call" → colle le transcript → Analyser
→ Erreurs récurrentes mémorisées automatiquement

### Call complet simulé
→ "Call complet" → choisis un persona → l'app simule un vrai appel de A à Z

---

## Coûts estimés

| Service | Usage intense (1h/jour) | Usage modéré (20min/jour) |
|---------|------------------------|--------------------------|
| Anthropic Claude | ~12€/mois | ~4€/mois |
| OpenAI Whisper | ~2€/mois | ~0.5€/mois |
| Vercel | Gratuit | Gratuit |
| Supabase | Gratuit | Gratuit |
| **Total** | **~14€/mois** | **~4.5€/mois** |

---

## Mettre à jour l'app

Si tu veux modifier quelque chose (contenu, design, etc.) :
1. Modifie les fichiers
2. `git add . && git commit -m "update" && git push`
3. Vercel redéploie automatiquement en ~1 min

---

## Problèmes courants

**L'app ne charge pas**
→ Vérifie dans Vercel → Functions que les routes API n'ont pas d'erreur

**La voix ne fonctionne pas**
→ Le navigateur demande l'accès au micro — autorise-le
→ Vérifie que `OPENAI_API_KEY` est bien configurée

**"Erreur API"**
→ Vérifie que `ANTHROPIC_API_KEY` est correcte dans Vercel → Settings → Environment Variables

**Les données ne persistent pas**
→ Vérifie que le schéma SQL a bien été exécuté dans Supabase
