import catalog from '../../../backend/core/medicine_catalog.json'
import api, { getShared } from '../api'

const formatDate = (value) => {
  if (!value) return ''
  return String(value).slice(0, 10)
}

const titleStatus = (status) => {
  const normalized = status || 'requested'
  const labels = {
    requested: 'Pending Approval',
    approved: 'Approved',
    dispatched: 'Dispatched',
    released: 'Delivered',
    declined: 'Declined',
  }

  return labels[normalized] || normalized
}

const titlePatientRequestStatus = (status) => {
  const labels = {
    walk_in: 'Walk In',
    requested: 'Requested',
    seen: 'Seen',
    available: 'Available',
    not_available: 'Not Available',
    ready_to_get: 'Ready to Get',
    received: 'Received',
  }

  return labels[status] || status || 'Requested'
}

const getBarangayFromFacility = (facility) => {
  const name = facility?.name || ''
  return name.replace(' Barangay Health Center', '').replace(' BHC', '').trim() || facility?.address || 'Lucena City'
}

export const mapInventoryRecord = (record) => {
  const medicine = record.medicine_detail || {}

  return {
    id: `MED-${record.id}`,
    backendId: record.id,
    medicineId: record.medicine,
    facilityId: record.facility,
    facility: record.facility_detail?.name || '',
    category: medicine.category || 'General',
    name: medicine.name || 'Unnamed medicine',
    type: medicine.medicine_type || 'Medicine',
    dosage: medicine.dosage || 'Not set',
    stocks: Number(record.quantity || 0),
    issued: formatDate(medicine.issued_date),
    expiry: formatDate(medicine.expiry_date),
  }
}

export const mapBhcMedicineRequest = (request) => {
  const facility = request.source_facility_detail || {}
  const user = request.requested_by_detail || {}
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'BHC Staff'

  return {
    id: `REQ-${request.id}`,
    backendId: request.id,
    medicineName: request.medicine_detail?.name || 'Medicine',
    medicineId: request.medicine,
    requestedFrom: 'Lucena City Health Office',
    dateRequested: formatDate(request.created_at),
    quantity: request.quantity,
    address: getBarangayFromFacility(facility),
    pickUpBy: name,
    status: titleStatus(request.status),
    rawStatus: request.status,
    dispatchedAt: request.dispatched_at,
    receivedAt: request.received_at,
  }
}

export const mapChoMedicineRequest = (request) => {
  const facility = request.source_facility_detail || {}
  const user = request.requested_by_detail || {}
  const requestedBy = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'BHC Staff'

  return {
    id: `REQ-${request.id}`,
    backendId: request.id,
    bhc: facility.name || 'Barangay Health Center',
    barangay: getBarangayFromFacility(facility),
    medicine: request.medicine_detail?.name || 'Medicine',
    quantity: request.quantity,
    requestedBy,
    date: formatDate(request.created_at),
    status: titleStatus(request.status),
    rawStatus: request.status,
    dispatchedAt: request.dispatched_at,
    receivedAt: request.received_at,
    dispatchedBy: [request.dispatched_by_detail?.first_name, request.dispatched_by_detail?.last_name].filter(Boolean).join(' ') || request.dispatched_by_detail?.username || '',
    receivedBy: [request.received_by_detail?.first_name, request.received_by_detail?.last_name].filter(Boolean).join(' ') || request.received_by_detail?.username || '',
    medicineId: request.medicine,
  }
}

export const fetchMedicineInventory = async (citywide = false) => {
  const response = await getShared('medicine-inventory/', { params: citywide ? { scope: 'citywide' } : {} })
  return response.data.map(mapInventoryRecord).sort(compareMedicineInventory)
}

export const findMedicineAvailability = async (medicineName, medicineId) => {
  const inventory = await fetchMedicineInventory()
  const normalizedName = medicineName.toLowerCase().trim()
  const matchingInventory = inventory.filter((medicine) => medicineId ? medicine.medicineId === medicineId : medicine.name.toLowerCase().trim() === normalizedName)

  return (
    matchingInventory.find((medicine) => medicine.facility.toLowerCase().includes('city health office')) ||
    matchingInventory[0] ||
    null
  )
}

export const saveMedicineInventory = async (medicine) => {
  const payload = {
    formulation_verified: medicine.formulationVerified === true,
    medicine_name: medicine.name,
    category: medicine.category,
    medicine_type: medicine.type,
    dosage: medicine.dosage,
    quantity: Number(medicine.stocks || 0),
    issued_date: medicine.issued || null,
    expiry_date: medicine.expiry || null,
  }

  const response = medicine.backendId
    ? await api.patch(`medicine-inventory/${medicine.backendId}/`, payload)
    : await api.post('medicine-inventory/', payload)

  return mapInventoryRecord(response.data)
}

export const fetchMedicineRequestsForBhc = async () => {
  const response = await getShared('medicine-requests/')
  return response.data.map(mapBhcMedicineRequest)
}

