# Solutions Frontend pour le Suivi des Transferts en Masse

## Problème
Le frontend fait un appel GET à un moment T et peut voir des transactions encore en PENDING, donnant l'impression que les transferts sont bloqués indéfiniment.

## Solutions Disponibles

---

## **Solution 1: Server-Sent Events (SSE) - RECOMMANDÉ**

Le backend envoie automatiquement des mises à jour au frontend en temps réel.

### Endpoint
```
GET /api/bulk-transfers/{bulk_id}/stream
```

### Avantages
- Mises à jour en temps réel automatiques
- Pas de polling côté client
- Connexion se ferme automatiquement quand c'est terminé
- Bande passante optimale

### Frontend JavaScript

```javascript
// Créer le transfert
const createBulkTransfer = async (file, payerAccount) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('payer_account', payerAccount);
  
  const response = await fetch('http://localhost:8000/api/bulk-transfers', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  return result.bulkTransferId;
};

// Suivre en temps réel avec SSE
const monitorWithSSE = (bulkId, onProgress, onComplete, onError) => {
  const eventSource = new EventSource(
    `http://localhost:8000/api/bulk-transfers/${bulkId}/stream`
  );
  
  // Mise à jour de progression
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onProgress(data);
    /*
    data = {
      bulkTransferId: "bulk-xxx",
      state: "PROCESSING",
      total: 90,
      completed: 45,
      failed: 0,
      pending: 45,
      progress_percent: 50.0
    }
    */
  };
  
  // Transfert terminé
  eventSource.addEventListener('done', (event) => {
    const data = JSON.parse(event.data);
    eventSource.close();
    onComplete(data);
  });
  
  // Erreur
  eventSource.addEventListener('error', (event) => {
    if (event.data) {
      const data = JSON.parse(event.data);
      onError(data);
    } else {
      onError({ error: 'Connection error' });
    }
    eventSource.close();
  });
  
  return eventSource; // Pour pouvoir fermer manuellement si besoin
};

// Utilisation complète
const handleFileUpload = async (file) => {
  try {
    // 1. Créer le transfert
    const bulkId = await createBulkTransfer(file, 'PAYER-001');
    console.log('Bulk créé:', bulkId);
    
    // 2. Suivre en temps réel
    const eventSource = monitorWithSSE(
      bulkId,
      
      // onProgress - appelé à chaque mise à jour
      (data) => {
        console.log(`Progression: ${data.progress_percent}%`);
        console.log(`Complétés: ${data.completed}/${data.total}`);
        
        // Mettre à jour l'UI
        updateProgressBar(data.completed, data.total);
        updateStatusText(data.state);
      },
      
      // onComplete - appelé quand c'est fini
      (data) => {
        console.log('Transfert terminé:', data.state);
        
        if (data.state === 'COMPLETED') {
          showSuccess('Tous les transferts ont réussi!');
        } else if (data.state === 'PARTIALLY_COMPLETED') {
          showWarning('Certains transferts ont échoué');
        } else {
          showError('Tous les transferts ont échoué');
        }
        
        // Récupérer les détails finaux si besoin
        fetchFinalDetails(bulkId);
      },
      
      // onError
      (error) => {
        console.error('Erreur:', error);
        showError(error.error || 'Erreur de connexion');
      }
    );
    
    // Pour annuler manuellement
    // eventSource.close();
    
  } catch (error) {
    console.error('Erreur upload:', error);
  }
};

// Récupérer les détails finaux si besoin
const fetchFinalDetails = async (bulkId) => {
  const response = await fetch(
    `http://localhost:8000/api/bulk-transfers/${bulkId}/status`
  );
  const details = await response.json();
  
  // Afficher les transferts réussis et échoués
  const succeeded = details.individualTransfers.filter(t => t.status === 'COMPLETED');
  const failed = details.individualTransfers.filter(t => t.status === 'FAILED');
  
  console.log('Réussis:', succeeded.length);
  console.log('Échoués:', failed.length);
  
  return { succeeded, failed };
};
```

### Frontend React

```jsx
import React, { useState, useEffect } from 'react';

