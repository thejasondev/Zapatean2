export async function generateReceiptAndShare(data: {
  date: number;
  distanceKm: number;
  costCup: number;
  stopsCount: number;
  addresses: string[];
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  
  // Base heights
  const headerHeight = 110;
  const metricsHeight = 220;
  const addrItemHeight = 32;
  const footerHeight = 140;
  const addressesHeight = data.addresses.length * addrItemHeight + 60;
  
  canvas.height = headerHeight + metricsHeight + addressesHeight + footerHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Gradient Header
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, '#2563eb'); // blue-600
  gradient.addColorStop(1, '#3b82f6'); // blue-500
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, headerHeight);

  // Header Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Zapatean2', canvas.width / 2, 52);
  
  ctx.font = '500 20px Inter, sans-serif';
  ctx.globalAlpha = 0.9;
  ctx.fillText('Recibo de Entrega Oficial', canvas.width / 2, 85);
  ctx.globalAlpha = 1.0;

  // Body Start
  let y = headerHeight + 50;
  ctx.textAlign = 'left';
  
  // Date Block, right aligned
  ctx.fillStyle = '#64748b';
  ctx.font = '16px Inter, sans-serif';
  ctx.textAlign = 'right';
  const dateStr = new Date(data.date).toLocaleString('es-CU', { 
    year: 'numeric', month: 'short', day: 'numeric', 
    hour: '2-digit', minute: '2-digit' 
  });
  ctx.fillText(`Emitido: ${dateStr}`, canvas.width - 40, y);
  
  // Title Left
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px Inter, sans-serif';
  ctx.fillText('Resumen del Servicio', 40, y);
  
  y += 45;
  
  // Metrics Boxes (flex layout simulation)
  const drawMetric = (label: string, value: string, mx: number, my: number) => {
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(mx, my, 160, 80, 12);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, mx + 80, my + 30);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText(value, mx + 80, my + 60);
  };

  drawMetric('PARADAS', data.stopsCount.toString(), 40, y);
  drawMetric('DISTANCIA', `${data.distanceKm.toFixed(1)} km`, 220, y);
  drawMetric('TARIFA/KM', `$${Math.round(data.costCup/Math.max(1, data.distanceKm))}`, 400, y);
  
  y += 130;

  // Route Address
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px Inter, sans-serif';
  ctx.fillText('Ruta Trazada', 40, y);
  y += 35;
  
  ctx.font = '18px Inter, sans-serif';
  ctx.fillStyle = '#334155';
  
  // Limit addresses to max 10 to keep receipt sane
  const renderStops = data.addresses.slice(0, 10);
  renderStops.forEach((addr, i) => {
    // Truncate
    let displayAddr = addr;
    if (displayAddr.length > 55) displayAddr = displayAddr.substring(0, 52) + '...';
    
    // Draw dot
    ctx.beginPath();
    ctx.arc(48, y - 6, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    
    // Draw line between dots if not last
    if (i < renderStops.length - 1) {
      ctx.beginPath();
      ctx.moveTo(48, y);
      ctx.lineTo(48, y + addrItemHeight - 10);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    ctx.fillStyle = '#334155';
    ctx.fillText(displayAddr, 65, y);
    y += addrItemHeight;
  });

  if (data.addresses.length > 10) {
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`... y ${data.addresses.length - 10} paradas más`, 65, y);
    y += addrItemHeight;
  }

  y += 20;
  
  // Footer & Total
  ctx.beginPath();
  ctx.moveTo(40, y);
  ctx.lineTo(canvas.width - 40, y);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();
  y += 50;

  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.fillStyle = '#16a34a'; // green-600
  ctx.textAlign = 'right';
  ctx.fillText(`Total a Pagar: $${data.costCup} CUP`, canvas.width - 40, y);

  y += 40;
  ctx.font = '14px Inter, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText('Recibo autogenerado por Zapatean2 • Optimización de Rutas para Mensajeros', canvas.width / 2, y);

  // Export
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], `Recibo_Zapatean2_CUP_${data.costCup}.png`, { type: 'image/png' });
    
    const showFallback = () => {
      const url = URL.createObjectURL(blob);
      const overlay = document.createElement('div');
      overlay.className = 'zap-modal-overlay';
      overlay.innerHTML = `
        <div class="zap-modal" style="padding: 1rem; max-width: 90vw; transform: scale(1); opacity: 1; animation: none;">
          <p style="margin: 0 0 0.75rem; font-size: 0.875rem; color: var(--text); font-weight: bold;">Mantén presionada la imagen para guardarla o compartirla</p>
          <img src="${url}" style="width: 100%; border-radius: 0.5rem; border: 1px solid oklch(0.5 0 0 / 0.1);" />
          <button id="close-img-btn" class="zap-modal-btn zap-modal-btn--ghost" style="margin-top: 1rem; width: 100%;">Cerrar</button>
        </div>
      `;
      document.body.appendChild(overlay);
      document.getElementById('close-img-btn')!.addEventListener('click', () => {
        overlay.remove();
        URL.revokeObjectURL(url);
      });
    };

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: 'Recibo Zapatean2',
          text: `Comprobante de entrega por ${data.distanceKm.toFixed(1)} km y ${data.stopsCount} paradas. Total: $${data.costCup} CUP.`,
          files: [file]
        });
      } catch (err) {
        // User cancelled or failure, fallback to image modal
        console.log('Share cancelled or failed', err);
        // Only show fallback if it's an actual failure, not user cancellation
        // Usually NotAllowedError means user cancelled or gesture was lost
        if ((err as Error).name !== 'AbortError') {
          showFallback();
        }
      }
    } else {
      // Fallback: visual modal
      showFallback();
    }
  }, 'image/png');
}
