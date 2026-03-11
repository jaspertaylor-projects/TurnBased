import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

type AssetItem = {
    id: string;
    kind: string;
    r2_key: string;
    bytes: number;
    mime: string;
    created_at: string;
}

export const Assets = () => {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    const parts = hash.split('/');
    if (parts.length > 2) {
      setProjectId(parts[2]);
    }
  }, []);

  useEffect(() => {
    if (projectId) fetchAssets();
  }, [projectId]);

  const fetchAssets = async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (data) setAssets(data);
      if (error) console.error(error);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !projectId) return;

      setIsUploading(true);
      setUploadError('');

      try {
          // 1. Get Signed URL
          const { data: signData, error: signErr } = await supabase.functions.invoke('assets-manager', {
              body: {
                  action: 'sign-upload',
                  projectId,
                  fileName: file.name,
                  mime: file.type || 'application/octet-stream',
                  sizeBytes: file.size
              }
          });

          if (signErr || !signData?.success) throw new Error(signErr?.message || 'Failed to sign upload');

          // 2. Mock completing the upload directly (in reality, we PUT to data.uploadUrl)
          await new Promise(r => setTimeout(r, 1000));

          // 3. Finalize upload metadata
          const { data: finalizeData, error: finalizeErr } = await supabase.functions.invoke('assets-manager', {
            body: {
                action: 'finalize-upload',
                projectId,
                r2Key: signData.r2Key,
                mime: file.type || 'application/octet-stream',
                sizeBytes: file.size
            }
          });

          if (finalizeErr || !finalizeData?.success) throw new Error(finalizeErr?.message || 'Failed to finalize');

          fetchAssets();

      } catch (err: any) {
          setUploadError(err.message);
      } finally {
          setIsUploading(false);
          // clear input
          e.target.value = '';
      }
  };

  const generateAiImage = async () => {
    const prompt = window.prompt("What do you want to generate?");
    if (!prompt || !projectId) return;
    
    setIsUploading(true);
    try {
        const { error } = await supabase.functions.invoke('ai-image-agent', {
            body: { projectId, prompt }
        });
        if (error) throw error;
        fetchAssets();
    } catch (err: any) {
        alert("Gen Failed: " + err.message);
    } finally {
        setIsUploading(false);
    }
  };

  if (!projectId) return <div>Loading Project ID...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2>Project Assets</h2>
            <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={generateAiImage}
                  disabled={isUploading}
                  style={{ padding: '0.5rem 1rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    ✨ Generate AI Art
                </button>
                <div style={{ position: 'relative' }}>
                    <input 
                        type="file" 
                        onChange={handleFileUpload} 
                        disabled={isUploading}
                        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                        title="Upload Asset"
                    />
                    <button style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', pointerEvents: 'none' }}>
                       {isUploading ? 'Uploading...' : 'Upload File'}
                    </button>
                </div>
            </div>
        </div>

        {uploadError && <div style={{ color: 'red', marginBottom: '1rem' }}>{uploadError}</div>}

        {assets.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                <p>No assets found. Upload files or generate AI art to get started.</p>
            </div>
        ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
                {assets.map(asset => (
                    <div key={asset.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', background: 'white' }}>
                        <div style={{ height: '120px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', borderRadius: '4px' }}>
                            {asset.kind === 'image' ? '🖼️' : asset.kind === 'audio' ? '🎵' : '📄'}
                        </div>
                        <p style={{ fontSize: '12px', margin: '0 0 0.5rem 0', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                            {asset.r2_key.split('/').pop()}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px' }}>
                            <span>{(asset.bytes / 1024).toFixed(1)} KB</span>
                            <span>{new Date(asset.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
}
