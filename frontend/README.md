# Frontend - Plateforme de Paiement de Pensions

Ce dossier contient le code source de l'interface utilisateur (Frontend) de la plateforme de paiement de pensions.

## Guide d'Utilisation du Frontend

### Prérequis
- Node.js (v18+)
- Backend Django en cours d'exécution sur `http://localhost:8000`

### Installation et Démarrage

1.  **Installer les dépendances :**
    ```bash
    npm install
    ```

2.  **Démarrer le serveur de développement :**
    ```bash
    npm run dev
    ```
    L'application sera accessible sur `http://localhost:5173`.

### Fonctionnalités Principales

-   **Authentification** : Connexion sécurisée pour accéder au tableau de bord.
-   **Tableau de Bord** : Vue d'ensemble des transferts et de l'état du système.
-   **Import CSV** : Chargement de fichiers CSV pour les paiements de masse.
-   **Suivi en Temps Réel** : Visualisation de la progression des transferts via SSE (Server-Sent Events).
-   **Rapports** : Téléchargement des résultats des transactions.

---

## Guide d'Utilisation Général de l'Application

### 1. Authentification

L'accès à la plateforme est sécurisé. Vous devez vous connecter avec vos identifiants.

-   **Page de Connexion** : Entrez votre nom d'utilisateur et votre mot de passe.
-   **Identifiants par défaut** (pour le développement) :
    -   Username: `gestionnaire`
    -   Password: `Pensions2025!`
-   **Déconnexion** : Cliquez sur le bouton de déconnexion dans la barre de navigation pour quitter votre session.

### 2. Effectuer un Paiement de Masse (Bulk Transfer)

1.  **Préparer le fichier CSV** :
    Le fichier doit respecter le format suivant (avec en-têtes) :
    ```csv
    type_id,valeur_id,devise,montant
    MSISDN,22890123456,XOF,10000
    MSISDN,22890654321,XOF,5000
    ```

2.  **Importer le fichier** :
    -   Sur le tableau de bord, cliquez sur la zone d'upload ou glissez-déposez votre fichier CSV.
    -   Vérifiez le nom et la taille du fichier.

3.  **Lancer le traitement** :
    -   Cliquez sur le bouton **"Lancer le traitement"**.
    -   Le système va créer un transfert de masse et commencer à traiter chaque ligne.

4.  **Suivi de la progression** :
    -   Une barre de progression s'affiche pour indiquer l'avancement.
    -   Le tableau des résultats se met à jour en temps réel au fur et à mesure que les transactions sont traitées.
    -   Vous verrez le statut de chaque transaction (SUCCESS, FAILED, PENDING).

### 3. Consulter et Exporter les Résultats

-   **Filtrer et Rechercher** : Utilisez la barre de recherche ou le filtre de statut pour trouver des transactions spécifiques.
-   **Télécharger le Rapport** : Une fois le traitement terminé (ou même pendant), vous pouvez cliquer sur **"Télécharger le rapport"** pour obtenir un fichier CSV contenant les résultats détaillés de toutes les transactions affichées.

### 4. Gestion des Erreurs

-   Si une erreur survient lors de l'upload ou du traitement, un message d'erreur s'affichera en rouge.
-   En cas de déconnexion ou d'expiration de session, vous serez redirigé vers la page de connexion. Le système gère automatiquement le rafraîchissement des tokens.
