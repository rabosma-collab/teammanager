export async function generateMatchPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  const canvas = await html2canvas(element, {
    useCORS: true,
    scale: 2,
    backgroundColor: '#111827',
    logging: false,
    windowWidth: 794,
    scrollX: 0,
    scrollY: 0,
  });

  const imgData = canvas.toDataURL('image/png');

  // A4 portrait: 210 x 297 mm
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  } else {
    // Meerdere pagina's als inhoud te lang is
    let yOffset = 0;
    let remaining = imgHeight;
    while (remaining > 0) {
      const sliceHeight = Math.min(pageHeight, remaining);
      const srcY = Math.round((yOffset / imgHeight) * canvas.height);
      const srcH = Math.round((sliceHeight / imgHeight) * canvas.height);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = srcH;
      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
      }
      const pageImgData = pageCanvas.toDataURL('image/png');

      if (yOffset > 0) pdf.addPage();
      pdf.addImage(pageImgData, 'PNG', 0, 0, pageWidth, sliceHeight);

      yOffset += sliceHeight;
      remaining -= sliceHeight;
    }
  }

  pdf.save(filename);
}
