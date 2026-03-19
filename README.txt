# Carreras Club Ciclista de Mejorada

Proyecto estático en HTML, CSS y JavaScript.
No necesita Node, npm ni compilación.

## Archivos
- `index.html`
- `styles.css`
- `data.js`
- `app.js`

## Cómo probarlo sin instalar nada más
Puedes abrir `index.html` en el navegador, pero lo ideal es servirlo con Caddy.

## Despliegue con Caddy en Windows

### 1) Copia esta carpeta a una ruta, por ejemplo:
`C:\VA_PORTAL\carreras-pablo`

### 2) Crea un fichero `Caddyfile` como este:
```caddy
localhost:8081 {
    root * C:/VA_PORTAL/carreras-pablo
    file_server
}
```

### 3) Arranca Caddy desde la carpeta donde tengas el Caddyfile:
```bash
caddy run
```

### 4) Abre:
`http://localhost:8081`

## Cómo actualizar carreras
Edita el fichero `data.js` y añade o modifica objetos dentro de `championships` y `races`.

## Notas
- La navegación usa hash routes (`#/calendario`, `#/campeonatos`), así que no hace falta configuración especial de SPA.
- Los botones sin enlace se muestran como “Pendiente”.


Novedades v2:
- Se muestra el número de orden de cada carrera dentro del campeonato.
- Se añade soporte para enlace de clasificación con el campo resultUrl en data.js.
- La clasificación solo se muestra en carreras ya celebradas; si falta el enlace, aparece como Pendiente.


Novedades v3:
- Enfoque general para el Club Ciclista de Mejorada, no solo para Pablo.
- Botones de volver en páginas internas.
- Migas de pan sencillas en páginas de campeonato y carrera.


Novedades v4:
- Añadido el campeonato X-Sauce Series 2026 con 10 pruebas.
- Enlaces verificados para Illescas, San Martín de Valdeiglesias, Colmenar Viejo y Alpedrete.
- Resto de pruebas añadidas con enlaces pendientes para completar después.


Novedades v5:
- X-Sauce Series separada por tipo de carrera cuando ha sido posible: Escuelas, XCO/Adultos o Mixta.
- Nuevo filtro por tipo de carrera en el calendario.
- Corregidos enlaces de Escuelas en San Martín, Colmenar y Alpedrete.


Novedades v6:
- Eliminadas las etiquetas 'Con documentos' y 'Prueba 1, 2, 3...'.
- Quitada la numeración delante del nombre de las carreras para una interfaz más limpia.


Novedades v7:
- Añadido el campeonato Copa de Madrid XCO 2026.
- Incluye las pruebas madrileñas de XCO presentes en X-Sauce Series: Colmenar Viejo, Alpedrete, Ciempozuelos y Paracuellos del Jarama.


Novedades v8:
- Añadidas San Martín de Valdeiglesias y Arroyomolinos al campeonato Copa de Madrid XCO.


Novedades v9:
- Una carrera puede pertenecer a varios campeonatos con el nuevo campo championshipIds.
- Eliminadas las duplicidades de carreras compartidas entre X-Sauce Series y Copa de Madrid XCO.
- El detalle de carrera muestra todos los campeonatos a los que pertenece.

Novedades v10:
- Título cambiado a "Calendario Escuela CC Mejorada".
- Colores por campeonato:
  * Copa de Madrid XCO → rojo
  * X-Sauce Series → amarillo
  * Castilla-La Mancha XCO → morado
- Añadido escudo del Club Ciclista de Mejorada en la cabecera.


Corrección v11-fixed:
- Aplicados de forma efectiva los fondos de color por campeonato en las tarjetas.
- Recuperado de forma efectiva el número de prueba en cada tarjeta.


Novedades v12:
- El número de prueba ahora aparece como texto delante del nombre de la carrera (ej: 'Prueba 3 · Colmenar Viejo').
- Corregida la inclusión del escudo del Club Ciclista de Mejorada en la cabecera.


Novedades v13:
- El escudo ya no usa enlace externo: ahora se carga desde img/escudo_cc_mejorada.png
- Se crea la carpeta img dentro del proyecto.
- Si falta la imagen, la web sigue funcionando sin romperse.

Pasos para el escudo:
1. Guarda tu imagen como escudo_cc_mejorada.png
2. Cópiala en la carpeta img
3. Recarga la web con Ctrl + F5

Novedades v14:
- La app queda centrada solo en carreras de escuelas.
- Se incluyen también las pruebas mixtas cuando tienen parte de escuelas.
- Eliminado el filtro por tipo, porque ya no hace falta.
- La numeración se muestra de forma más limpia como 3º delante del nombre.


Novedades v15:
- El enlace de clasificación se genera automáticamente a partir del enlace de inscripción cuando sigue el patrón de yosoyciclista.
- Si una carrera ya está celebrada y tiene registrationUrl con /inscripciones/prueba/, la app construye sola la URL de /inscripciones/clasificacion/.
- También se actualiza el estado "Clasificación" en el detalle de carrera usando esa misma lógica.


Corrección v16:
- Arreglado el problema por el que Copa Madrid y Copa CLM aparecían sin pruebas en la vista de escuelas.
- Copa de Madrid pasa a ser Copa de Madrid Escuelas, con sus carreras de escuelas y mixtas.
- Castilla-La Mancha muestra las pruebas mixtas que incluyen escuelas (Illescas y Canredondo).


