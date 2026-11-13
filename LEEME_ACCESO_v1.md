# LA14 · ACCESO · v1  (cada colega elige su contraseña)

## Cómo funciona
1. Desde Supabase se le envía a cada colega un correo de "restablecer contraseña".
2. El enlace abre `/auth/confirmar` (se valida en el servidor, un solo uso) y lleva a `/login/nueva-clave`.
3. La persona elige su contraseña (mín. 12 caracteres), se cierra la sesión y entra normal.
4. En su primer ingreso el sistema le pide activar el 2FA (código del celular) en `/login/activar-2fa`.

## Paso único en Supabase (una sola vez)
Authentication → Email Templates → "Reset Password". Cambia SOLO el enlace del botón por:

    <h2>Nueva contraseña · La 14 Lounge</h2>
    <p>Entra al siguiente enlace para elegir tu contraseña. Solo funciona una vez.</p>
    <p><a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery">Elegir mi contraseña</a></p>

Y revisa Authentication → URL Configuration → Site URL = https://la14lounge.vercel.app

## Enviar los correos
Authentication → Users → (los tres de tus colegas) → "Send password recovery".
Envíalos de uno en uno: el correo gratuito de Supabase tiene un límite bajo por hora.
Revisa también la carpeta de spam.
