// ═══════════════════════════════════════════════════
// login.js — Formulario de acceso del administrador
// ═══════════════════════════════════════════════════
// Este archivo maneja el formulario de login.
// Cuando el admin envía el formulario:
//   1. Desactiva el botón para evitar doble envío
//   2. Envía usuario y contraseña al servidor
//   3. Si son correctos → redirige al panel /admin
//   4. Si son incorrectos → muestra el mensaje de error
// ═══════════════════════════════════════════════════

// Escuchar el evento "submit" del formulario de login
document.getElementById('login-form').addEventListener('submit', async function(e) {
  // Evitar que el formulario recargue la página (comportamiento por defecto)
  e.preventDefault();

  const boton    = document.getElementById('login-btn');
  const mensajeError = document.getElementById('login-error');

  // Deshabilitar el botón y cambiar su texto mientras se procesa
  boton.disabled = true;
  document.getElementById('login-btn-text').textContent = 'Verificando...';
  mensajeError.style.display = 'none'; // Ocultar error anterior

  // Leer los valores del formulario
  const datos = {
    username: document.getElementById('username').value,
    password: document.getElementById('password').value
  };

  try {
    // Enviar los datos al servidor en formato JSON
    const respuesta = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });

    const resultado = await respuesta.json();

    if (respuesta.ok) {
      // Login exitoso → ir al panel de administración
      window.location.href = '/admin';
    } else {
      // Credenciales incorrectas → mostrar mensaje de error
      mensajeError.textContent = resultado.error || 'Credenciales inválidas';
      mensajeError.style.display = 'block';
      // Rehabilitar el botón para que pueda intentar de nuevo
      boton.disabled = false;
      document.getElementById('login-btn-text').textContent = 'Ingresar';
    }

  } catch (error) {
    // Error de red (servidor apagado, sin conexión, etc.)
    mensajeError.textContent = 'Error de conexión. Verifica que Docker esté corriendo.';
    mensajeError.style.display = 'block';
    boton.disabled = false;
    document.getElementById('login-btn-text').textContent = 'Ingresar';
  }
});