const BulkTransferMonitor = ({ bulkId }) => {
  const [progress, setProgress] = useState({
    state: 'PENDING',
    completed: 0,
    total: 0,
    failed: 0,
    progress_percent: 0
  });
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const eventSource = new EventSource(
      `http://localhost:8000/api/bulk-transfers/${bulkId}/stream`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);
    };

    eventSource.addEventListener('done', (event) => {
      const data = JSON.parse(event.data);
      setIsDone(true);
      eventSource.close();
    });

    eventSource.addEventListener('error', (event) => {
      if (event.data) {
        const data = JSON.parse(event.data);
        setError(data.error);
      }
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [bulkId]);

  if (error) {
    return <div className="error">Erreur: {error}</div>;
  }

  return (
    <div className="transfer-monitor">
      <h3>Transfert {bulkId}</h3>
      
      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${progress.progress_percent}%` }}
        />
      </div>
      
      <p>État: {progress.state}</p>
      <p>Progression: {progress.completed}/{progress.total}</p>
      <p>Échoués: {progress.failed}</p>
      <p>Pourcentage: {progress.progress_percent}%</p>
      
      {isDone && (
        <div className="success">
          {progress.state === 'COMPLETED' && '✓ Tous les transferts réussis!'}
          {progress.state === 'PARTIALLY_COMPLETED' && '⚠ Transfert partiellement complété'}
          {progress.state === 'FAILED' && '✗ Tous les transferts ont échoué'}
        </div>
      )}
    </div>
  );
};

export default BulkTransferMonitor;
```

---

## **Solution 2: Endpoint Bloquant (Wait)**

Le backend attend la fin du traitement avant de répondre.

### Endpoint
```
GET /api/bulk-transfers/{bulk_id}/wait?timeout=300
```

### Avantages
- Simple à utiliser (un seul appel)
- Pas de gestion de connexion persistante
- Idéal pour workflows synchrones

### Inconvénients
- Pas de mise à jour de progression
- Connexion HTTP longue
- Timeout possible si traitement trop long

### Frontend JavaScript

```javascript
const waitForCompletion = async (bulkId, timeout = 300) => {
  try {
    const response = await fetch(
      `http://localhost:8000/api/bulk-transfers/${bulkId}/wait?timeout=${timeout}`
    );
    
    if (response.status === 408) {
      const data = await response.json();
      console.warn('Timeout:', data.message);
      console.log('Progression actuelle:', data.current_progress);
      return { timeout: true, progress: data.current_progress };
    }
    
    const result = await response.json();
    return result;
    
  } catch (error) {
    console.error('Erreur:', error);
    throw error;
  }
};

// Utilisation
const handleFileUpload = async (file) => {
  try {
    // 1. Créer le transfert
    const formData = new FormData();
    formData.append('file', file);
    formData.append('payer_account', 'PAYER-001');
    
    const response = await fetch('http://localhost:8000/api/bulk-transfers', {
      method: 'POST',
      body: formData
    });
    const { bulkTransferId } = await response.json();
    
    console.log('Transfert créé, attente de la fin...');
    showLoadingSpinner('Traitement en cours...');
    
    // 2. Attendre la fin (max 5 minutes)
    const result = await waitForCompletion(bulkTransferId, 300);
    
    hideLoadingSpinner();
    
    if (result.timeout) {
      showWarning('Le traitement prend plus de temps que prévu');
      // Fallback: polling manuel
      pollStatus(bulkTransferId);
    } else {
      // C'est terminé!
      if (result.state === 'COMPLETED') {
        showSuccess(`${result.completed_count} transferts réussis!`);
      } else if (result.state === 'PARTIALLY_COMPLETED') {
        showWarning(
          `${result.completed_count} réussis, ${result.failed_count} échoués`
        );
      } else {
        showError('Tous les transferts ont échoué');
      }
      
      displayResults(result.individualTransfers);
    }
    
  } catch (error) {
    hideLoadingSpinner();
    showError('Erreur: ' + error.message);
  }
};
```

---

## **Solution 3: Polling Intelligent**

Le frontend fait des appels GET périodiques, mais s'arrête quand c'est fini.

### Endpoint (existant)
```
GET /api/bulk-transfers/{bulk_id}/status
```

### Avantages
- Compatible avec tous les navigateurs (même anciens)
- Pas de connexion persistante
- Flexible

### Inconvénients
- Plus de requêtes HTTP
- Latence entre les mises à jour

### Frontend JavaScript

```javascript
const pollUntilComplete = async (bulkId, interval = 2000, maxAttempts = 150) => {
  let attempts = 0;
  
  return new Promise((resolve, reject) => {
    const intervalId = setInterval(async () => {
      try {
        attempts++;
        
        const response = await fetch(
          `http://localhost:8000/api/bulk-transfers/${bulkId}/status`
        );
        const data = await response.json();
        
        // Calculer l'état
        const total = data.individualTransfers.length;
        const completed = data.individualTransfers.filter(
          t => t.status === 'COMPLETED'
        ).length;
        const failed = data.individualTransfers.filter(
          t => t.status === 'FAILED'
        ).length;
        const pending = total - completed - failed;
        
        // Callback de progression
        const progressPercent = ((completed + failed) / total) * 100;
        console.log(`Progression: ${progressPercent.toFixed(1)}%`);
        updateProgressBar(completed + failed, total);
        
        // Vérifier si terminé
        if (pending === 0) {
          clearInterval(intervalId);
          
          let finalState;
          if (failed === 0) {
            finalState = 'COMPLETED';
          } else if (completed === 0) {
            finalState = 'FAILED';
          } else {
            finalState = 'PARTIALLY_COMPLETED';
          }
          
          resolve({
            ...data,
            state: finalState,
            completed_count: completed,
            failed_count: failed,
            pending_count: 0
          });
        }
        
        // Vérifier timeout
        if (attempts >= maxAttempts) {
          clearInterval(intervalId);
          reject(new Error('Timeout: le transfert prend trop de temps'));
        }
        
      } catch (error) {
        clearInterval(intervalId);
        reject(error);
      }
    }, interval);
  });
};

