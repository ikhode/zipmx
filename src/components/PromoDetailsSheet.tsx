import React from 'react';

interface PromoDetailsSheetProps {
  onClose: () => void;
}

export const PromoDetailsSheet: React.FC<PromoDetailsSheetProps> = ({ onClose }) => {
  return (
    <div className="promo-details-sheet premium-card-anim">
      <div className="promo-illustration-box">
        <img src="/icons/promo_tags_3d_illustration_1775324950447.png" alt="Promo Tags" />
        <button className="close-circle-btn" onClick={onClose}>✕</button>
      </div>
      
      <div className="promo-body">
        <h2 className="promo-main-title">40% para tu próximo viaje. Hasta 40 MXN por viaje.</h2>
        
        <div className="promo-section">
          <h3 className="promo-sec-title">Vencimiento</h3>
          <p className="promo-vto">Vto.: 5 abr 2026.</p>
        </div>

        <div className="promo-section">
          <h3 className="promo-sec-title">Restricciones</h3>
          <ul className="promo-list">
            <li>Válida en Jamaica, Perú, Paraguay, Costa Rica, Guatemala, El Salvador, Uruguay, Argentina, Brasil, Panamá, Chile, Colombia, República Dominicana, Ecuador, México, Estados Unidos, Honduras.</li>
            <li>Hasta 40 MXN por viaje.</li>
            <li>El descuento no se aplica a los recargos, tasas gubernamentales, peajes ni montos extra y no se puede combinar con otras ofertas.</li>
            <li>El ahorro más alto se aplicará de manera automática en el siguiente viaje del usuario. El incentivo no es transferible.</li>
          </ul>
        </div>
      </div>

      <div className="promo-footer">
        <button className="uber-confirm-btn" onClick={onClose}>Reservar ahora</button>
      </div>
    </div>
  );
};
