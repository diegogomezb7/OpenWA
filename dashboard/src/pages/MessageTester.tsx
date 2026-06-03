import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, CheckCircle, XCircle, Loader2, Upload, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { messageApi } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useSessionsQuery, useSessionGroupsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import './MessageTester.css';

interface ApiResponse {
  success: boolean;
  messageId?: string;
  timestamp: string;
  error?: string;
}

const messageTypes = ['text', 'image', 'video', 'audio', 'document'] as const;

function resolveSpintax(text: string): string {
  const spintaxRegex = /\{([^{}]+)\}/g;
  let resolvedText = text;
  let match;
  // Use match loop to handle multiple spintax blocks
  while ((match = spintaxRegex.exec(resolvedText)) !== null) {
    const options = match[1].split('|');
    const randomOption = options[Math.floor(Math.random() * options.length)];
    resolvedText = resolvedText.replace(match[0], randomOption);
    spintaxRegex.lastIndex = 0; // Reset index because string length changed
  }
  return resolvedText;
}

function resolveVariables(text: string, persona: any): string {
  if (!persona) return text;
  let resolvedText = text;
  const variables = Object.keys(persona);
  for (const v of variables) {
    // Escape variable names that might have special characters just in case
    const safeVarName = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{${safeVarName}\\}\\}`, 'gi');
    resolvedText = resolvedText.replace(regex, persona[v] || '');
  }
  return resolvedText;
}

export function MessageTester() {
  const { t } = useTranslation();
  useDocumentTitle(t('messageTester.title'));
  const { canWrite } = useRole();
  const { data: allSessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const sessions = allSessions.filter(s => s.status === 'ready');
  const [session, setSession] = useState('');
  const [recipient, setRecipient] = useState('');
  const [recipientType, setRecipientType] = useState<'personal' | 'group' | 'personas' | 'excel'>('personal');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [personas, setPersonas] = useState<any[]>([]);
  const [excelData, setExcelData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [progress, setProgress] = useState<{current: number, total: number} | null>(null);
  const [messageType, setMessageType] = useState<typeof messageTypes[number]>('text');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaBase64, setMediaBase64] = useState<string>('');
  const [mediaMimeType, setMediaMimeType] = useState<string>('');
  const [mediaFileName, setMediaFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  const { data: groups = [], isLoading: loadingGroups } = useSessionGroupsQuery(
    session,
    recipientType === 'group',
  );

  useEffect(() => {
    if (sessions.length > 0 && !session) {
      setSession(sessions[0].id);
    }
  }, [sessions, session]);

  useEffect(() => {
    if (groups.length > 0 && !selectedGroup) {
      setSelectedGroup(groups[0].id);
    }
    if (recipientType !== 'group') {
      setSelectedGroup('');
    }
  }, [groups, selectedGroup, recipientType]);

  useEffect(() => {
    if (recipientType === 'personas' && personas.length === 0) {
      setLoadingPersonas(true);
      fetch('/api/personas?limit=100000', {
        headers: { 'X-API-Key': sessionStorage.getItem('openwa_api_key') || '' }
      })
      .then(res => res.json())
      .then(data => {
        setPersonas(data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoadingPersonas(false));
    }
  }, [recipientType]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Map to lowercase and remove accents/spaces for keys
        const mappedData = data.map((row: any) => {
          const mapped: any = {};
          Object.keys(row).forEach(key => {
            const cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            mapped[cleanKey] = row[key];
          });
          return mapped;
        });

        const validContacts = mappedData.filter(r => r.telefono || r.phone || r.celular);
        
        // Normalize the phone field name to 'telefono'
        const normalizedContacts = validContacts.map(c => ({
          ...c,
          telefono: String(c.telefono || c.phone || c.celular).trim()
        }));

        // Remove duplicates by 'telefono'
        const uniqueContacts = normalizedContacts.filter((contact, index, self) =>
          index === self.findIndex((t) => t.telefono === contact.telefono)
        );

        setExcelData(uniqueContacts);
      } catch (error) {
        console.error('Error parsing Excel file:', error);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleClearExcel = () => {
    setExcelData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setMediaFile(null);
      setMediaBase64('');
      setMediaMimeType('');
      setMediaFileName('');
      return;
    }
    
    setMediaFile(file);
    setMediaMimeType(file.type);
    setMediaFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result as string;
      const b64 = bstr.split(',')[1] || '';
      setMediaBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if (!session) return;
    
    if (recipientType === 'personal' || recipientType === 'group') {
      const targetId = recipientType === 'group' ? selectedGroup : recipient;
      if (!targetId) return;
      setIsLoading(true);
      setResponse(null);

      let chatId = targetId;
      if (recipientType !== 'group') {
        let cleanPhone = targetId.replace(/[^0-9]/g, '');
        if (!cleanPhone.startsWith('57')) {
          cleanPhone = '57' + cleanPhone;
        }
        chatId = cleanPhone + '@c.us';
      }
      try {
        let result;
        // Apply spintax and variables for single sends too if they use it (but no persona object)
        let parsedContent = content.replace(/\\n/g, '\n').replace(/\/n/g, '\n');
        parsedContent = resolveSpintax(parsedContent);
        
        if (messageType === 'text') {
          result = await messageApi.sendText(session, chatId, parsedContent);
        } else if (messageType === 'image') {
          result = await messageApi.sendImage(session, chatId, mediaUrl || undefined, parsedContent, mediaBase64 || undefined, mediaMimeType || undefined, mediaFileName || undefined);
        } else if (messageType === 'video') {
          result = await messageApi.sendVideo(session, chatId, mediaUrl || undefined, parsedContent, mediaBase64 || undefined, mediaMimeType || undefined, mediaFileName || undefined);
        } else if (messageType === 'audio') {
          result = await messageApi.sendAudio(session, chatId, mediaUrl || undefined, mediaBase64 || undefined, mediaMimeType || undefined, mediaFileName || undefined);
        } else {
          result = await messageApi.sendDocument(session, chatId, mediaUrl || undefined, parsedContent, mediaBase64 || undefined, mediaMimeType || undefined, parsedContent);
        }

        setResponse({
          success: !!result.messageId,
          messageId: result.messageId,
          timestamp: result.timestamp ? new Date(result.timestamp * 1000).toISOString() : new Date().toISOString(),
        });
      } catch (err) {
        setResponse({
          success: false,
          timestamp: new Date().toISOString(),
          error: err instanceof Error ? err.message : t('messageTester.sendFailed'),
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      // Bulk Send to Personas or Excel
      const targetList = recipientType === 'excel' ? excelData : personas;
      if (targetList.length === 0) return;
      
      setIsLoading(true);
      setResponse(null);
      
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < targetList.length; i++) {
        setProgress({ current: i + 1, total: targetList.length });
        const p = targetList[i];
        if (!p.telefono) {
          failCount++;
          continue;
        }
        let cleanPhone = String(p.telefono).replace(/[^0-9]/g, '');
        if (!cleanPhone.startsWith('57')) {
          cleanPhone = '57' + cleanPhone;
        }
        const chatId = cleanPhone + '@c.us';
        
        try {
          let parsedContent = content.replace(/\\n/g, '\n').replace(/\/n/g, '\n');
          parsedContent = resolveVariables(parsedContent, p);
          parsedContent = resolveSpintax(parsedContent);
          
          if (messageType === 'text') {
            await messageApi.sendText(session, chatId, parsedContent);
          } else if (messageType === 'image') {
            await messageApi.sendImage(session, chatId, mediaUrl || undefined, parsedContent, mediaBase64 || undefined, mediaMimeType || undefined, mediaFileName || undefined);
          } else if (messageType === 'video') {
            await messageApi.sendVideo(session, chatId, mediaUrl || undefined, parsedContent, mediaBase64 || undefined, mediaMimeType || undefined, mediaFileName || undefined);
          } else if (messageType === 'audio') {
            await messageApi.sendAudio(session, chatId, mediaUrl || undefined, mediaBase64 || undefined, mediaMimeType || undefined, mediaFileName || undefined);
          } else {
            await messageApi.sendDocument(session, chatId, mediaUrl || undefined, parsedContent, mediaBase64 || undefined, mediaMimeType || undefined, parsedContent);
          }
          successCount++;
        } catch (err) {
          failCount++;
        }
        
        // Anti-ban delay logic
        if (i < targetList.length - 1) {
          if ((i + 1) % 10 === 0) {
            // Espera de 30 segundos cada 10 mensajes
            await new Promise(r => setTimeout(r, 30000));
          } else {
            // Intervalo aleatorio entre 15 y 20 segundos
            const delay = Math.floor(Math.random() * (20000 - 15000 + 1)) + 15000;
            await new Promise(r => setTimeout(r, delay));
          }
        }
      }
      
      setResponse({
        success: true,
        timestamp: new Date().toISOString(),
        error: `Enviados: ${successCount}, Fallidos: ${failCount}`,
      });
      setIsLoading(false);
      setProgress(null);
    }
  };

  if (loadingSessions) {
    return (
      <div
        className="message-tester"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="message-tester">
      <PageHeader title={t('messageTester.title')} subtitle={t('messageTester.subtitle')} />

      <div className="tester-panels">
        <div className="compose-panel">
          <h2>{t('messageTester.compose')}</h2>

          <div className="form-group">
            <label>{t('messageTester.session')}</label>
            <select value={session} onChange={e => setSession(e.target.value)}>
              {sessions.length === 0 && <option value="">{t('messageTester.noReadySessions')}</option>}
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.phone || t('messageTester.sessionOptionPhoneNone')})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t('messageTester.recipientType')}</label>
            <div className="toggle-group">
              <button
                className={recipientType === 'personal' ? 'active' : ''}
                onClick={() => setRecipientType('personal')}
              >
                {t('messageTester.personal')}
              </button>
              <button className={recipientType === 'group' ? 'active' : ''} onClick={() => setRecipientType('group')}>
                {t('messageTester.group')}
              </button>
              <button className={recipientType === 'personas' ? 'active' : ''} onClick={() => setRecipientType('personas')}>
                Personas
              </button>
              <button className={recipientType === 'excel' ? 'active' : ''} onClick={() => setRecipientType('excel')}>
                Excel
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>
              {recipientType === 'group' 
                ? t('messageTester.selectGroup') 
                : recipientType === 'personas' 
                  ? 'Directorio de Personas' 
                  : recipientType === 'excel'
                    ? 'Subir Excel'
                    : t('messageTester.recipientPhone')}
            </label>
            {recipientType === 'group' ? (
              <>
                <select
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                  disabled={loadingGroups || groups.length === 0}
                >
                  {loadingGroups && <option value="">{t('messageTester.loadingGroups')}</option>}
                  {!loadingGroups && groups.length === 0 && <option value="">{t('messageTester.noGroupsFound')}</option>}
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <span className="hint">{t('messageTester.selectGroupHint')}</span>
              </>
            ) : recipientType === 'personas' ? (
              <>
                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                  {loadingPersonas ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Loader2 className="animate-spin" size={16} /> Cargando personas...
                    </span>
                  ) : (
                    <span><strong>{personas.length}</strong> personas encontradas en el directorio.</span>
                  )}
                </div>
                <span className="hint">El mensaje se enviará a todas estas personas, con un pequeño retraso entre cada uno.</span>
              </>
            ) : recipientType === 'excel' ? (
              <>
                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".xlsx, .xls, .csv"
                      style={{ display: 'none' }}
                    />
                    <button 
                      className="btn"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ padding: '6px 12px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Upload size={16} /> {excelData.length > 0 ? 'Cambiar Archivo' : 'Subir Archivo'}
                    </button>
                    {excelData.length > 0 && (
                      <button 
                        className="btn"
                        onClick={handleClearExcel}
                        style={{ padding: '6px 12px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', background: '#DC2626', color: 'white', border: 'none' }}
                      >
                        <Trash2 size={16} /> Eliminar
                      </button>
                    )}
                  </div>
                  {excelData.length > 0 && (
                    <span><strong>{excelData.length}</strong> números cargados correctamente desde el Excel.</span>
                  )}
                </div>
                <span className="hint">Asegúrate de que tu Excel tenga una columna llamada "telefono" o "phone".</span>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  placeholder="+62812345678"
                />
                <span className="hint">{t('messageTester.phoneHint')}</span>
              </>
            )}
          </div>

          <div className="form-group">
            <label>{t('messageTester.messageType')}</label>
            <div className="toggle-group">
              {messageTypes.map(type => (
                <button
                  key={type}
                  className={messageType === type ? 'active' : ''}
                  onClick={() => setMessageType(type)}
                >
                  {t(`messageTester.types.${type}`)}
                </button>
              ))}
            </div>
          </div>

          {messageType === 'text' ? (
            <div className="form-group">
              <label>{t('messageTester.messageContent')}</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Ejemplo: {Hola|Buenos días} {{nombres}}, tu paquete va hacia {{municipio}}."
                rows={5}
              />
              <span className="hint" style={{ marginTop: '8px', display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <strong>Spintax:</strong> Usa <code>{'{Opcion1|Opcion2}'}</code> para rotar palabras.<br />
                <strong>Variables:</strong> Usa <code>{'{{columna}}'}</code> para personalizar (ej. <code>{'{{nombres}}'}</code>, <code>{'{{telefono}}'}</code>).
              </span>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Media URL (o subir archivo)</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={mediaUrl}
                    onChange={e => setMediaUrl(e.target.value)}
                    placeholder="https://example.com/file.jpg"
                    disabled={!!mediaFile}
                    style={{ flex: 1 }}
                  />
                  <span>o</span>
                  <input
                    type="file"
                    onChange={handleMediaUpload}
                    accept={messageType === 'image' ? 'image/*' : messageType === 'video' ? 'video/*' : messageType === 'audio' ? 'audio/*' : '*/*'}
                    style={{ flex: 1, padding: '8px' }}
                  />
                </div>
              </div>
              {messageType !== 'audio' && (
                <div className="form-group">
                  <label>
                    {messageType === 'document' ? `${t('messageTester.filename')} (${t('common.optional')})` : t('messageTester.messageContent')}
                  </label>
                  {messageType === 'document' ? (
                    <input
                      type="text"
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder={t('messageTester.filenamePlaceholder')}
                    />
                  ) : (
                    <textarea
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder={t('messageTester.messagePlaceholder')}
                      rows={5}
                    />
                  )}
                </div>
              )}
            </>
          )}

          <button
            className="send-btn"
            onClick={handleSend}
            disabled={
              !canWrite || 
              isLoading || 
              !session || 
              (recipientType === 'group' ? !selectedGroup : recipientType === 'personas' ? personas.length === 0 : recipientType === 'excel' ? excelData.length === 0 : !recipient)
            }
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            {isLoading ? (progress ? `Enviando (${progress.current}/${progress.total})...` : t('messageTester.sending')) : canWrite ? t('messageTester.send') : t('messageTester.viewOnly')}
          </button>
        </div>

        <div className="response-panel">
          <h2>{t('messageTester.responseTitle')}</h2>

          {response ? (
            <>
              <div className={`response-status ${response.success ? 'success' : 'error'}`}>
                {response.success ? (
                  <>
                    <CheckCircle size={20} />
                    <span>{t('messageTester.successLabel')}</span>
                  </>
                ) : (
                  <>
                    <XCircle size={20} />
                    <span>{t('messageTester.failedLabel')}</span>
                  </>
                )}
              </div>

              <div className="response-details">
                <div className="detail-row">
                  <span className="detail-label">{t('messageTester.response.timestamp')}</span>
                  <span className="detail-value">{response.timestamp}</span>
                </div>
                {response.messageId && (
                  <div className="detail-row">
                    <span className="detail-label">{t('messageTester.response.messageId')}</span>
                    <span className="detail-value mono">{response.messageId}</span>
                  </div>
                )}
                {response.error && (
                  <div className="detail-row">
                    <span className="detail-label">{t('messageTester.response.error')}</span>
                    <span className="detail-value" style={{ color: '#DC2626' }}>
                      {response.error}
                    </span>
                  </div>
                )}
              </div>

              <div className="response-json">
                <pre>{JSON.stringify(response, null, 2)}</pre>
              </div>
            </>
          ) : (
            <div className="response-empty">
              <p>{t('messageTester.responseEmpty')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
