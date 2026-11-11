import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWorker } from 'tesseract.js'
import { ID_TYPES, parseGovernmentId, parseIdDate, registrationValues, applyIdFields } from '../src/services/idOcr.js'

test('conservative date parsing validates actual dates and rejects ambiguity', () => {
  assert.equal(parseIdDate('21 AUGUST 1995'), '1995-08-21')
  assert.equal(parseIdDate('August 21, 1995'), '1995-08-21')
  assert.equal(parseIdDate('1995/08/21'), '1995-08-21')
  assert.equal(parseIdDate('21/08/1995'), '1995-08-21')
  assert.equal(parseIdDate('03/04/1995'), '')
  assert.equal(parseIdDate('1995-02-31'), '')
  assert.equal(parseIdDate('2099-01-01'), '')
})

test('ID parser never invents missing names, contact, civil status, or ID numbers', () => {
  assert.equal(ID_TYPES.length, 12)
  const result = parseGovernmentId('Surname: SAMPLE\nGiven Names: TEST\nSex: F\nID Number: 123456789', 'passport')
  assert.equal(result.lastName, 'SAMPLE')
  assert.equal(result.firstName, 'TEST')
  assert.equal(result.sex, 'Female')
  assert.equal(result.birthDate, '')
  assert.equal(result.contactNumber, '')
  assert.equal('civilStatus' in result, false)
  assert.equal('idNumber' in result, false)
  assert.deepEqual(parseGovernmentId('REPUBLIC OF THE PHILIPPINES\nNO READABLE FIELDS', 'philid'), { firstName: '', middleName: '', lastName: '', birthDate: '', sex: '', contactNumber: '' })
})

test('license comma name and separate date form controls', () => {
  const result = parseGovernmentId('Name: SAMPLE, TEST DEMO\nDate of Birth: 1995-08-21\nSex: MALE', 'license')
  assert.equal(result.lastName, 'SAMPLE')
  assert.equal(result.firstName, 'TEST DEMO')
  const mapped = registrationValues(result)
  assert.equal(mapped.birthYear, '1995'); assert.equal(mapped.birthMonth, '08'); assert.equal(mapped.birthDay, '21')
})

test('birth date label variants map to registration date controls', () => {
  for (const label of ['Date of Birth', 'Birth Date', 'Birthdate', 'DOB', 'D.O.B.', 'Birthday']) {
    const result = parseGovernmentId(`${label}: 1995-08-21`, 'other')
    assert.equal(result.birthDate, '1995-08-21', label)
    assert.equal(registrationValues(result).birthMonth, '08')
  }
})

test('name labels handle fused words, reverse bilingual labels, and inline columns', () => {
  const fused = parseGovernmentId('FirstName: TEST\nMiddleName: D.\nLastName: SAMPLE', 'other')
  assert.equal(fused.firstName, 'TEST'); assert.equal(fused.middleName, 'D.'); assert.equal(fused.lastName, 'SAMPLE')
  const bilingual = parseGovernmentId('LAST NAME / APELYIDO\nSAMPLE\nGIVEN NAMES / MGA PANGALAN\nTEST', 'philid')
  assert.equal(bilingual.firstName, 'TEST'); assert.equal(bilingual.lastName, 'SAMPLE')
  const inline = parseGovernmentId('Last Name: SAMPLE First Name: TEST Middle Name: DEMO', 'other')
  assert.equal(inline.firstName, 'TEST'); assert.equal(inline.middleName, 'DEMO'); assert.equal(inline.lastName, 'SAMPLE')
})

test('unlabeled OCR fragments are not accepted as middle names', () => {
  assert.equal(parseGovernmentId('MI El\nUNREADABLE CARD TEXT', 'philid').middleName, '')
  assert.equal(parseGovernmentId('MIDDLE NAME - :\nSAMPLE', 'philid').middleName, 'SAMPLE')
})

