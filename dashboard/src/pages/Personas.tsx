import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, Loader2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import './Personas.css';
import { useToast } from '../components/Toast';

interface Persona {
  id: string;
  nombres: string;
  apellidos: string;
  numDoc?: string;
  telefono: string;
  departamento: string;
  municipio: string;
}

export function Personas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { error, success } = useToast();

  const fetchPersonas = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/personas', {
        headers: {
          'X-API-Key': sessionStorage.getItem('openwa_api_key') || '',
        }
      });
      if (!response.ok) throw new Error('Failed to fetch personas');
      const data = await response.json();
      setPersonas(data.data || []);
    } catch (err) {
      error('Error loading personas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Parse as JSON array of objects
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (jsonData.length === 0) {
        throw new Error('El archivo está vacío');
      }

      // Map rows (assuming headers might be lowercased or exact match)
      const mappedPersonas = jsonData.map((row: any) => ({
        nombres: row.nombres || row.Nombres || row.NOMBRES || '',
        apellidos: row.apellidos || row.Apellidos || row.APELLIDOS || '',
        numDoc: row.numDoc || row.NumDoc || row.NUMDOC || row.Documento || row.documento || '',
        telefono: row.telefono || row.Telefono || row.Teléfono || row.TELEFONO || '',
        departamento: row.departamento || row.Departamento || row.DEPARTAMENTO || '',
        municipio: row.municipio || row.Municipio || row.MUNICIPIO || ''
      }));

      // Send to API
      const response = await fetch('/api/personas/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': sessionStorage.getItem('openwa_api_key') || '',
        },
        body: JSON.stringify(mappedPersonas),
      });

      if (!response.ok) {
        throw new Error('Error guardando en el servidor');
      }

      success(`Se cargaron exitosamente ${mappedPersonas.length} personas`);
      fetchPersonas();
      
    } catch (err: any) {
      error(err.message || 'Error procesando archivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([{
      Nombres: 'Juan',
      Apellidos: 'Perez',
      Documento: '12345678',
      Telefono: '1234567890',
      Departamento: 'Lima',
      Municipio: 'Miraflores'
    }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla');
    XLSX.writeFile(workbook, 'Plantilla_Personas.xlsx');
  };

  return (
    <div className="personas-container">
      <div className="personas-header">
        <div>
          <h1 className="page-title">Directorio de Personas</h1>
          <p className="page-description">Gestiona y carga tu base de contactos</p>
        </div>
        
        <div className="header-actions">
          <button 
            className="btn"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            onClick={downloadTemplate}
            disabled={uploading}
          >
            <Download size={20} />
            <span>Descargar Plantilla</span>
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload} 
            accept=".xlsx, .xls, .csv" 
            style={{ display: 'none' }} 
          />
          <button 
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="animate-spin" size={20} /> : <FileSpreadsheet size={20} />}
            <span>Cargar Excel</span>
          </button>
        </div>
      </div>

      <div className="card personas-content">
        {loading ? (
          <div className="loading-state">
            <Loader2 className="animate-spin" size={32} />
            <p>Cargando datos...</p>
          </div>
        ) : personas.length === 0 ? (
          <div className="empty-state">
            <Upload size={48} className="empty-icon" />
            <h3>No hay personas registradas</h3>
            <p>Comienza cargando un archivo Excel con los datos</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombres</th>
                  <th>Apellidos</th>
                  <th>Documento</th>
                  <th>Teléfono</th>
                  <th>Departamento</th>
                  <th>Municipio</th>
                </tr>
              </thead>
              <tbody>
                {personas.map((persona) => (
                  <tr key={persona.id}>
                    <td>{persona.nombres}</td>
                    <td>{persona.apellidos}</td>
                    <td>{persona.numDoc || '-'}</td>
                    <td>{persona.telefono}</td>
                    <td>{persona.departamento}</td>
                    <td>{persona.municipio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
