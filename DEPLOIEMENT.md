# ✦ Guide de déploiement — Fiona Consultation

## Vue d'ensemble
Stack : Next.js · Firebase · Stripe · Vercel

---

## ÉTAPE 1 — Firebase

### 1.1 Créer le projet Firebase
1. Va sur https://console.firebase.google.com
2. Clique "Ajouter un projet" → nomme-le `fiona-consultation`
3. Désactive Google Analytics (pas nécessaire)

### 1.2 Activer Authentication
1. Dans le menu gauche → Authentication → Commencer
2. Onglet "Sign-in method" → Active **Email/Password**

### 1.3 Créer Firestore
1. Dans le menu gauche → Firestore Database → Créer une base de données
2. Choisis **Mode production**
3. Région : `europe-west3` (Frankfurt, proche de la France)

### 1.4 Déployer les règles Firestore
```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Connexion
firebase login

# Initialiser dans le dossier du projet
firebase init firestore

# Déployer les règles
firebase deploy --only firestore:rules
```

### 1.5 Configurer Firebase Cloud Messaging (notifications push)
1. Dans le projet Firebase → Paramètres du projet (⚙️)
2. Onglet "Cloud Messaging"
3. Dans "Configuration Web Push" → **Générer une paire de clés**
4. Copie la clé VAPID → ce sera `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

### 1.6 Récupérer les clés Firebase
1. Paramètres du projet → "Vos applications" → Ajoute une app Web
2. Copie les valeurs dans `.env.local`

### 1.7 Récupérer les clés Admin Firebase (pour les notifications push serveur)
1. Paramètres du projet → Comptes de service
2. Clique "Générer une nouvelle clé privée"
3. Ouvre le fichier JSON téléchargé et note :
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY`

### 1.8 Créer ton compte admin
Après la première inscription avec ton email de consultante :
1. Va dans Firestore → Collection `users`
2. Trouve ton document (ton UID)
3. Ajoute le champ : `role` = `"admin"`

---

## ÉTAPE 2 — Stripe

### 2.1 Récupérer tes clés
1. https://dashboard.stripe.com/apikeys
2. Copie **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Copie **Secret key** → `STRIPE_SECRET_KEY`

### 2.2 Configurer le Webhook Stripe
1. Dashboard Stripe → Développeurs → Webhooks
2. "Ajouter un endpoint"
3. URL : `https://TON-DOMAINE.vercel.app/api/stripe-webhook`
4. Événements à écouter :
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Copie le **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### 2.3 Test en local avec Stripe CLI
```bash
# Installer Stripe CLI
brew install stripe/stripe-cli/stripe

# Connexion
stripe login

# Écouter les webhooks en local
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

---

## ÉTAPE 3 — Déploiement sur Vercel

### 3.1 Préparer le code
```bash
# Dans le dossier du projet
git init
git add .
git commit -m "Initial commit"

# Crée un repo GitHub et pousse
git remote add origin https://github.com/TON_USERNAME/fiona-consultation.git
git push -u origin main
```

### 3.2 Déployer sur Vercel
1. Va sur https://vercel.com → "New Project"
2. Importe ton repo GitHub
3. Framework : **Next.js** (détecté automatiquement)
4. Dans "Environment Variables", ajoute TOUTES les variables de `.env.local.example`

### 3.3 Variables à configurer dans Vercel
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_VAPID_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_APP_URL          ← ton URL Vercel, ex: https://fiona-consultation.vercel.app
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
ADMIN_EMAIL                  ← ton email de consultante
```

### 3.4 Domaine personnalisé (optionnel)
1. Dans Vercel → Settings → Domains
2. Ajoute ton domaine (ex: fiona-consultation.fr)
3. Configure les DNS chez ton registrar

---

## ÉTAPE 4 — Test complet

### Checklist de test
- [ ] Inscription avec un email test
- [ ] Connexion / déconnexion
- [ ] Remplir le formulaire de réservation
- [ ] Paiement Stripe en mode test (carte : 4242 4242 4242 4242)
- [ ] Vérifier que la consultation apparaît dans Firestore
- [ ] Ouvrir le chat → chronomètre démarre
- [ ] Envoyer un message
- [ ] Vérifier que l'admin reçoit le message
- [ ] L'admin répond → le client voit la réponse en temps réel
- [ ] Tester les alertes timer (5 min, 2 min, 30 sec)
- [ ] Tester "Ajouter du temps"
- [ ] Vérifier l'historique

### Cartes de test Stripe
- Succès : `4242 4242 4242 4242`
- Refusée : `4000 0000 0000 0002`
- 3D Secure : `4000 0025 0000 3155`

---

## ÉTAPE 5 — Post-déploiement

### Mettre à jour l'URL du webhook Stripe
Après déploiement, mets à jour l'URL dans Stripe Dashboard avec ton vrai domaine Vercel.

### Ajouter le son de notification
Place un fichier `notification.mp3` dans `/public/`
(son court et discret, ex: ding)

### Icônes PWA
Place dans `/public/icons/` :
- `icon-192.png` (192×192px)
- `icon-512.png` (512×512px)
- `badge-72.png` (72×72px, monochrome)

---

## Structure Firestore finale

```
consultations/
  {sessionId}/
    userId, prenom, domaine, sujet, message
    minutes, tarif, montantPaye
    statut: "pending" | "active" | "terminee"
    secondesRestantes, debutAt, payeAt
    messagesNonLus, lastMessage
    messages/ (sous-collection)
      {messageId}/
        texte, auteur, type, createdAt, lu

users/
  {uid}/
    prenom, email, role, fcmToken
    bloque, createdAt, consultationActive
```

---

## Support
En cas de problème : vérifie les logs dans Vercel (Functions tab) et Firebase Console.
