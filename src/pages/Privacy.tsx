
import { Link } from 'react-router-dom';
import '../styles/landing.css';

export default function Privacy() {
  return (
    <div className="landing-container">
      <nav className="landing-nav">
        <Link to="/" className="landing-logo">
          <span>Zipp</span>
        </Link>
        <div className="landing-nav-links">
          <Link to="/" className="btn-outline">Volver al Inicio</Link>
        </div>
      </nav>

      <main className="legal-container">
        <div className="legal-header fade-in">
          <h1>Política de Privacidad</h1>
          <p>Última actualización: {new Date().toLocaleDateString('es-MX')}</p>
        </div>

        <div className="legal-content stagger-in">
          <p>
            En Zipp ("nosotros", "nuestro" o "la Empresa"), respetamos su privacidad y estamos comprometidos a proteger los datos personales que comparte con nosotros. Esta Política de Privacidad explica cómo recopilamos, usamos, divulgamos y salvaguardamos su información cuando utiliza nuestra aplicación móvil y nuestro sitio web.
          </p>

          <h2>1. Información que recopilamos</h2>
          <p>Podemos recopilar información sobre usted de diversas formas. La información que podemos recopilar a través de la Aplicación incluye:</p>
          <ul>
            <li><strong>Datos personales:</strong> Nombre, número de teléfono, dirección de correo electrónico y fotografía de perfil que nos proporciona al registrarse.</li>
            <li><strong>Datos de ubicación (Crítico):</strong> Solicitamos acceso a la ubicación de su dispositivo <strong>en primer plano y en segundo plano</strong> (especialmente para conductores) para poder conectarlo con viajes cercanos, calcular la tarifa adecuada, y brindar funciones de seguridad y seguimiento en tiempo real.</li>
            <li><strong>Datos financieros:</strong> Información relacionada con su método de pago (tarjetas de crédito, cuentas bancarias para conductores). Procesamos estos pagos de forma segura a través de nuestros socios de pago (Stripe y MercadoPago).</li>
          </ul>

          <h2>2. Uso de su información</h2>
          <p>Tener información precisa sobre usted nos permite brindarle una experiencia fluida, eficiente y personalizada. Específicamente, podemos usar la información recopilada para:</p>
          <ul>
            <li>Facilitar la conexión entre pasajeros y conductores.</li>
            <li>Procesar transacciones y pagos.</li>
            <li>Mejorar la seguridad de nuestros usuarios mediante el seguimiento de viajes.</li>
            <li>Resolver disputas y solucionar problemas técnicos.</li>
          </ul>

          <h2>3. Divulgación de su información</h2>
          <p>Podemos compartir información que hemos recopilado sobre usted en ciertas situaciones:</p>
          <ul>
            <li><strong>Con otros usuarios:</strong> Compartimos su nombre, calificación y ubicación (durante un viaje activo) con su conductor o pasajero designado.</li>
            <li><strong>Por requerimiento legal:</strong> Si creemos que la divulgación de información es necesaria para responder a un proceso legal o para investigar o remediar posibles violaciones de nuestras políticas.</li>
          </ul>

          <h2>4. Eliminación de la cuenta</h2>
          <p>
            Usted tiene el derecho de solicitar la eliminación completa de su cuenta y todos sus datos asociados en cualquier momento. Puede hacerlo directamente desde la sección "Perfil / Configuración" dentro de la aplicación Zipp. Al confirmar, eliminaremos sus datos personales, historial de viajes y métodos de pago de nuestros servidores de forma permanente.
          </p>

          <h2>5. Contacto</h2>
          <p>
            Si tiene preguntas o comentarios sobre esta Política de Privacidad, comuníquese con nosotros a:<br/>
            <strong>soporte@inteligent.software</strong>
          </p>
        </div>
      </main>

      <footer className="landing-footer" style={{ padding: '2rem 5%', marginTop: 'auto' }}>
        <p style={{ color: 'var(--text-secondary)' }}>© {new Date().getFullYear()} Zipp Technologies.</p>
        <div className="footer-links">
          <Link to="/terms">Términos de Servicio</Link>
        </div>
      </footer>
    </div>
  );
}