export const fetchMedicineRequestsForCho = async () => {
  const response = await getShared('medicine-requests/')
  return response.data.map(mapChoMedicineRequest)
}

export const createMedicineRequest = async ({ medicineName, quantity, medicineId }) => {
  const payload = {
    quantity: Number(quantity || 1),
  }

  if (medicineId) {
    payload.medicine = medicineId
  } else {
    payload.medicine_name = medicineName
  }

  const response = await api.post('medicine-requests/', payload)
  return mapBhcMedicineRequest(response.data)
}

export const updateMedicineRequest = async (requestId, updates) => {
  const response = await api.patch(`medicine-requests/${requestId}/`, updates)
  return {
    bhc: mapBhcMedicineRequest(response.data),
    cho: mapChoMedicineRequest(response.data),
  }
}

export const createMedicineRequestBatch = async (items) => {
  const response = await api.post('medicine-requests/batch/', {
    items: items.map(({ medicineId, quantity }) => ({ medicine: medicineId, quantity: Number(quantity) })),
  })
  return response.data.map(mapBhcMedicineRequest)
}

export const mapPatientMedicineDistribution = (distribution) => ({
  id: `PMD-${distribution.id}`,
  backendId: distribution.id,
  patientId: distribution.patient,
  patientName: distribution.patient_name || 'Patient',
  barangay: distribution.patient_barangay || '',
  medicineId: distribution.medicine,
  medicineName: distribution.medicine_detail?.name || 'Medicine',
  dosage: distribution.medicine_detail?.dosage || '',
  type: distribution.medicine_detail?.medicine_type || '',
  facility: distribution.facility_detail?.name || '',
  quantity: Number(distribution.quantity || 0),
  instructions: distribution.instructions || '',
  notes: distribution.notes || '',
  distributedBy: [
    distribution.distributed_by_detail?.first_name,
    distribution.distributed_by_detail?.last_name,
  ].filter(Boolean).join(' ') || distribution.distributed_by_detail?.username || 'BHC Staff',
  distributedAt: formatDate(distribution.distributed_at),
})

export const fetchPatientMedicineDistributions = async () => {
  const response = await api.get('patient-medicine-distributions/')
  return response.data.map(mapPatientMedicineDistribution)
}

export const createPatientMedicineDistribution = async ({ patientId, medicineId, quantity, instructions, notes, requestId }) => {
  const response = await api.post('patient-medicine-distributions/', {
    patient: patientId,
    medicine: medicineId,
    quantity: Number(quantity || 1),
    instructions,
    notes,
    request: requestId || null,
  })
  return mapPatientMedicineDistribution(response.data)
}

export const mapPatientMedicineRequest = (request) => ({
  id: `PMR-${request.id}`,
  backendId: request.id,
  patientId: request.patient,
  patientName: request.patient_name || 'Patient',
  barangay: request.patient_barangay || '',
  facility: request.bhc_facility_detail?.name || 'Barangay Health Center',
  medicineName: request.medicine_name || 'Prescription request',
  quantity: Number(request.quantity || 0),
  notes: request.notes || '',
  prescriptionUrl: request.prescription_url || request.prescription || '',
  status: titlePatientRequestStatus(request.status),
  rawStatus: request.status || 'requested',
  createdAt: request.created_at,
  updatedAt: request.updated_at,
})

export const fetchPatientMedicineRequests = async () => {
  const response = await api.get('patient-medicine-requests/')
  return response.data.map(mapPatientMedicineRequest)
}

export const createPatientMedicineRequest = async ({ patientId, notes, prescription, medicineName }) => {
  if (!prescription) {
    const response = await api.post('patient-medicine-requests/', {
      patient: patientId,
      ...(medicineName ? { medicine_name: medicineName } : {}),
      notes: notes || '',
    })
    return mapPatientMedicineRequest(response.data)
  }

  const payload = new FormData()
  if (patientId) payload.append('patient', patientId)
  if (medicineName) payload.append('medicine_name', medicineName)
  payload.append('notes', notes || '')
  payload.append('prescription', prescription)

  const response = await api.post('patient-medicine-requests/', payload)
  return mapPatientMedicineRequest(response.data)
}

export const updatePatientMedicineRequest = async (requestId, updates) => {
  const response = await api.patch(`patient-medicine-requests/${requestId}/`, updates)
  return mapPatientMedicineRequest(response.data)
}

const catalogCategories = [...new Set(catalog.map((item) => item.category))]
export const compareMedicineInventory = (a, b) => {
  const rank = (category) => { const i = catalogCategories.indexOf(category === 'Supportive / Other Therapy' ? 'Supportive/Other Therapy' : category); return i < 0 ? 99 : i }
  return rank(a.category) - rank(b.category) || a.name.localeCompare(b.name) || a.dosage.localeCompare(b.dosage)
}