Corrección v18:
- Las 4 pruebas de Copa Castilla-La Mancha se marcan como mixtas.
- Ahora en CLM aparecen Illescas, Las Pedroñeras, Guadalajara y Quintanar del Rey.


Resultado final v19:
- Base conservada desde la v18.
- Logo duplicado corregido en la portada.
- La guía técnica se genera automáticamente desde el enlace de inscripción cuando sigue el patrón de yosoyciclista.
- La clasificación se genera automáticamente desde el enlace de inscripción cuando la carrera ya está celebrada.
- Los botones sin URL ya no muestran "Pendiente": simplemente no se renderizan.


Revisión v21:
- Revisados enlaces de carreras ya celebradas.
- Actualizados Illescas, San Martín de Valdeiglesias y Colmenar Viejo con inscripción, documentos/guía y clasificación.
- Candeleda sigue pendiente porque no he podido verificar con seguridad la ficha exacta de inscripción/documentos/clasificación para escuelas.


Mejora v22:
- Cuando una carrera tiene entradas separadas para escuelas y adultos, ahora se unifican en la misma pestaña de detalle.
- Se añade un bloque "Accesos del evento" con enlaces agrupados por tipo.
- Se ha configurado Colmenar Viejo con accesos separados de Escuelas y Adultos en la misma pantalla.


Corrección v23:
- Si una carrera tiene accesos unificados, ahora se indica claramente en la tarjeta.
- En el detalle, el bloque agrupado sustituye a los botones genéricos para que el cambio sea visible.


Versión v24:
- Se ocultan por completo las referencias a carreras de adultos.
- La app muestra solo carreras de Escuelas y carreras mixtas que incluyen Escuelas.
- Revisados enlaces oficiales para Illescas, Las Pedroñeras, San Martín, Colmenar y Alpedrete.
- Cuando existe ficha oficial, se cargan inscripción, guía/documentos y clasificación si ya aplica.


Mejora v25:
- Degradados de color suavizados y más limpios visualmente.
- Tarjetas de carrera más ligeras y modernas.
- Optimización móvil: menos texto secundario en tarjetas, botones más compactos y rejilla simplificada.
- La vista principal de carreras queda más clara en pantallas pequeñas.


Versión v26:
- Colores rehechos con fondos más limpios, suaves y menos estridentes.
- Añadida vista de calendario mensual en rejilla dentro de la pestaña Calendario.
- En móvil, la rejilla se adapta a lista vertical para que siga siendo legible.


Versión v27:
- La rejilla mensual ya permite cambiar de mes con botones.
- Se muestra claramente el mes actual en el encabezado del calendario.


Versión v29:
- El orden se muestra en la esquina superior derecha de cada tarjeta como #1, #2, etc.
- Top 3 con estilo más destacado tipo medalla.
- El orden también aparece en los eventos del calendario mensual.


Versión v32:
- El badge del orden muestra tooltip con los campeonatos a los que pertenece la carrera.
- Añadida animación suave al pasar o tocar sobre las tarjetas y badges.
- Ajustado el badge multicolor para que se lea mejor.


Corrección v32-fixed:
- Arreglado un error de JavaScript que dejaba en blanco la página del calendario en cuadrícula.
- Restauradas las funciones de color/título del badge de orden.


Versión v33:
- Corregidos los colores del badge de orden por campeonato.
- Ya no se usa un tricolor genérico.
- Solo se representan las combinaciones reales:
  - CLM + X-Sauce
  - Madrid + X-Sauce
  - campeonatos individuales


Versión v34:
- Estilo visual general renovado.
- Fondo más trabajado con degradados suaves.
- Cabecera tipo glassmorphism.
- Tarjetas, botones y métricas con acabado más moderno.
- Tipografía y jerarquía visual mejoradas.


Versión v35:
- Eliminado el bloque 'Campeonato destacado' de la pantalla principal.


=== Migración a data.json + actualización automática ===

Archivos nuevos:
- data.json
- update_data.py
- requirements.txt
- .github/workflows/update-data.yml

Qué cambia en la app:
- La web ya no lee data.js.
- Ahora app.js carga data.json con fetch.
- data.js.backup se conserva solo como referencia.

Cómo usarlo en GitHub Pages:
1. Sube al repositorio todos los archivos de esta carpeta.
2. Comprueba que GitHub Pages sigue publicando desde la rama/carpeta que ya usas.
3. Ve a la pestaña Actions y habilita los workflows si te lo pide.
4. Lanza una vez el workflow "Actualizar data.json" con "Run workflow".

Cómo hacer cambios manuales:
1. Edita directamente data.json.
2. Añade o corrige carreras dentro de "races".
3. Haz commit y push.
4. La web leerá esos datos automáticamente.

Qué actualiza el script:
- Si una carrera tiene registrationUrl con el patrón /inscripciones/prueba/,
  intenta construir automáticamente:
  - technicalGuideUrl
  - documentsUrl
  - resultUrl
- Solo guarda esos enlaces si la URL responde correctamente.

Cómo cambiar la hora diaria:
- Edita .github/workflows/update-data.yml
- El cron está en UTC.
- Ahora mismo: 05:15 UTC cada día.
