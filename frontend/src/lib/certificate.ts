import { jsPDF } from 'jspdf'

export type CertificateInput = {
  name: string
  course: string
  hours: number
  date: string
  certificateId?: string
}

/**
 * Generates a unique 10-digit/character alphanumeric certificate ID (e.g. "9K2M4X7B1Z").
 * Strictly 10 characters in length, containing uppercase letters (A-Z) and digits (0-9).
 */
export function generateCertificateId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const getRandomByte = (): number => {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const arr = new Uint8Array(1)
      window.crypto.getRandomValues(arr)
      return arr[0]
    }
    return Math.floor(Math.random() * 256)
  }

  let id = ''
  do {
    id = ''
    for (let i = 0; i < 10; i++) {
      id += chars[getRandomByte() % chars.length]
    }
  } while (!/[A-Z]/.test(id) || !/[0-9]/.test(id))

  return id
}

/**
 * Retrieves a persistent certificate ID for a completed course or generates and caches a new one.
 */
export function getOrCreateCertificateId(courseId: string): string {
  const key = `forgelearn-cert-id:${courseId}`
  try {
    const existing = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
    if (existing && /^[A-Za-z0-9]{10}$/.test(existing)) {
      return existing.toUpperCase()
    }
    const fresh = generateCertificateId()
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, fresh)
    }
    return fresh
  } catch {
    return generateCertificateId()
  }
}

export function downloadCertificate({ name, course, hours, date, certificateId }: CertificateInput): string {
  const certId = (certificateId && certificateId.trim()) || generateCertificateId()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()

  doc.setFillColor(8, 18, 28)
  doc.rect(0, 0, width, height, 'F')

  doc.setDrawColor(212, 175, 55)
  doc.setLineWidth(4)
  doc.rect(28, 28, width - 56, height - 56, 'S')
  doc.setLineWidth(1.2)
  doc.rect(38, 38, width - 76, height - 76, 'S')

  // Top-right corner UUID badge
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(212, 175, 55)
  doc.text(`UUID: ${certId}`, width - 55, 62, { align: 'right' })

  doc.setTextColor(212, 175, 55)
  doc.setFont('times', 'italic')
  doc.setFontSize(16)
  doc.text('FORGELEARN ACADEMY', width / 2, 92, { align: 'center' })

  doc.setFont('times', 'bold')
  doc.setFontSize(36)
  doc.setTextColor(250, 248, 240)
  doc.text('Certificate of Completion', width / 2, 148, { align: 'center' })

  doc.setDrawColor(45, 212, 191)
  doc.setLineWidth(1.5)
  doc.line(width / 2 - 90, 164, width / 2 + 90, 164)

  doc.setFont('times', 'italic')
  doc.setFontSize(14)
  doc.setTextColor(180, 190, 200)
  doc.text('This is to certify that', width / 2, 210, { align: 'center' })

  doc.setFont('times', 'bold')
  doc.setFontSize(32)
  doc.setTextColor(45, 212, 191)
  doc.text(name, width / 2, 258, { align: 'center' })

  doc.setFont('times', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(220, 226, 232)
  doc.text('has successfully completed the development course', width / 2, 300, { align: 'center' })

  doc.setFont('times', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(250, 248, 240)
  doc.text(course, width / 2, 338, { align: 'center' })

  doc.setFont('times', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(180, 190, 200)
  doc.text(
    `a ${hours}-hour guided path covering MongoDB, Express, React, and Node.js.`,
    width / 2,
    372,
    { align: 'center' },
  )

  doc.setFont('times', 'italic')
  doc.setFontSize(12)
  doc.setTextColor(212, 175, 55)
  doc.text(date, width / 2 - 180, 450, { align: 'center' })
  doc.text('Lead Instructor', width / 2 + 180, 450, { align: 'center' })

  doc.setDrawColor(180, 190, 200)
  doc.setLineWidth(0.8)
  doc.line(width / 2 - 250, 432, width / 2 - 110, 432)
  doc.line(width / 2 + 110, 432, width / 2 + 250, 432)

  doc.setFont('times', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(160, 170, 180)
  doc.text('Issued on', width / 2 - 180, 468, { align: 'center' })
  doc.text('A. Rao', width / 2 + 180, 432, { align: 'center' })
  doc.text('ForgeLearn', width / 2 + 180, 468, { align: 'center' })

  // Unique 10-digit alphanumeric Certificate UUID
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(212, 175, 55)
  doc.text(`Certificate UUID: ${certId}`, width / 2, 510, { align: 'center' })

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  doc.save(`forgelearn-${slug || 'certificate'}.pdf`)
  return certId
}