// Utilisation
const handleFileUpload = async (file) => {
  try {
    // 1. Créer le transfert
    const formData = new FormData();
    formData.append('file', file);
    formData.append('payer_account', 'PAYER-001');
    
    const response = await fetch('http://localhost:8000/api/bulk-transfers', {
      method: 'POST',
      body: formData
    });
    const { bulkTransferId } = await response.json();
    
    console.log('Transfert créé:', bulkTransferId);
    
    // 2. Polling jusqu'à la fin (vérifier toutes les 2 secondes, max 5 minutes)
    const result = await pollUntilComplete(bulkTransferId, 2000, 150);
    
    // 3. Afficher le résultat
    if (result.state === 'COMPLETED') {
      showSuccess(`${result.completed_count} transferts réussis!`);
    } else if (result.state === 'PARTIALLY_COMPLETED') {
      showWarning(
        `${result.completed_count} réussis, ${result.failed_count} échoués`
      );
    } else {
      showError('Tous les transferts ont échoué');
    }
    
    displayResults(result.individualTransfers);
    
  } catch (error) {
    showError('Erreur: ' + error.message);
  }
};
```

---

## **Comparaison des Solutions**

| Critère | SSE (Stream) | Wait (Bloquant) | Polling |
|---------|--------------|-----------------|---------|
| Temps réel | ✓✓✓ Excellent | ✗ Non | ✓ Bon |
| Progression visible | ✓✓✓ Oui | ✗ Non | ✓✓ Oui |
| Simplicité | ✓✓ Moyen | ✓✓✓ Simple | ✓ Complexe |
| Requêtes HTTP | ✓✓✓ 1 seule | ✓✓✓ 1 seule | ✗ Multiples |
| Timeout | ✓✓ Géré | ✓ Configurable | ✓✓ Flexible |
| Compatibilité | ✓✓ Moderne | ✓✓✓ Universel | ✓✓✓ Universel |

---

## **Recommandation**

**Pour une application moderne:** Utilisez **SSE (Solution 1)**
- Meilleure expérience utilisateur
- Mises à jour en temps réel
- Économie de bande passante

**Pour une application simple:** Utilisez **Wait (Solution 2)**
- Code minimal
- Pas de gestion de connexion
- Idéal si les transferts sont rapides (< 2 minutes)

**Pour compatibilité maximale:** Utilisez **Polling (Solution 3)**
- Fonctionne partout
- Flexibilité totale
- Fallback recommandé pour les autres solutions

---

## **Test avec curl**

### SSE Stream
```bash
curl -N http://localhost:8000/api/bulk-transfers/bulk-075c246d43c9/stream
```

### Wait (bloquant)
```bash
curl "http://localhost:8000/api/bulk-transfers/bulk-075c246d43c9/wait?timeout=120"
```

### Status (polling)
```bash
curl http://localhost:8000/api/bulk-transfers/bulk-075c246d43c9/status
```
