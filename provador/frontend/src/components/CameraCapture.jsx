import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";

const CONFIG_VIDEO = { width: 480, height: 600, facingMode: "user" };

export default function CameraCapture({ onFotoCapturada }) {
  const webcamRef = useRef(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [cameraPronta, setCameraPronta] = useState(false);

  const capturar = useCallback(() => {
    const imagemBase64 = webcamRef.current?.getScreenshot();
    if (!imagemBase64) return;
    setFotoPreview(imagemBase64);
    onFotoCapturada(imagemBase64);
  }, [onFotoCapturada]);

  const refazer = () => {
    setFotoPreview(null);
    onFotoCapturada(null);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-sans text-ivory-dim text-center max-w-[280px]">
        Fique de frente para a câmara, enquadrando da cintura para cima
      </p>

      <div className="relative w-full max-w-[280px] aspect-[4/5] overflow-hidden rounded-sm border border-brass-dim">
        {/* cantos de latão, como acabamento de moldura de espelho */}
        <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-brass z-10" />
        <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-brass z-10" />
        <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-brass z-10" />
        <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-brass z-10" />

        {fotoPreview ? (
          <img src={fotoPreview} alt="Foto capturada" className="w-full h-full object-cover" />
        ) : (
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored
            screenshotFormat="image/jpeg"
            screenshotQuality={0.92}
            videoConstraints={CONFIG_VIDEO}
            onUserMedia={() => setCameraPronta(true)}
            className="w-full h-full object-cover"
          />
        )}

        {!cameraPronta && !fotoPreview && (
          <div className="absolute inset-0 flex items-center justify-center bg-navy text-ivory-dim text-sm font-sans">
            A ligar a câmara…
          </div>
        )}
      </div>

      {fotoPreview ? (
        <button
          type="button"
          onClick={refazer}
          className="text-sm font-sans text-ivory-dim underline decoration-brass-dim underline-offset-4 hover:text-ivory transition-colors"
        >
          Tirar outra foto
        </button>
      ) : (
        <button
          type="button"
          onClick={capturar}
          disabled={!cameraPronta}
          className="px-5 py-2 rounded-sm bg-brass text-charcoal font-sans font-semibold text-sm tracking-wide disabled:opacity-40 hover:bg-ivory transition-colors"
        >
          Capturar foto
        </button>
      )}
    </div>
  );
}
