# Journal del Rey — Trading Pro Lab
## Guía de instalación completa

---

## ¿Qué es esto?

Una aplicación web privada para que tus Reyes y Príncipes trackeen sus cuentas de trading (fondeo o capital propio), registren cada operación en un journal, y vean más de 70 métricas automáticas. Tú controlas quién tiene acceso desde un panel de administración con modo espectador.

---

## Estructura de archivos

```
journalderey/
├── index.html          ← Login y registro
├── cuentas.html        ← Vista de todas las cuentas del usuario
├── nueva-cuenta.html   ← Crear una cuenta nueva
├── dashboard.html      ← Dashboard + Journal de cada cuenta
├── admin.html          ← Tu panel de control (solo tú)
├── perfil.html         ← Perfil del trader
├── styles.css          ← Sistema de diseño completo
├── firestore.rules     ← Reglas de seguridad (pegar en Firebase)
└── assets/
    ├── logo-blanco.png
    └── logo-negro.png
```

---

## PASO 1 — Crear proyecto en Firebase

1. Ve a **https://console.firebase.google.com**
2. Haz clic en **"Agregar proyecto"**
3. Nombre: `journal-del-rey` (o el que prefieras)
4. Desactiva Google Analytics (no lo necesitas)
5. Haz clic en **"Crear proyecto"**

---

## PASO 2 — Activar Authentication

1. En el menú lateral → **Authentication**
2. Haz clic en **"Comenzar"**
3. Ve a la pestaña **"Sign-in method"**
4. Habilita **"Correo electrónico/contraseña"**
5. Guarda

---

## PASO 3 — Crear base de datos Firestore

1. En el menú lateral → **Firestore Database**
2. Haz clic en **"Crear base de datos"**
3. Selecciona **"Comenzar en modo de producción"**
4. Elige la región más cercana (ej: `us-central1`)
5. Haz clic en **"Listo"**

### Pegar las reglas de seguridad:

1. Ve a la pestaña **"Reglas"**
2. Borra el contenido existente
3. Copia TODO el contenido del archivo `firestore.rules`
4. Pégalo en el editor
5. **IMPORTANTE**: Reemplaza `TU_UID_ADMIN` con tu UID real (lo obtienes en el PASO 5)
6. Haz clic en **"Publicar"**

---

## PASO 4 — Activar Storage (para screenshots)

1. En el menú lateral → **Storage**
2. Haz clic en **"Comenzar"**
3. Selecciona **"Comenzar en modo de producción"**
4. Elige la misma región que Firestore
5. En la pestaña **"Reglas"**, reemplaza el contenido con:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{uid}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

6. Publica las reglas

---

## PASO 5 — Obtener credenciales

1. En Firebase Console → **Configuración del proyecto** (ícono ⚙️)
2. Baja hasta **"Tus apps"**
3. Haz clic en **"</>"** (Web)
4. Nombre de la app: `journal-del-rey`
5. **NO** marques Firebase Hosting
6. Haz clic en **"Registrar app"**
7. Copia el objeto `firebaseConfig` que aparece

---

## PASO 6 — Pegar credenciales en los archivos HTML

Abre cada uno de estos archivos y busca el bloque:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  ...
};
```

Reemplázalo con tus credenciales reales. Lo debes hacer en:

- `index.html`
- `cuentas.html`
- `nueva-cuenta.html`
- `dashboard.html`
- `admin.html`
- `perfil.html`

---

## PASO 7 — Obtener tu UID de Admin

1. Sube los archivos a GitHub (PASO 8)
2. Abre la app en el navegador
3. Regístrате con TU correo (el de Williams)

   > En este momento no habrá lista blanca, así que el registro fallará.
   > **Solución temporal**: en `index.html`, comenta temporalmente las líneas de verificación de lista blanca (marcadas con `// Verificar si el email está en la lista blanca`), sube de nuevo, regístrate, y luego restaura el código.

4. Ve a Firebase Console → **Authentication → Users**
5. Copia tu **UID** (la columna "User UID")
6. Pega ese UID en:
   - Todos los archivos donde dice `const ADMIN_UID = "TU_UID_ADMIN"`
   - En `firestore.rules` donde dice `"TU_UID_ADMIN"`
7. Vuelve a publicar las reglas

---

## PASO 8 — Subir a GitHub Pages

### Primera vez:

1. Crea una cuenta en **https://github.com** si no tienes
2. Crea un repositorio nuevo llamado `journalderey`
3. Marca como **Público**
4. Sube todos los archivos

### Con GitHub Desktop (más fácil):

1. Descarga **GitHub Desktop**: https://desktop.github.com
2. File → New Repository → nombre: `journalderey`
3. Arrastra todos los archivos al repositorio
4. Commit: "Initial commit - Journal del Rey"
5. Push to origin

### Activar GitHub Pages:

1. Ve a tu repositorio en github.com
2. Settings → Pages
3. Source: **Deploy from a branch**
4. Branch: **main**, folder: **/(root)**
5. Guarda

Tu app estará disponible en:
`https://TU_USUARIO.github.io/journalderey`

---

## PASO 9 — Agregar tu primer Rey

1. Abre `https://TU_USUARIO.github.io/journalderey/admin.html`
2. Inicia sesión con tu cuenta
3. Ve a la pestaña **"Lista Blanca"**
4. Agrega el correo del alumno
5. El alumno ya puede registrarse en `index.html`

---

## Acceso al admin

Solo tú puedes acceder a:
`https://TU_USUARIO.github.io/journalderey/admin.html`

Si alguien más intenta entrar, es redirigido automáticamente.

---

## Costos (todo gratis)

| Servicio | Plan | Límite gratuito |
|---|---|---|
| Firebase Auth | Spark (gratis) | 10,000 usuarios/mes |
| Firestore | Spark (gratis) | 50,000 lecturas/día |
| Storage | Spark (gratis) | 5 GB almacenamiento |
| GitHub Pages | Gratis | Sin límite |

Para una academia pequeña/mediana, el plan gratuito de Firebase es más que suficiente.

---

## Soporte

Cualquier problema con la configuración, contacta a Williams directamente.

**Trading Pro Lab © 2024**
