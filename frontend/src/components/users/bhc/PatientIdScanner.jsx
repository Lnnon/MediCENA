import SearchableReferralSelect from '../shared/SearchableReferralSelect'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Upload, ScanLine, X, Loader2 } from 'lucide-react'
import { ID_TYPES, OCR_FIELD_LABELS, applyIdFields, parseGovernmentId, parseIdDate } from '../../../services/idOcr'
import './PatientIdScanner.css'

const MAX_BYTES = 8 * 1024 * 1024

function ScannerDialog({ method, initialFile, formRef, onClose }) {
  const dialog = useRef(null)
  const video = useRef(null)
  const worker = useRef(null)
  const alive = useRef(false)
  const busy = useRef(false)
  const [type, setType] = useState('')
  const [image, setImage] = useState(null)
  const [cameras, setCameras] = useState([])
  const [device, setDevice] = useState('')
  const [cameraAttempt, setCameraAttempt] = useState(0)
  const [ready, setReady] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [review, setReview] = useState(null)
  const [replace, setReplace] = useState(false)
  const [confidence, setConfidence] = useState(null)
  const [nameNeedsReview, setNameNeedsReview] = useState(false)
  const [namesConfirmed, setNamesConfirmed] = useState(false)
  const [focusText, setFocusText] = useState(false)
  const [crop, setCrop] = useState({ left: 30, top: 25, width: 45, height: 50 })
  const [recognizedText, setRecognizedText] = useState('')
  const fileInput = useRef(null)

  useEffect(() => {
    alive.current = true
    dialog.current.showModal()
    return () => { alive.current = false; worker.current?.terminate(); worker.current = null }
  }, [])
  useEffect(() => () => { if (image?.url) URL.revokeObjectURL(image.url) }, [image])

  const loadPhoto = async (file) => {
    if (!file) return
    setError(''); setReview(null); setRecognizedText('')
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setError('Choose a JPG or PNG photo.'); return }
    if (file.size > MAX_BYTES) { setError('Photo is too large. Choose one smaller than 8 MB.'); return }
    let bitmap
    try {
      bitmap = await createImageBitmap(file)
      if (bitmap.width < 200 || bitmap.height < 100 || bitmap.width * bitmap.height > 40000000) throw new Error('size')
      if (alive.current) setImage({ blob: file, url: URL.createObjectURL(file) })
    } catch { if (alive.current) setError('This photo is damaged, too small, or too large to read. Choose a clear ID photo.') }
    finally { bitmap?.close() }
  }

  useEffect(() => {
    if (!initialFile) return
    // File decoding is asynchronous and does not modify the patient form.
    queueMicrotask(() => { if (alive.current) void loadPhoto(initialFile) })
  }, [initialFile])

  useEffect(() => {
    if (method !== 'camera' || !type || image) return undefined
    let active = true
    let stream
    const start = async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('secure')
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: device ? { deviceId: { exact: device }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: { ideal: 'environment' } } })
        if (!active) { stream.getTracks().forEach((track) => track.stop()); return }
        video.current.srcObject = stream
        await video.current.play()
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (active) {
          setCameras(devices.filter((item) => item.kind === 'videoinput')); setReady(true)
          stream.getVideoTracks().forEach((track) => { track.onended = () => { if (active) { setReady(false); setError('Camera disconnected. Reconnect it, select another camera, or upload a photo.') } } })
        }
      } catch (failure) {
        stream?.getTracks().forEach((track) => track.stop())
        if (!active) return
        const message = failure.message === 'secure' ? 'Camera access requires HTTPS or localhost. You can upload a photo instead.' : failure.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser, or upload a photo.' : failure.name === 'NotFoundError' ? 'No camera detected. Connect a webcam or upload a photo.' : 'Unable to open the camera. Check that it is connected and not being used elsewhere.'
        setError(message)
      }
    }
    void start()
    return () => { active = false; stream?.getTracks().forEach((track) => track.stop()) }
  }, [method, type, device, image, cameraAttempt])

  const readImage = async (blob) => {
    if (!blob || !type || busy.current) return
    busy.current = true; setProcessing(true); setError(''); setProgress(0); setReview(null); setRecognizedText('')
    let bitmap
    try {
      bitmap = await createImageBitmap(blob)
      const left = focusText ? bitmap.width * crop.left / 100 : 0
      const top = focusText ? bitmap.height * crop.top / 100 : 0
      const width = focusText ? bitmap.width * Math.min(crop.width, 100 - crop.left) / 100 : bitmap.width
      const height = focusText ? bitmap.height * Math.min(crop.height, 100 - crop.top) / 100 : bitmap.height
      const scale = Math.min(4, 2200 / Math.max(width, height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale)
      const context = canvas.getContext('2d')
      context.filter = 'grayscale(1) contrast(1.15)'
      context.drawImage(bitmap, left, top, width, height, 0, 0, canvas.width, canvas.height)
      if (!worker.current) {
        const { createWorker } = await import('tesseract.js')
        if (!alive.current) return
        const base = `${import.meta.env.BASE_URL}ocr`
        const initialized = await createWorker('eng', 1, {
          workerPath: `${base}/worker.min.js`, corePath: `${base}/core`, langPath: `${base}/lang`,
          logger: (message) => { if (alive.current) setProgress(Math.round((message.progress || 0) * 100)) },
          errorHandler: () => {},
        })
        if (!alive.current) { await initialized.terminate(); return }
        worker.current = initialized
      }
      await worker.current.setParameters({ tessedit_pageseg_mode: '6' })
      let { data } = await worker.current.recognize(canvas, { rotateAuto: true })
      let parsed = parseGovernmentId(data.text, type)
      if (['firstName', 'middleName', 'lastName'].some((key) => !parsed[key])) {
        await worker.current.setParameters({ tessedit_pageseg_mode: '11' })
        const alternate = (await worker.current.recognize(canvas, { rotateAuto: true })).data
        const alternativeFields = parseGovernmentId(alternate.text, type)
        const score = (fields) => Object.keys(OCR_FIELD_LABELS).filter((key) => fields[key]).length
        if (score(alternativeFields) > score(parsed)) { data = alternate; parsed = alternativeFields }
      }
      canvas.width = 0; canvas.height = 0
      if (!alive.current) return
      setConfidence(data.confidence)
      setRecognizedText(data.text || '')
      const fields = Object.fromEntries(Object.keys(OCR_FIELD_LABELS).map((key) => [key, parsed[key] || '']))
      setReview(fields)
      setNameNeedsReview(Boolean(parsed.nameNeedsReview)); setNamesConfirmed(false)
      if (!Object.values(fields).some(Boolean)) setError(data.text?.trim() ? 'Text was read, but the ID labels or layout could not be matched. Check Recognized Text below, enter the correct details in the review fields, or try a sharper photo.' : 'No readable text was found. Retake a sharper photo with better lighting, or enter the details manually.')
      else if (data.confidence < 60) setError('The image may be blurry. Please check every extracted field or retake the photo.')
      else if (Object.values(fields).some((value) => !value)) setError('Only the available details were extracted. You can use the name alone and complete missing fields manually.')
    } catch {
      if (alive.current) setError('Unable to read this ID. Try a clearer photo. Check that the local OCR files have been installed; manual registration is still available.')
      worker.current?.terminate(); worker.current = null
    } finally { bitmap?.close(); busy.current = false; if (alive.current) setProcessing(false) }
  }

  const capture = async () => {
    if (!video.current?.videoWidth || !ready) return
    const canvas = document.createElement('canvas')
    canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight
    canvas.getContext('2d').drawImage(video.current, 0, 0)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95))
    canvas.width = 0; canvas.height = 0
    if (blob && alive.current) { setImage({ blob, url: URL.createObjectURL(blob) }); await readImage(blob) }
  }

  const useFields = () => {
    if (nameNeedsReview && !namesConfirmed) { setError('Review and confirm the suggested first and middle names before applying them.'); return }
    if (review.birthDate && !parseIdDate(review.birthDate)) { setError('Check the birth date. It must be a valid past or present date.'); return }
    const changed = applyIdFields(formRef.current, review, replace)
    onClose(changed.length ? 'Extracted details applied. Review the highlighted fields before continuing.' : 'Existing entries were kept. No blank fields were filled.')
  }

  return createPortal(<dialog className="patient-id-dialog" ref={dialog} aria-labelledby="patient-id-title" onKeyDown={(event) => event.stopPropagation()} onCancel={(event) => { event.preventDefault(); onClose() }}>
    <header><div><h2 id="patient-id-title">Scan Government ID</h2><p>Optional autofill only. This does not verify the ID’s authenticity.</p></div><button type="button" aria-label="Close ID scanner" onClick={() => onClose()}><X size={20} /></button></header>
    <div className="patient-id-body">
      <label className="patient-id-type">ID Type<SearchableReferralSelect name="scannedIdType" label="ID Type" placeholder="Search or select ID type..." items={ID_TYPES.map(([value, label]) => ({ value, label }))} disabled={processing} onValueChange={(value) => { setReady(false); setType(value); setReview(null); setRecognizedText(''); setError('') }} /></label>
      {error && <p className="patient-id-error" role="alert">{error}</p>}
      {type && <div className="patient-id-workspace">
        <section className="patient-id-source" aria-label="ID image">
          {method === 'camera' && !image && <><div className="patient-id-camera"><video ref={video} autoPlay muted playsInline /><div className="patient-id-guide" /></div><p>Place your ID inside the frame. Keep the entire card visible.</p>{cameras.length > 1 && <label>Camera<select value={device} onChange={(event) => { setReady(false); setError(''); setDevice(event.target.value) }}><option value="">Default camera</option>{cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Camera ${index + 1}`}</option>)}</select></label>}<button className="id-primary" type="button" disabled={!ready || processing} onClick={capture}><Camera size={16} />Capture and Read ID</button></>}
          {image && <><div className="patient-id-preview-frame"><img className="patient-id-preview" src={image.url} alt="Selected ID for local reading" />{focusText && <div className="patient-id-crop-guide" style={{ left: `${crop.left}%`, top: `${crop.top}%`, width: `${Math.min(crop.width, 100 - crop.left)}%`, height: `${Math.min(crop.height, 100 - crop.top)}%` }} />}</div><label className="patient-id-overwrite"><input type="checkbox" checked={focusText} disabled={processing} onChange={(event) => { setFocusText(event.target.checked); setReview(null); setRecognizedText('') }} />Focus on the name and birth-date area</label>{focusText && <div className="patient-id-crop-controls"><p>Adjust the blue box to include the field labels and values, avoiding the portrait and QR code. Then click Read ID.</p>{[['left', 'Left'], ['top', 'Top'], ['width', 'Width'], ['height', 'Height']].map(([key, label]) => <label key={key}>{label}: {crop[key]}%<input type="range" min={key === 'left' || key === 'top' ? 0 : 10} max={key === 'left' || key === 'top' ? 90 : 100} value={crop[key]} disabled={processing} onChange={(event) => { setCrop((current) => ({ ...current, [key]: Number(event.target.value) })); setReview(null); setRecognizedText('') }} /></label>)}</div>}</>}
          <input ref={fileInput} hidden type="file" accept="image/jpeg,image/png" onChange={(event) => { void loadPhoto(event.target.files?.[0]); event.target.value = '' }} />
          <div className="patient-id-source-actions">
            {method === 'camera' && !image && !ready && <button type="button" onClick={() => { setError(''); setCameraAttempt((current) => current + 1) }}>Retry camera</button>}
            {image && <button className="id-primary" type="button" disabled={processing} onClick={() => readImage(image.blob)}>Read ID</button>}
            <button type="button" disabled={processing} onClick={() => fileInput.current.click()}><Upload size={16} />{image ? 'Choose another photo' : 'Upload a Photo'}</button>
            {method === 'camera' && image && <button type="button" disabled={processing} onClick={() => { setReady(false); setImage(null); setReview(null); setError('') }}>Retake</button>}
          </div>
        </section>
        {review && <section className="patient-id-review"><h3>Review Extracted Information</h3><p>Correct any mistakes. Blank fields will not replace existing entries.</p>{Object.entries(OCR_FIELD_LABELS).map(([key, label]) => <label key={key}>{label}<input maxLength={key === 'contactNumber' ? 11 : 150} inputMode={key === 'contactNumber' ? 'numeric' : undefined} type={key === 'birthDate' ? 'date' : key === 'contactNumber' ? 'tel' : 'text'} value={review[key]} onChange={(event) => setReview((current) => ({ ...current, [key]: key === 'contactNumber' ? event.target.value.replace(/[^0-9]/g, '').slice(0, 11) : event.target.value }))} /></label>)}<small>OCR confidence: {Math.round(confidence || 0)}%. Always review the details.</small><label className="patient-id-overwrite"><input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} />I confirm replacing already filled name, contact number, or birth date fields with the reviewed values.</label></section>}
      </div>}
      {processing && <div className="patient-id-progress" role="status"><Loader2 size={18} />Reading ID locally… {progress}%<progress max="100" value={progress} /></div>}
      {recognizedText && <details className="patient-id-recognized"><summary>Recognized Text (for review only)</summary><pre>{recognizedText}</pre></details>}
      {review && nameNeedsReview && <div className="patient-id-error"><p>Some name text was ambiguous or contained OCR artifacts. Check and correct all suggested names above, especially compound names.</p><label className="patient-id-overwrite"><input type="checkbox" checked={namesConfirmed} onChange={(event) => setNamesConfirmed(event.target.checked)} />I have checked the first, middle, and last names against the ID.</label></div>}
      <p className="patient-id-privacy">ID images stay in this browser and are discarded when you close the scanner. Only clearly printed details are suggested. Missing contact numbers and birth dates stay blank.</p>
    </div>
    <footer><button type="button" onClick={() => onClose()}>Cancel</button>{review && <button className="id-primary" type="button" disabled={processing || !Object.values(review).some(Boolean) || (nameNeedsReview && !namesConfirmed)} onClick={useFields}>Use Extracted Information</button>}</footer>
  </dialog>, document.body)
}

export default function PatientIdScanner({ formRef }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [session, setSession] = useState(null)
  const [notice, setNotice] = useState('')
  const menu = useRef(null)
  const button = useRef(null)
  const fileInput = useRef(null)
  useEffect(() => {
    if (!menuOpen) return undefined
    const close = (event) => { if (!menu.current?.contains(event.target)) setMenuOpen(false) }
    const key = (event) => { if (event.key === 'Escape') { setMenuOpen(false); button.current?.focus() } }
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key) }
  }, [menuOpen])
  return <div className="patient-id-scan-control" ref={menu}>
    <button ref={button} type="button" className="patient-id-scan-button" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}><ScanLine size={16} />Scan ID</button>
    {menuOpen && <div className="patient-id-menu" aria-label="ID scanning options"><button type="button" onClick={() => { setMenuOpen(false); setNotice(''); setSession({ method: 'camera' }) }}><Camera size={20} /><span>Open Camera<small>Scan an ID using a connected camera.</small></span></button><button type="button" onClick={() => { setMenuOpen(false); fileInput.current.click() }}><Upload size={20} /><span>Upload a Photo<small>Choose an existing ID photo.</small></span></button></div>}
    <input hidden ref={fileInput} type="file" accept="image/jpeg,image/png" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setNotice(''); setSession({ method: 'upload', file }) } event.target.value = '' }} />
    {notice && <span className="patient-id-applied" role="status">{notice}</span>}
    {session && <ScannerDialog method={session.method} initialFile={session.file} formRef={formRef} onClose={(message) => { setSession(null); setNotice(message || ''); button.current?.focus() }} />}
  </div>
}
