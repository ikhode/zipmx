
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
        <p>ZIPP es una plataforma que conecta a usuarios con conductores independientes para la prestación de servicios de movilidad y servicios de mandaditos en la ciudad de Tecomán y alrededores.</p>
        
        <h3>2. Datos que recolectamos</h3>
        <p>Para el correcto funcionamiento de la plataforma, recolectamos:</p>
        <ul>
          <li>Datos de identidad (nombre, teléfono, correo).</li>
          <li>Ubicación en tiempo real (necesaria para el servicio de transporte).</li>
          <li>Documentación oficial (solo para conductores).</li>
        </ul>

        <h3>3. Uso de la Información</h3>
        <p>Su ubicación solo se comparte con el conductor asignado durante un viaje activo y se utiliza para el cálculo de tarifas y seguridad.</p>

        <h3>4. Cookies y Tecnologías similares</h3>
        <p>Utilizamos almacenamiento local para mantener su sesión activa y preferencias del sistema.</p>

        <h3>5. Contacto</h3>
        <p>Para cualquier duda sobre estos términos, puede contactarnos a través de los canales oficiales de ZIPP.</p>
      </div>
    </div>
  );
}
