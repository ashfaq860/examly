import { PaperSettings } from '@/types/paperBuilderTypes';

export const printPaper = (content: string, settings: PaperSettings, layout: string) => {
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    alert('Please allow popups to print this paper.');
    return;
  }

  const layoutStyle = getLayoutStyle(layout);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Examination Paper</title>
      <style>
        @page {
          size: A4;
          margin: 0;
        }
        
        body {
          margin: 0;
          padding: 0;
          background: white;
          font-family: ${settings.fontFamily};
          font-size: ${settings.fontSize}px;
          -webkit-print-color-adjust: exact;
        }
        
        .print-container {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 15mm;
          box-sizing: border-box;
          background: white;
          position: relative;
        }
        
        /* Apply dynamic layout styles */
        ${layoutStyle}
        
        .scissor-cut {
          position: relative;
          border-top: 1px dashed #000;
          margin: 30px 0;
          text-align: center;
        }
        
        .page-break {
          page-break-after: always;
          break-after: page;
        }

        @media print {
          body { width: 210mm; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="print-container">
        ${content}
      </div>
      <script>
        // Auto-close window after printing or canceling
        window.onload = () => {
          setTimeout(() => {
            window.print();
            window.close();
          }, 500);
        };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
};

const getLayoutStyle = (layout: string) => {
  switch (layout) {
    case 'two_papers':
      return `
        .paper-content {
          column-count: 2;
          column-gap: 15mm;
          column-rule: 1px solid #eee;
        }
        .section-block { break-inside: avoid; }
      `;
    case 'three_papers':
      return `
        .paper-content {
          column-count: 3;
          column-gap: 10mm;
        }
        .section-block { break-inside: avoid; }
      `;
    default:
      return `.paper-content { column-count: 1; }`;
  }
};