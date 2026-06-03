import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, Loader2, Download, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
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
  tipo?: string;
  telefonoWap?: string;
  tipoDocumento?: string;
  tipoRegistro?: string;
  clasificacionRegistro?: string;
  TipoEstructuraRegistro?: string;
}

export function Personas() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Pagination & Search state
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const limit = 10;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { error, success } = useToast();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar esta persona?')) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/personas/${id}`, {
        method: 'DELETE',
        headers: {
          'X-API-Key': sessionStorage.getItem('openwa_api_key') || '',
        }
      });
      if (!response.ok) throw new Error('Error al eliminar');

      success('Persona eliminada');
      fetchPersonas();
    } catch (err) {
      error('Error al eliminar persona');
    } finally {
      setDeletingId(null);
    }
  };

  const fetchPersonas = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/personas?page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}`, {
        headers: {
          'X-API-Key': sessionStorage.getItem('openwa_api_key') || '',
        }
      });
      if (!response.ok) throw new Error('Failed to fetch personas');
      const data = await response.json();
      setPersonas(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      error('Error loading personas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, [page, debouncedSearch]);

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
        municipio: row.municipio || row.Municipio || row.MUNICIPIO || '',
        tipo: row.tipo || row.Tipo || row.TIPO || '',
        telefonoWap: row.telefonoWap || row.TelefonoWap || row.TELEFONOWAP || '',
        tipoDocumento: row.tipoDocumento || row.TipoDocumento || row.TIPODOCUMENTO || '',
        tipoRegistro: row.tipoRegistro || row.TipoRegistro || row.TIPOREGISTRO || '',
        clasificacionRegistro: row.clasificacionRegistro || row.ClasificacionRegistro || row.CLASIFICACIONREGISTRO || '',
        TipoEstructuraRegistro: row.TipoEstructuraRegistro || row.tipoEstructuraRegistro || row.TIPOESTRUCTURAREGISTRO || ''
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
      
      const savedPersonas = await response.json();
      const savedCount = savedPersonas.length || 0;
      const ignoredCount = mappedPersonas.length - savedCount;

      if (ignoredCount > 0) {
        success(`Se guardaron ${savedCount} personas nuevas. (${ignoredCount} fueron omitidas por errores o duplicidad)`);
      } else {
        success(`Se cargaron exitosamente ${savedCount} personas`);
      }

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
      Municipio: 'Miraflores',
      Tipo: 'Natural',
      TelefonoWap: '1234567890',
      TipoDocumento: 'DNI',
      TipoRegistro: 'Nuevo',
      ClasificacionRegistro: 'A',
      TipoEstructuraRegistro: 'Base'
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
        <div className="table-controls" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="search-box" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '0.5rem', width: '300px' }}>
            <Search size={18} style={{ marginRight: '0.5rem', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar por doc, nombre o tel..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-primary)' }}
            />
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Total registros: <strong>{total}</strong>
          </div>
        </div>
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
                  <th>Tipo Doc.</th>
                  <th>Teléfono</th>
                  <th>Teléfono Wap</th>
                  <th>Departamento</th>
                  <th>Municipio</th>
                  <th>Tipo</th>
                  <th>Tipo Reg.</th>
                  <th>Clasif. Reg.</th>
                  <th>Estructura</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {personas.map((persona) => (
                  <tr key={persona.id}>
                    <td>{persona.nombres}</td>
                    <td>{persona.apellidos}</td>
                    <td>{persona.numDoc || '-'}</td>
                    <td>{persona.tipoDocumento || '-'}</td>
                    <td>{persona.telefono}</td>
                    <td>{persona.telefonoWap || '-'}</td>
                    <td>{persona.departamento}</td>
                    <td>{persona.municipio}</td>
                    <td>{persona.tipo || '-'}</td>
                    <td>{persona.tipoRegistro || '-'}</td>
                    <td>{persona.clasificacionRegistro || '-'}</td>
                    <td>{persona.TipoEstructuraRegistro || '-'}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-icon"
                        onClick={() => handleDelete(persona.id)}
                        disabled={deletingId === persona.id}
                        title="Eliminar"
                        style={{ color: '#ef4444' }}
                      >
                        {deletingId === persona.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && total > 0 && (
          <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
            <button 
              className="btn btn-secondary" 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <span style={{ color: 'var(--text-secondary)' }}>
              Página {page} de {Math.ceil(total / limit) || 1}
            </span>
            <button 
              className="btn btn-secondary" 
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage(p => p + 1)}
            >
              Siguiente <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
