import { useState, useRef } from 'react';

export default function CameraInput({ onCapture, multiple = false, label = 'Take Photo / Upload' }) {
  const [previews, setPreviews] = useState([]);
  const inputRef = useRef(null);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPreviews = [];
    const blobs = [];

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const blob = new Blob([buffer], { type: file.type });
      blobs.push(blob);

      const url = URL.createObjectURL(blob);
      newPreviews.push({ url, name: file.name });
    }

    if (multiple) {
      setPreviews(prev => [...prev, ...newPreviews]);
      onCapture(blobs, true);
    } else {
      previews.forEach(p => URL.revokeObjectURL(p.url));
      setPreviews(newPreviews);
      onCapture(blobs[0], false);
    }

    if (inputRef.current) inputRef.current.value = '';
  }

  function removePhoto(index) {
    URL.revokeObjectURL(previews[index].url);
    const updated = previews.filter((_, i) => i !== index);
    setPreviews(updated);
    onCapture(null, false, index);
  }

  return (
    <div>
      <label className="btn btn-secondary btn-block" style={{ cursor: 'pointer', marginBottom: 8 }}>
        {previews.length > 0 ? `${previews.length} photo${previews.length > 1 ? 's' : ''} captured` : label}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple={multiple}
          onChange={handleFiles}
          style={{ display: 'none' }}
        />
      </label>

      {previews.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {previews.map((p, i) => (
            <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
              <img
                src={p.url}
                alt={p.name}
                style={{ width: 80, height: 80, objectFit: 'cover', border: '1px solid var(--color-border)' }}
              />
              <button
                onClick={() => removePhoto(i)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 22, height: 22, 
                  background: 'var(--color-danger)', color: 'white',
                  border: 'none', fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