test('national ID ignores label-line artifacts and reads following values', () => {
  const result = parseGovernmentId('A 1234 a APLNDO LAST NAME [=] [=] -\n11 Li SAMPLE\nMGA PANGAN. CEN NAME |\nTEST\nGITNANG APELVIDO MIDDLE NAME AI\nDEMO\nPETSA NG KAPANGANAKAN DATE OF BIRTH\nFebruary 25, 2004', 'ephilid')
  assert.equal(result.lastName, 'SAMPLE')
  assert.equal(result.firstName, 'TEST')
  assert.equal(result.middleName, 'DEMO')
  assert.equal(result.birthDate, '2004-02-25')
})

test('PhilID bilingual labels are interpreted without collecting ID numbers', () => {
  const result = parseGovernmentId('APELYIDO / LAST NAME\nSAMPLE\nMGA PANGALAN / GIVEN NAMES\nTEST\nGITNANG APELYIDO / MIDDLE NAME\nDEMO\nPETSA NG KAPANGANAKAN / DATE OF BIRTH\n21 AUGUST 1995\nKASARIAN / SEX\nBABAE', 'philid')
  assert.deepEqual(result, { firstName: 'TEST', middleName: 'DEMO', lastName: 'SAMPLE', birthDate: '1995-08-21', sex: 'Female', contactNumber: '' })
})

test('license grouped headings and comma-delimited names are read conservatively', () => {
  const result = parseGovernmentId('Last Name, First Name, Middle Name\nSAMPLE, TEST, DEMO\nNationality Sex Date of Birth Weight Height\nPHL F 1995/08/21 60 1.65', 'license')
  assert.deepEqual(result, { firstName: 'TEST', middleName: 'DEMO', lastName: 'SAMPLE', birthDate: '1995-08-21', sex: 'Female', contactNumber: '' })
})

test('license OCR noise and one-comma names produce explicitly unconfirmed suggestions', () => {
  const result = parseGovernmentId('_ Last Name. First Name. Middle Name\n-« SAMPLE, TEST DEMO\nNationality Sex Date of Birth Weight (kg) Height(m)\nPHL M 2004/02/25 45 1.58', 'license')
  assert.equal(result.lastName, 'SAMPLE')
  assert.equal(result.firstName, 'TEST')
  assert.equal(result.middleName, 'DEMO')
  assert.equal(result.nameNeedsReview, true)
  assert.equal(result.birthDate, '2004-02-25')
})

test('autofill preserves manual values and complete existing birth-date controls', () => {
  globalThis.RadioNodeList = class extends Array {}
  const values = Object.fromEntries(['firstName', 'middleName', 'lastName', 'birthMonth', 'birthDay', 'birthYear', 'sex'].map((name) => [name, { value: '', dispatchEvent() {}, classList: { add() {} } }]))
  values.firstName.value = 'Manual'; values.birthYear.value = '1980'
  const form = { elements: { namedItem: (name) => values[name] } }
  const fields = { firstName: 'READ', lastName: 'SAMPLE', birthDate: '1995-08-21', sex: 'Female', contactNumber: '' }
  applyIdFields(form, fields)
  assert.equal(values.firstName.value, 'Manual'); assert.equal(values.lastName.value, 'SAMPLE')
  assert.equal(values.birthYear.value, '1980'); assert.equal(values.birthMonth.value, '')
  applyIdFields(form, fields, true)
  assert.equal(values.firstName.value, 'READ'); assert.equal(values.birthMonth.value, '08')
  delete globalThis.RadioNodeList
})

test('actual local Tesseract reads the clearly labeled synthetic image fixture', { timeout: 120000 }, async () => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const worker = await createWorker('eng', 1, { langPath: path.join(root, 'public/ocr/lang'), cacheMethod: 'none' })
  try {
    const { data } = await worker.recognize(path.join(root, 'tests/fixtures/synthetic-id.png'))
    const result = parseGovernmentId(data.text, 'philid')
    assert.equal(result.firstName, 'TEST')
    assert.equal(result.lastName, 'SAMPLE')
    assert.equal(result.birthDate, '1995-08-21')
    assert.equal(result.sex, 'Female')
  } finally { await worker.terminate() }
})
