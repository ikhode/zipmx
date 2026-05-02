import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing.css';

export default function Terms() {
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
          <h1>Términos de Servicio</h1>
          <p>Última actualización: {new Date().toLocaleDateString('es-MX')}</p>
        </div>

        <div className="legal-content stagger-in">
          <p>
            Bienvenido a Zipp. Estos Términos de Servicio ("Términos") regulan el acceso o uso por parte de usted, como individuo, de las aplicaciones, sitios web, contenido, productos y servicios (los "Servicios") puestos a disposición por Zipp Technologies.
          </p>

          <h2>1. Relación Contractual</h2>
          <p>
            Al acceder y usar los Servicios, usted acepta estar legalmente vinculado por estos Términos, que establecen una relación contractual entre usted y Zipp. Si no acepta estos Términos, no podrá acceder ni usar los Servicios.
          </p>

          <h2>2. Los Servicios</h2>
          <p>
            Zipp proporciona una plataforma tecnológica que permite a los usuarios (pasajeros) organizar y programar servicios de transporte y logística con proveedores externos independientes (conductores). 
            <strong>Zipp no presta servicios de transporte ni funciona como una empresa de transportes.</strong> La prestación de los servicios de transporte depende enteramente del proveedor externo independiente.
          </p>

          <h2>3. Cuentas de Usuario</h2>
          <p>
            Para utilizar la mayor parte de los aspectos de los Servicios, usted debe registrarse y mantener una cuenta personal activa de usuario. Debe tener al menos 18 años de edad para obtener una Cuenta. El registro de la cuenta requiere que envíe cierta información personal, como su nombre, número de teléfono y un método de pago válido.
          </p>
          <p>
            Usted es el único responsable de mantener la confidencialidad y seguridad de las credenciales de su Cuenta. No puede autorizar a terceros a usar su Cuenta.
          </p>

          <h2>4. Pagos</h2>
          <p>
            El uso de los Servicios resultará en cargos por los servicios o bienes que reciba de un Tercer Proveedor ("Cargos"). Después de que haya recibido los servicios obtenidos mediante su uso del Servicio, Zipp facilitará el pago de los Cargos aplicables en nombre del Tercer Proveedor como agente de cobro limitado.
          </p>
          <p>
            Todos los Cargos son pagaderos de inmediato y el pago será facilitado por Zipp utilizando el método de pago preferido indicado en su Cuenta.
          </p>

          <h2>5. Renuncia y Limitación de Responsabilidad</h2>
          <p>
            Los servicios se proporcionan "tal cual" y "según disponibilidad". Zipp renuncia a toda declaración y garantía, expresa, implícita o estatutaria, no expresamente establecida en estos términos.
          </p>
          <p>
            Zipp no será responsable de daños indirectos, incidentales, especiales, ejemplares, punitivos o consecuentes, incluyendo el lucro cesante, la pérdida de datos, o la lesión personal relacionada con el uso de los servicios.
          </p>
        </div>
      </main>

      <footer className="landing-footer" style={{ padding: '2rem 5%', marginTop: 'auto' }}>
        <p style={{ color: 'var(--text-secondary)' }}>© {new Date().getFullYear()} Zipp Technologies.</p>
        <div className="footer-links">
          <Link to="/privacy">Política de Privacidad</Link>
        </div>
      </footer>
    </div>
  );
}
