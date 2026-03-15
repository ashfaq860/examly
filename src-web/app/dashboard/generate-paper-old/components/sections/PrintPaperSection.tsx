// src/app/dashboard/generate-paper/components/sections/PrintPaperSection.tsx
'use client';
import React, { useState } from 'react';
import { Question } from '@/types/types';

interface PrintPaperSectionProps {
  previewQuestions: Record<string, Question[]>;
}

export const PrintPaperSection: React.FC<PrintPaperSectionProps> = ({
  previewQuestions
}) => {
  const [printSettings, setPrintSettings] = useState({
    includeAnswerKey: false,
    includeInstructions: true,
    doubleSided: false,
    margin: 'normal',
    fontSize: 'medium'
  });

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print the paper');
      return;
    }

    // Get paper content
    const paperContent = document.querySelector('.paper-preview')?.innerHTML;
    if (!paperContent) {
      alert('No paper content found to print');
      return;
    }

    // Build print document
    const printDoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Paper</title>
        <style>
          @media print {
            body {
              margin: ${printSettings.margin === 'wide' ? '10mm' : '20mm'};
              font-size: ${printSettings.fontSize === 'small' ? '12px' : printSettings.fontSize === 'large' ? '14px' : '13px'};
            }
            
            .page-break {
              page-break-after: always;
            }
            
            .no-print {
              display: none;
            }
            
            .header, .footer {
              text-align: center;
              margin-bottom: 20px;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
            }
            
            th, td {
              border: 1px solid #000;
              padding: 8px;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${paperContent}
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => window.close(), 1000);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(printDoc);
    printWindow.document.close();
  };

  const handlePrintPreview = () => {
    alert('Print preview would open here. For now, use the Print button.');
  };

  return (
    <div className="card border-info">
      <div className="card-header bg-info text-white">
        <h5 className="mb-0">
          <i className="bi bi-printer me-2"></i>
          Print Paper
        </h5>
      </div>
      <div className="card-body">
        <div className="alert alert-info mb-3">
          <i className="bi bi-info-circle me-2"></i>
          Configure print settings and print your paper.
        </div>
        
        <div className="row">
          <div className="col-md-6">
            <div className="mb-3">
              <label className="form-label">Print Settings</label>
              
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={printSettings.includeAnswerKey}
                  onChange={(e) => setPrintSettings({...printSettings, includeAnswerKey: e.target.checked})}
                  id="includeAnswerKey"
                />
                <label className="form-check-label" htmlFor="includeAnswerKey">
                  Include Answer Key
                </label>
              </div>
              
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={printSettings.includeInstructions}
                  onChange={(e) => setPrintSettings({...printSettings, includeInstructions: e.target.checked})}
                  id="includeInstructions"
                />
                <label className="form-check-label" htmlFor="includeInstructions">
                  Include Instructions
                </label>
              </div>
              
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={printSettings.doubleSided}
                  onChange={(e) => setPrintSettings({...printSettings, doubleSided: e.target.checked})}
                  id="doubleSided"
                />
                <label className="form-check-label" htmlFor="doubleSided">
                  Print Double-Sided
                </label>
              </div>
            </div>
          </div>
          
          <div className="col-md-6">
            <div className="mb-3">
              <label className="form-label">Margin Size</label>
              <select
                className="form-select"
                value={printSettings.margin}
                onChange={(e) => setPrintSettings({...printSettings, margin: e.target.value})}
              >
                <option value="normal">Normal Margins</option>
                <option value="wide">Wide Margins</option>
                <option value="narrow">Narrow Margins</option>
              </select>
            </div>
            
            <div className="mb-3">
              <label className="form-label">Font Size</label>
              <select
                className="form-select"
                value={printSettings.fontSize}
                onChange={(e) => setPrintSettings({...printSettings, fontSize: e.target.value})}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="alert alert-warning mb-3">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Total Questions to Print: {Object.values(previewQuestions).reduce((total, q) => total + q.length, 0)}
        </div>
        
        <div className="d-grid gap-2">
          <button
            className="btn btn-primary btn-lg"
            onClick={handlePrint}
          >
            <i className="bi bi-printer me-2"></i>
            Print Paper
          </button>
          
          <button
            className="btn btn-outline-primary"
            onClick={handlePrintPreview}
          >
            <i className="bi bi-eye me-2"></i>
            Print Preview
          </button>
        </div>
        
        <div className="mt-3">
          <small className="text-muted">
            Note: Make sure your printer is connected and ready before printing.
          </small>
        </div>
      </div>
    </div>
  );
};