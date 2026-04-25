import os

# Define the content for the Markdown file
markdown_content = """# Especificación Técnica: Zapatean2 PWA (MVP)

Este documento detalla la arquitectura, el stack tecnológico y la estrategia de diseño para el desarrollo de **Zapatean2**, una Progressive Web App (PWA) optimizada para mensajería y rutas en Cuba, con foco inicial en La Habana y Matanzas.

---

## 1. Arquitectura y Stack Tecnológico (The Senior Stack)

Para garantizar un rendimiento excepcional en dispositivos móviles con conectividad variable, se ha seleccionado un stack moderno, tipado y eficiente.

### Gestión de Paquetes y Entorno
* **Package Manager:** `pnpm`. Elegido por su velocidad, eficiencia en el uso de disco y gestión estricta de dependencias (evitando dependencias fantasma).
* **Lenguaje:** `TypeScript (TS)`. Indispensable para un proyecto de este tipo. Garantiza la integridad de los datos de rutas y coordenadas mediante interfaces y tipos personalizados.

### Framework Core
* **Framework:** `Astro`. 
    * **Arquitectura de Islas:** Permite que el mapa (Leaflet) sea una isla interactiva hidratada solo en el cliente, manteniendo el resto de la UI estática y ultrarrápida.
    * **SSR/Static:** Generación estática para las vistas de información y Server-Side Rendering para cálculos dinámicos si fuera necesario.
* **Styling:** `Tailwind CSS`. Para un desarrollo de UI atómico, consistente y con un bundle de CSS mínimo gracias a su purga de estilos.

### Ecosistema de Mapas y Rutas
* **Map Engine:** `Leaflet.js`. Librería Open Source de bajo peso (aprox. 39KB gzipped) que ofrece toda la potencia necesaria para móviles sin las restricciones de costos de Google Maps o Mapbox.
* **Data Provider:** `OpenStreetMap (OSM)`. Datos cartográficos abiertos.
* **Routing Engine:** `OpenRouteService (ORS)` o `OSRM`. APIs gratuitas para el cálculo de rutas polilíneas basadas en perfiles de transporte (bicicleta, pie, coche).
* **Capa de Estilo de Mapa:** `CartoDB Positron/Dark Matter`. Tiles vectoriales gratuitos que ofrecen una estética limpia, permitiendo que los elementos de mensajería (puntos de entrega) resalten sobre el mapa.

### PWA y Persistencia
* **Offline/Service Workers:** `Workbox`. Integrado en el flujo de build para cachear activos estáticos y, lo más importante, los tiles del mapa en las zonas activas.
* **State Management:** `Nanostores`. Micro-gestor de estado compartido para Astro, ideal para coordinar la posición del usuario y los parámetros de ruta entre componentes de diferentes frameworks.

---

## 2. Estrategia UI/UX: Enfoque en el Operador de Ruta

La interfaz está diseñada para ser operada en condiciones de movilidad extrema (alta luz solar, uso con una sola mano, batería limitada).

### Visualización Geográfica (MVP Cuba)
* **Lógica de Segmentación:** Implementación de una capa `GeoJSON` que cubra todo el archipiélago cubano.
    * **Provincias Inactivas:** Estilo `fill-opacity: 0.2` con eventos de puntero desactivados (`pointer-events-none`).
    * **Provincias Activas (Habana/Matanzas):** Estilo resaltado con eventos de `click/hover` activos y niveles de zoom desbloqueados hasta nivel de calle.
* **Jerarquía Visual:** Uso de `Z-index` para asegurar que los controles de navegación siempre floten sobre el mapa.

### Diseño Mobile-First
* **Bottom Sheet Navigation:** Los controles de búsqueda de dirección y selección de transporte se ubican en la parte inferior de la pantalla (zona de alcance natural del pulgar).
* **Modo de Alto Contraste:** Temas específicos para el día (legibilidad bajo sol) y la noche (ahorro de batería en pantallas OLED).
* **Feedback Háptico:** Implementación de vibraciones cortas al confirmar rutas o llegar a puntos de control.

---

## 3. Optimización y Potenciación (Pro-Tips)

### Optimización de Datos y Carga
* **Caché de Tiles Selectivo:** Implementar una lógica de "Pre-descarga de zona" donde el usuario pueda elegir cachear el municipio donde trabajará ese día (ej. Centro Habana), permitiendo que el mapa funcione sin conexión de datos activa.
* **Vector Overlays:** En lugar de cargar miles de marcadores, usar `Canvas` o `SVG` para renderizar los nombres de las calles y barrios en el MVP, mejorando el rendimiento del scroll.

### Reglas de Negocio Locales
* **Cumplimiento de la Ley 109:** El motor de rutas debe configurarse para priorizar el sentido de las vías de un solo sentido (común en La Habana Vieja y Matanzas) para evitar infracciones.
* **Battery Saver Mode:** Reducción de la frecuencia de actualización del GPS cuando el usuario está detenido, optimizando la autonomía del dispositivo móvil durante la jornada de trabajo.

---

## Resumen de Ejecución
1. `pnpm create astro@latest`
2. `npx astro add tailwind`
3. `pnpm add leaflet @types/leaflet nanostores @nanostores/router`
4. Configuración de `manifest.json` y Service Workers para cumplimiento de PWA.
"""

file_path = "/mnt/data/zapatean2-stack-v1.md"

with open(file_path, "w", encoding="utf-8") as f:
    f.write(markdown_content)

print(file_path)