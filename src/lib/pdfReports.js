import { dateToMonth, formatCurrency } from './formatters'

async function getPdfTools() {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  return {
    jsPDF,
    autoTable: autoTableModule.default,
  }
}

function createHeader(doc, title, subtitle) {
  doc.setFontSize(16)
  doc.text('Admin Quadro Smart Living', 14, 16)
  doc.setFontSize(12)
  doc.text(title, 14, 24)
  doc.setFontSize(10)
  doc.text(subtitle, 14, 30)
}

export async function downloadPaymentCertificate(payment, profile) {
  const { jsPDF } = await getPdfTools()
  const doc = new jsPDF()
  const monthLabel = dateToMonth(payment.paid_month)

  createHeader(
    doc,
    'Certificado de pago de administración',
    `Generado: ${new Date().toLocaleString('es-CO')}`,
  )

  doc.setFontSize(11)
  doc.text(`Propietario: ${profile?.full_name || 'N/A'}`, 14, 42)
  doc.text(`Documento: ${profile?.document_number || 'N/A'}`, 14, 49)
  doc.text(`Apartamento: ${payment.apartment_number}`, 14, 56)
  doc.text(`Mes pagado: ${monthLabel}`, 14, 63)
  doc.text(`Monto: ${formatCurrency(payment.amount)}`, 14, 70)
  doc.text(`Estado: ${payment.status}`, 14, 77)
  doc.text(`Canal: ${payment.channel === 'mipagoamigo' ? 'Mi Pago Amigo' : 'Manual'}`, 14, 84)

  doc.setFontSize(9)
  doc.text('Este certificado refleja la información registrada en la plataforma.', 14, 98)

  doc.save(`certificado-pago-${monthLabel}-${payment.apartment_number}.pdf`)
}

export async function downloadOwnerHistoryPdf(payments, profile) {
  const { jsPDF, autoTable } = await getPdfTools()
  const doc = new jsPDF()

  createHeader(
    doc,
    'Histórico de pagos del propietario',
    `Propietario: ${profile?.full_name || 'N/A'} · Documento: ${profile?.document_number || 'N/A'}`,
  )

  autoTable(doc, {
    startY: 38,
    head: [['Mes', 'Apartamento', 'Monto', 'Canal', 'Estado']],
    body: payments.map((payment) => [
      dateToMonth(payment.paid_month),
      payment.apartment_number,
      formatCurrency(payment.amount),
      payment.channel === 'mipagoamigo' ? 'Mi Pago Amigo' : 'Manual',
      payment.status,
    ]),
    styles: { fontSize: 9 },
  })

  doc.save(`historico-pagos-${profile?.apartment_number || 'owner'}.pdf`)
}

export async function downloadAdminDetailedReport({ payments, ownerMap, selectedMonth }) {
  const { jsPDF, autoTable } = await getPdfTools()
  const doc = new jsPDF()

  createHeader(
    doc,
    'Reporte detallado de pagos',
    `Mes de referencia: ${selectedMonth} · Generado: ${new Date().toLocaleString('es-CO')}`,
  )

  const paymentsByMonth = payments.filter((item) => dateToMonth(item.paid_month) === selectedMonth)
  const totalBuilding = paymentsByMonth.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  autoTable(doc, {
    startY: 38,
    head: [['Propietario', 'Documento', 'Apartamento', 'Mes', 'Monto', 'Estado']],
    body: paymentsByMonth.map((payment) => {
      const owner = ownerMap[payment.owner_id] || {}
      return [
        owner.full_name || 'N/A',
        owner.document_number || 'N/A',
        payment.apartment_number,
        dateToMonth(payment.paid_month),
        formatCurrency(payment.amount),
        payment.status,
      ]
    }),
    styles: { fontSize: 9 },
  })

  const totalsByOwner = paymentsByMonth.reduce((acc, payment) => {
    const key = payment.owner_id
    const owner = ownerMap[key] || {}
    if (!acc[key]) {
      acc[key] = {
        name: owner.full_name || 'N/A',
        document: owner.document_number || 'N/A',
        apartment: payment.apartment_number,
        total: 0,
      }
    }

    acc[key].total += Number(payment.amount || 0)
    return acc
  }, {})

  doc.addPage()
  createHeader(doc, 'Consolidado por propietario', `Mes: ${selectedMonth}`)

  autoTable(doc, {
    startY: 38,
    head: [['Propietario', 'Documento', 'Apartamento', 'Total pagado']],
    body: Object.values(totalsByOwner).map((item) => [
      item.name,
      item.document,
      item.apartment,
      formatCurrency(item.total),
    ]),
    styles: { fontSize: 9 },
  })

  const finalY = doc.lastAutoTable?.finalY || 60
  doc.setFontSize(12)
  doc.text(`Total del edificio (${selectedMonth}): ${formatCurrency(totalBuilding)}`, 14, finalY + 12)

  doc.save(`reporte-detallado-${selectedMonth}.pdf`)
}
