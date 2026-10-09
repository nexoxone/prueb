# Partículas controladas con las manos

Proyecto web (three.js + MediaPipe Hands). No necesita instalar nada con npm.

## Cómo abrirlo en Visual Studio / VS Code
1. Abre esta carpeta (Archivo > Abrir > Carpeta).
2. Haz doble clic en `iniciar.bat` (necesita Python) o, en VS Code, clic derecho en `index.html` > "Open with Live Server".
3. En el navegador (Chrome o Edge) pulsa **Activar cámara** y permite el acceso.

Debe abrirse desde `http://localhost`, no con doble clic al archivo, porque la cámara lo exige.

## Gestos
| Gesto | Efecto |
|---|---|
| Mano abierta | anillo de varillas; el tamaño sigue lo abierta que esté la mano |
| Puño | esfera compacta que gira |
| Dos dedos (índice y corazón) | las partículas siguen tu mano dejando estela |
| "L" (pulgar e índice) o rock (índice y meñique) | lluvia de cruces verdes y doradas |
| Dos manos | el tamaño sigue la distancia entre ellas |

Sin cámara: teclas 1-4 cambian el efecto, el ratón mueve el centro y la rueda cambia el tamaño.
