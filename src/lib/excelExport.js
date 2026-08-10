const escapeXml = (value = '') => String(value).replace(/[<>&"']/g, character => ({
  '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;',
}[character]))

const safeSheetName = (value, index) => String(value || `Sheet ${index + 1}`)
  .replace(/[\\/:?*]/g, ' ')
  .replaceAll('[', ' ')
  .replaceAll(']', ' ')
  .trim()
  .slice(0, 31) || `Sheet ${index + 1}`

const cellXml = (value, header = false) => {
  const numeric = typeof value === 'number' && Number.isFinite(value)
  const type = numeric ? 'Number' : 'String'
  const style = header ? ' ss:StyleID="Header"' : ''
  return `<Cell${style}><Data ss:Type="${type}">${escapeXml(value ?? '')}</Data></Cell>`
}

export function buildExcelWorkbook(sheets = []) {
  const worksheets = sheets.map((sheet, index) => {
    const rows = [sheet.columns || [], ...(sheet.rows || [])]
      .map((row, rowIndex) => `<Row>${row.map(value => cellXml(value, rowIndex === 0)).join('')}</Row>`)
      .join('')
    return `<Worksheet ss:Name="${escapeXml(safeSheetName(sheet.name, index))}"><Table>${rows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane></WorksheetOptions></Worksheet>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Header"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/><Interior ss:Color="#E0E7FF" ss:Pattern="Solid"/></Style></Styles>${worksheets}</Workbook>`
}

export function downloadExcelWorkbook(filename, sheets) {
  const workbook = buildExcelWorkbook(sheets)
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), workbook], { type:'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
