import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';

interface ImageUploadProps {
  endpoint: string;
  fieldName: string;
  currentImage?: string | null;
  onUploadSuccess: (url: string) => void;
  maxSizeMB?: number;
  shape?: 'circle' | 'square';
  label?: string;
}

export const ImageUpload = ({ endpoint, fieldName, currentImage, onUploadSuccess, maxSizeMB = 2, shape = 'square', label = 'Upload ảnh' }: ImageUploadProps) => {
  const { authHeaders } = useAuth();
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) return 'Vui lòng chọn file ảnh';
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) return 'Chỉ chấp nhận JPG, PNG, GIF, WEBP';
    return null;
  };

  const compressImage = (file: File, maxSize: number, maxDim = 1200): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (file.size <= maxSize) { resolve(file); return; }
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        URL.revokeObjectURL(img.src);
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.8;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) { reject(new Error('Nén ảnh thất bại')); return; }
              if (blob.size <= maxSize || quality <= 0.3) {
                resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
              } else {
                quality -= 0.1;
                tryCompress();
              }
            },
            'image/jpeg',
            quality
          );
        };
        tryCompress();
      };
      img.onerror = () => reject(new Error('Không thể đọc ảnh'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFile = useCallback(async (file: File) => {
    setError('');
    setSuccess(false);
    const err = validateFile(file);
    if (err) { setError(err); return; }
    try {
      const processed = await compressImage(file, maxSizeBytes);
      setSelectedFile(processed);
      if (preview) URL.revokeObjectURL(preview);
      const url = URL.createObjectURL(processed);
      setPreview(url);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [maxSizeBytes, preview]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setProgress(0);
    setError('');

    const formData = new FormData();
    formData.append(fieldName, selectedFile);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded * 100) / e.total));
        }
      });

      const result = await new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try { reject(new Error(JSON.parse(xhr.responseText).error)); }
            catch { reject(new Error('Upload thất bại')); }
          }
        };
        xhr.onerror = () => reject(new Error('Lỗi kết nối'));
        xhr.open('POST', endpoint);
        const headers = authHeaders();
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v as string));
        xhr.send(formData);
      });

      setSuccess(true);
      const url = result.avatar || result.image_url;
      onUploadSuccess(url);
      setSelectedFile(null);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const clearPreview = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setSelectedFile(null);
    setError('');
    setProgress(0);
    if (inputRef.current) inputRef.current.value = '';
  };

  const displayImage = preview || currentImage;
  const isCircle = shape === 'circle';

  return (
    <div className="space-y-3">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative cursor-pointer transition-all duration-200 overflow-hidden
          ${isCircle ? 'w-32 h-32 rounded-full mx-auto' : 'w-full min-h-[160px] rounded-2xl'}
          ${dragOver
            ? 'border-2 border-dashed border-indigo-500 bg-indigo-50/80 scale-[1.02]'
            : 'border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 bg-slate-50/50'}
        `}
      >
        {displayImage ? (
          <div className="relative w-full h-full group">
            <img
              src={displayImage}
              alt="Preview"
              className={`w-full ${isCircle ? 'h-full' : 'h-40'} object-cover`}
            />
            <div className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center ${isCircle ? 'rounded-full' : 'rounded-2xl'}`}>
              <p className="text-white text-xs font-semibold">Thay đổi ảnh</p>
            </div>
          </div>
        ) : (
          <div className={`flex flex-col items-center justify-center gap-2 ${isCircle ? 'h-full' : 'py-8'}`}>
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-indigo-500" />
            </div>
            {!isCircle && (
              <>
                <p className="text-xs font-semibold text-slate-600">Kéo thả ảnh vào đây</p>
                <p className="text-[10px] text-slate-400">hoặc click để chọn file • Tối đa {maxSizeMB}MB</p>
              </>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Progress Bar */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1"
          >
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-2 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-[10px] text-slate-400 text-center">{progress}% đang upload...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-red-500 font-medium"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Success */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Upload thành công!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm / Cancel Buttons */}
      {selectedFile && !uploading && !success && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-2"
        >
          <button
            onClick={handleUpload}
            className="inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Xác nhận</span>
          </button>
          <button
            onClick={clearPreview}
            className="inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-3.5 h-3.5 shrink-0" />
            <span>Hủy</span>
          </button>
        </motion.div>
      )}

      {/* File Info */}
      {selectedFile && (
        <p className="text-[10px] text-slate-400 text-center">
          {selectedFile.name} • {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
        </p>
      )}
    </div>
  );
};
