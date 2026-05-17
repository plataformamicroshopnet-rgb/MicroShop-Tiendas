# 👑 Manual del Administrador: Sistema Integral (Ángel Luis)

Este es el manual del propietario de la plataforma. Tienes control total sobre la base de datos, la nube, los usuarios y los módulos financieros.

## 1. Administración de Usuarios
Si entra alguien nuevo a trabajar o alguien se marcha:
1. Ve al menú lateral inferior y pulsa **Admin**.
2. Entra en **Gestión de Usuarios**.
3. Haz clic en "Nuevo Usuario". Asignale un nombre, una contraseña temporal y, muy importante, **selecciona su Rol**.
   - El Rol determinará automáticamente qué pestañas puede ver en la aplicación. Un "Comercial Pyme" jamás verá el Libro Mayor ni las finanzas.

## 2. Panel Financiero y Retrospectiva (Macro Finance)
Este módulo es tuyo en exclusiva.
- **Macro Finance:** Introduce el estado financiero global de la empresa cada mes (Cobrado con/sin IVA, Caja, Comisiones recibidas, Gastos Generales).
- **Patrimonio (Fase 2):** Registra tus activos (pisos, préstamos, hipotecas, liquidez en cuentas de Unicaja/Santander, etc.). El sistema te mostrará tu valor neto real sumando activos y restando pasivos a lo largo de los años.
- **Libro Mayor:** El control maestro de todas las ventas cruzadas con sus liquidaciones.

## 3. Motor de Comisiones (Automático)
El nuevo motor de comisiones funciona solo, pero debes configurarlo a principios de mes o año si cambian las condiciones de Telefónica:
1. Ve a **Comisiones > Configuración de Reglas**.
2. Define los aceleradores o los objetivos fijos.
3. Si alguien del equipo se coge vacaciones, asegúrate de reducir sus "Horas de Contrato" en el sistema para que su objetivo se prorratee automáticamente y no le penalice injustamente en su comisión grupal.

## 4. Copias de Seguridad (Backups a tu NAS)
Las copias se hacen solas todas las noches gracias a **Cron-Job.org** y se envían a tu QNAP en la oficina (`aluis.myqnapcloud.com`).
- Si quieres hacer una copia a mano antes de hacer un cambio importante: Ve a **Admin > Base de Datos** y dale al botón de Backup FTP.
- Si por algún motivo catastrófico necesitas volver al pasado: Desde esa misma pantalla puedes darle a **Restaurar Backup FTP**, elegir el ZIP del día anterior de la lista, y la web retrocederá en el tiempo a ese momento exacto.

### ⚠️ Solución a Errores de Conexión FTP (EHOSTUNREACH)
Si el backup falla con el error `EHOSTUNREACH [Tu IP Pública]:21` o similar, significa que el router no está reenviando el puerto al NAS, generalmente porque el router le ha asignado una nueva IP local al QNAP (ej. pasando de `.62` a `.86`).

**Pasos para solucionarlo:**
1. **Buscar el QNAP en la red local:** Abre una consola (CMD) en Windows y ejecuta `arp -a`. Esto listará todas las IPs locales conectadas y sus Direcciones MAC (su identificador físico).
2. **Identificar la IP del NAS:** Usa PowerShell para "tocar la puerta" del puerto 21 (FTP) en las IPs sospechosas: `Test-NetConnection -ComputerName 192.168.1.X -Port 21`. La IP que devuelva `TcpTestSucceeded : True` es la nueva ubicación de tu NAS.
3. **Fijar la IP (Static DHCP):** Anota la MAC (ej. `24-5e-be-00-27-89`) asociada a esa IP en el paso 1, entra al router (normalmente `192.168.1.1`) y asocia la IP a esa MAC fija en la sección **Static DHCP**.
4. **Verificar Port Forwarding y Railway:** Comprueba que en tu router el **Port Forwarding** (apertura de puertos) del puerto 21 dirija a la IP correcta del QNAP. Finalmente, asegúrate de que en Railway (pestaña Variables) tienes el dominio correcto (`movistar.mycloudnas.com` o tu IP pública) y `QNAP_FTP_PORT` en 21.

## 5. Infraestructura Nube (Railway)
La web vive en **Railway** (`microshop-tiendas-production.up.railway.app`).
- El volumen de datos está montado en `/data` de forma persistente.
- El código se actualiza solo cuando envías cambios a `GitHub` (haciendo un `git push`).
- En la pestaña *Variables* de Railway residen tus credenciales secretas (Contraseñas del QNAP, claves de la DB). **Nunca** le pases capturas de esa pantalla a nadie externo.
