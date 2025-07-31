import React, { useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Alert,
  Stack,
  Divider,
  Paper
} from '@mui/material';
import {
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { TransformationConfig, ExportOptions as ExportOptionsType } from '../../../types';
import StatBlockGenerator from './StatBlockGenerator';

interface ExportOptionsProps {
  config: TransformationConfig;
}

const ExportOptions: React.FC<ExportOptionsProps> = ({ config }) => {
  const [exportOptions, setExportOptions] = useState<ExportOptionsType>({
    format: 'pdf',
    includeBackground: true,
    paperSize: 'A4'
  });
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const statBlockRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!statBlockRef.current) return;
    
    setIsExporting(true);
    setExportSuccess(false);
    
    try {
      const fileName = `${config.character.name}_${config.selectedForm?.name || 'Unknown'}_StatBlock`;
      
      if (exportOptions.format === 'pdf') {
        // Generate PDF
        const canvas = await html2canvas(statBlockRef.current, {
          backgroundColor: exportOptions.includeBackground ? '#ffffff' : '#ffffff', // Always white for print-friendly
          scale: 2,
          useCORS: true
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: exportOptions.paperSize === 'A4' ? 'a4' : 'letter'
        });
        
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 295; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        
        let position = 0;
        
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        
        pdf.save(`${fileName}.pdf`);
      } else {
        // Generate PNG or JPG
        const canvas = await html2canvas(statBlockRef.current, {
          backgroundColor: exportOptions.includeBackground ? '#ffffff' : '#ffffff', // Always white for print-friendly
          scale: 2,
          useCORS: true
        });
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileName}.${exportOptions.format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        }, `image/${exportOptions.format}`, 0.95);
      }
      
      setExportSuccess(true);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };





  const handlePrint = () => {
    // Create a new window with only the stat block content for printing
    const printWindow = window.open('', '_blank');
    if (printWindow && statBlockRef.current) {
      const statBlockHTML = statBlockRef.current.innerHTML;
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Stat Block - ${config.character.name}</title>
          <style>
            body {
              font-family: 'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif;
              background: white;
              color: black;
              margin: 20px;
              line-height: 1.6;
            }
            .MuiCard-root {
              border: 1px solid #000;
              border-radius: 8px;
              padding: 16px;
              background: white;
            }
            .MuiTypography-h5 {
              font-size: 1.5rem;
              font-weight: 600;
              margin-bottom: 8px;
            }
            .MuiTypography-h6 {
              font-size: 1.25rem;
              font-weight: 500;
              margin-bottom: 8px;
              margin-top: 16px;
            }
            .MuiTypography-body2 {
              font-size: 0.875rem;
              margin-bottom: 4px;
            }
            .MuiDivider-root {
              border: none;
              border-top: 1px solid #000;
              margin: 16px 0;
            }
            .MuiChip-root {
              display: inline-block;
              padding: 2px 8px;
              border: 1px solid #000;
              border-radius: 4px;
              font-size: 0.75rem;
              margin: 2px;
            }
            strong {
              font-weight: 600;
            }
            @media print {
              body { margin: 0; }
              .MuiCard-root { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="MuiCard-root">
            ${statBlockHTML}
          </div>
        </body>
        </html>
      `);
      
      printWindow.document.close();
      printWindow.focus();
      
      // Wait for content to load, then print
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } else {
      // Fallback to regular print
      window.print();
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Exportar Stat Block
      </Typography>
      
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Configure as opções de exportação e baixe o stat block da sua transformação.
      </Typography>

      {exportSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Stat block exportado com sucesso!
        </Alert>
      )}

      <Stack spacing={3}>
        {/* Preview */}
        <Paper elevation={2} sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Visualização Final
          </Typography>
          <Box 
            ref={statBlockRef}
            sx={{ 
              border: '1px solid #e0e0e0', 
              borderRadius: 1, 
              p: 2,
              backgroundColor: exportOptions.includeBackground ? '#ffffff' : 'transparent'
            }}
          >
            {config.selectedForm ? (
              <StatBlockGenerator
                spell={config.spell}
                form={config.selectedForm}
                casterLevel={config.casterLevel}
                character={config.character}
              />
            ) : (
              <Typography color="error">Erro: Nenhuma forma selecionada</Typography>
            )}
          </Box>
        </Paper>

        {/* Export Options */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Opções de Exportação
            </Typography>
            
            <Stack spacing={3}>
              <FormControl fullWidth>
                <InputLabel>Formato</InputLabel>
                <Select
                  value={exportOptions.format}
                  label="Formato"
                  onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as 'pdf' | 'png' | 'jpg' }))}
                >
                  <MenuItem value="pdf">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PdfIcon fontSize="small" />
                      PDF (Recomendado)
                    </Box>
                  </MenuItem>
                  <MenuItem value="png">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ImageIcon fontSize="small" />
                      PNG (Imagem)
                    </Box>
                  </MenuItem>
                  <MenuItem value="jpg">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ImageIcon fontSize="small" />
                      JPG (Imagem)
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Tamanho do Papel</InputLabel>
                <Select
                  value={exportOptions.paperSize}
                  label="Tamanho do Papel"
                  onChange={(e) => setExportOptions(prev => ({ ...prev, paperSize: e.target.value as 'A4' | 'Letter' | 'Custom' }))}
                >
                  <MenuItem value="A4">A4 (210 × 297 mm)</MenuItem>
                  <MenuItem value="Letter">Letter (8.5 × 11 in)</MenuItem>
                  <MenuItem value="Custom">Personalizado</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={exportOptions.includeBackground}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeBackground: e.target.checked }))}
                  />
                }
                label="Incluir cores do tema (sempre com fundo branco para impressão)"
              />
            </Stack>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={isExporting}
            sx={{ minWidth: 200 }}
          >
            {isExporting ? 'Exportando...' : `Baixar ${exportOptions.format.toUpperCase()}`}
          </Button>
          
          <Button
            variant="outlined"
            size="large"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ minWidth: 150 }}
          >
            Imprimir
          </Button>
        </Box>

        <Divider />

        {/* Additional Info */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            💡 <strong>Dica:</strong> Use o formato PDF para melhor qualidade e compatibilidade.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            O stat block gerado segue as regras oficiais do Pathfinder 2e.
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
};

export default ExportOptions;