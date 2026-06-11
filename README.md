# Songo — Implémentation numérique
Règles officielles : https://www.clubawale.com/post/comment-jouer-le-songo

## Contenu
```
songo_local.html          ← Version locale  (ouvrir directement dans le navigateur)
songo_distant/
  ├── app.py              ← Serveur Flask
  ├── requirements.txt
  └── templates/
      └── index.html      ← Interface cliente Ajax
```

## Version locale
Ouvrir `songo_local.html` dans n'importe quel navigateur. Aucune installation requise.

## Version distante (Flask + Ajax)

### Installation
```bash
cd songo_distant
pip install -r requirements.txt
python app.py
```

### Utilisation
1. Le serveur démarre sur `http://0.0.0.0:5000`
2. **Joueur 1** : ouvrir `http://<IP_SERVEUR>:5000` → cliquer "Créer une nouvelle partie"
3. **Joueur 2** : ouvrir `http://<IP_SERVEUR>:5000` → entrer le code → cliquer "Rejoindre"

### API REST
| Méthode | Route                | Corps JSON          | Description                     |
|---------|----------------------|---------------------|---------------------------------|
| POST    | /api/creer           | —                   | Crée une partie, retourne game_id |
| POST    | /api/rejoindre/:id   | —                   | Rejoindre une partie             |
| GET     | /api/etat/:id        | —                   | État du plateau (polling 1s)     |
| POST    | /api/jouer/:id       | {player, col}       | Jouer un coup                    |
