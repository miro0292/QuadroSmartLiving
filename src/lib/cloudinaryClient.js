const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

function isPlaceholderValue(value) {
  const normalized = String(value || '').trim().toUpperCase()
  return normalized === '' || normalized.includes('TU_') || normalized.includes('YOUR_')
}

export const hasCloudinaryConfig =
  Boolean(cloudinaryCloudName && cloudinaryUploadPreset) &&
  !isPlaceholderValue(cloudinaryCloudName) &&
  !isPlaceholderValue(cloudinaryUploadPreset)

const CLOUDINARY_TIMEOUT_MS = 25000

export async function uploadReceiptToCloudinary(file, options = {}) {
  if (!hasCloudinaryConfig) {
    throw new Error('Configura Cloudinary para subir comprobantes (cloud name y upload preset).')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', cloudinaryUploadPreset)

  const folder = options.userId ? `receipts/${options.userId}` : 'receipts'
  formData.append('folder', folder)

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), CLOUDINARY_TIMEOUT_MS)

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/auto/upload`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })

    const data = await response.json()

    if (!response.ok) {
      const apiMessage = data?.error?.message || 'No fue posible subir el comprobante a Cloudinary.'
      throw new Error(apiMessage)
    }

    if (!data?.secure_url) {
      throw new Error('Cloudinary no retornó la URL segura del comprobante.')
    }

    return {
      secureUrl: data.secure_url,
      publicId: data.public_id,
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('La carga del comprobante tardó demasiado. Verifica la conexión e inténtalo de nuevo.')
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}
