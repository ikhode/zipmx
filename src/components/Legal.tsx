
interface LegalPageProps {
  title: string;
  onClose: () => void;
}

export function LegalPage({ title, onClose }: LegalPageProps) {
  return (
    <div className="legal-view fade-in">
      <header className="legal-header">
        <button className="minimal-back-btn" onClick={onClose}>←</button>
        <h2 className="minimal-title-md">{title}</h2>
      </header>
      <div className="legal-content">
        <p><strong>Última actualización: Abril 2024</strong></p>
        
        <h3>1. Introducción</h3>
        <p>ZIPP es una plataforma tecnológica que conecta a usuarios (pasajeros) con conductores independientes para servicios de movilidad y servicios de mandaditos (Logística local) en México.</p>
        
        <h3>2. Recolección de Datos y Privacidad</h3>
        <p>Para el correcto funcionamiento de la plataforma y su seguridad, recolectamos:</p>
        <ul>
          <li><strong>Perfil de Usuario:</strong> Nombre completo, correo electrónico y número de teléfono verificado mediante SMS.</li>
          <li><strong>Ubicación de Precisión:</strong> Recolectamos datos de ubicación exacta (GPS) incluso cuando la aplicación está en <strong>segundo plano</strong> si tienes un viaje activo o estás en modo conductor, para permitir el seguimiento del viaje, asistencia en emergencias y cálculo exacto de tarifas.</li>
          <li><strong>Documentación:</strong> Fotografías de identificación y documentos del vehículo (solo conductores).</li>
        </ul>

        <h3>3. Uso de la Información</h3>
        <p>Su ubicación se comparte con el conductor asignado durante el viaje. Nunca compartimos sus datos personales con terceros con fines publicitarios.</p>

        <h3>4. Eliminación de Cuenta y Datos</h3>
        <p>ZIPP garantiza el derecho a la eliminación de sus datos. Puede solicitar la eliminación definitiva de su cuenta y todos los datos asociados directamente desde la aplicación en <strong>Configuración &gt; Eliminar mi cuenta</strong>. Este proceso elimina permanentemente su historial de viajes, saldo y datos de identificación de nuestros servidores en cumplimiento con las regulaciones de protección de datos personales.</p>

        <h3>5. Seguridad</h3>
        <p>Implementamos medidas de seguridad premium para proteger su información, incluyendo encriptación de datos en tránsito y acceso restringido mediante Cloudflare Zero Trust.</p>

        <h3>6. Contacto</h3>
        <p>Para cualquier duda sobre estos términos o el ejercicio de sus derechos ARCO, contáctenos en soporte@zipp.app</p>
      </div>
    </div>
  );
}
